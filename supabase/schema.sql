-- =====================================================================
-- ClearPoint — schema + security hardening + pricing models
-- Idempotent: safe to run on a fresh project AND on your existing one.
-- Run the whole file in Supabase Dashboard -> SQL Editor.
-- =====================================================================

-- ---------- TABLES ----------
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique,
  full_name text,
  avatar_url text,
  account_type text check (account_type in ('academic', 'delivery', 'vendor_social')),
  is_admin boolean not null default false,
  created_at timestamptz default timezone('utc'::text, now()) not null
);
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles alter column email drop not null;   -- signup must not fail for users without an email
alter table public.profiles add column if not exists suspended boolean not null default false;

create table if not exists public.collections (
  id uuid default gen_random_uuid() primary key,
  creator_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  bank_details jsonb not null,
  custom_fields jsonb not null,
  is_active boolean default true,
  created_at timestamptz default timezone('utc'::text, now()) not null
);
-- pricing model + template + optional deadline
alter table public.collections add column if not exists template text not null default 'academic'
  check (template in ('academic', 'delivery', 'vendor_social'));
alter table public.collections add column if not exists pricing jsonb;
alter table public.collections add column if not exists closes_at timestamptz;
alter table public.collections add column if not exists admin_disabled boolean not null default false;  -- taken down by ClearPoint (creator can't undo)
alter table public.collections add column if not exists admin_note text;
alter table public.collections add column if not exists show_sponsored boolean not null default true;  -- creator opt-out: sponsored banner on the payer's confirmation screen

create table if not exists public.submissions (
  id uuid default gen_random_uuid() primary key,
  collection_id uuid references public.collections(id) on delete cascade not null,
  form_data jsonb not null,
  receipt_url text,            -- legacy (old public URLs)
  fulfilled boolean default false,
  status text default 'pending' check (status in ('pending', 'verified', 'flagged')),
  submitted_at timestamptz default timezone('utc'::text, now()) not null
);
alter table public.submissions add column if not exists receipt_path text;      -- legacy: receipts are now an image field
alter table public.submissions add column if not exists submitter_hash text;
alter table public.submissions add column if not exists total_amount numeric;   -- what the payer should have transferred (computed by the server)
alter table public.submissions add column if not exists order_items jsonb;      -- price-list orders: { itemId: quantity }
alter table public.submissions add column if not exists item_cost numeric;      -- delivery: what the payer entered for the items
alter table public.submissions alter column receipt_url drop not null;

create index if not exists collections_creator_idx on public.collections (creator_id);
create index if not exists submissions_collection_idx on public.submissions (collection_id, submitted_at desc);
create index if not exists submissions_hash_idx on public.submissions (submitter_hash, submitted_at);

-- ---------- ADMIN HELPERS ----------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_admin);
$$;

create or replace function public.is_suspended()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and suspended);
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_suspended() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_suspended() to authenticated;

-- ---------- REPORTS (payers can report a link) ----------
create table if not exists public.reports (
  id uuid default gen_random_uuid() primary key,
  collection_id uuid references public.collections(id) on delete cascade not null,
  reason text not null check (reason in ('scam', 'wrong_details', 'inappropriate', 'other')),
  details text,
  reporter_hash text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz default timezone('utc'::text, now()) not null
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_collection_idx on public.reports (collection_id);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;   -- no direct access: only the functions below

-- ---------- PROMOTIONS (sponsored banners managed by admins) ----------
create table if not exists public.promotions (
  id uuid default gen_random_uuid() primary key,
  title text not null check (char_length(title) between 1 and 80),
  image_path text not null,                       -- object in the public 'promotions' bucket
  link_url text not null check (link_url ~* '^https://'),
  placement text not null default 'both' check (placement in ('dashboard', 'landing', 'both', 'payer_success', 'everywhere')),
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  views integer not null default 0,
  clicks integer not null default 0,
  created_at timestamptz default timezone('utc'::text, now()) not null
);
alter table public.promotions enable row level security;
revoke all on public.promotions from anon, authenticated;   -- no direct access: only the functions below
-- existing databases: widen the placement list (payer_success = the confirmation screen after a payer submits)
alter table public.promotions drop constraint if exists promotions_placement_check;
alter table public.promotions add constraint promotions_placement_check
  check (placement in ('dashboard', 'landing', 'both', 'payer_success', 'everywhere'));

-- keep-alive heartbeat (free Supabase projects pause after a week with little activity)
create table if not exists public.heartbeat (
  id int primary key default 1 check (id = 1),
  last_ping timestamptz not null default now(),
  pings bigint not null default 0
);
alter table public.heartbeat enable row level security;
revoke all on public.heartbeat from anon, authenticated;

-- payer-page visits per day (used for the admin overview)
create table if not exists public.daily_stats (
  day date primary key,
  payer_views integer not null default 0
);
alter table public.daily_stats enable row level security;
revoke all on public.daily_stats from anon, authenticated;

-- ---------- PRICING VALIDATION ----------
-- pricing is one of:
--   {"mode":"fixed","amount":2000}
--   {"mode":"delivery","fee":300}                       (payer adds the cost of their items)
--   {"mode":"items","items":[{"id","name","price"}],"fee":200}   (fee optional)
create or replace function public.is_valid_pricing(p jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  it jsonb;
  ids text[] := '{}';
  n int;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return false; end if;

  if p->>'mode' = 'fixed' then
    if jsonb_typeof(p->'amount') is distinct from 'number' then return false; end if;
    return (p->>'amount')::numeric > 0 and (p->>'amount')::numeric <= 10000000;

  elsif p->>'mode' = 'delivery' then
    if jsonb_typeof(p->'fee') is distinct from 'number' then return false; end if;
    return (p->>'fee')::numeric > 0 and (p->>'fee')::numeric <= 1000000;

  elsif p->>'mode' = 'items' then
    if jsonb_typeof(p->'items') is distinct from 'array' then return false; end if;
    n := jsonb_array_length(p->'items');
    if n < 1 or n > 50 then return false; end if;
    for it in select e.value from jsonb_array_elements(p->'items') e loop
      if coalesce(it->>'id', '') = '' then return false; end if;
      if char_length(coalesce(it->>'name', '')) not between 1 and 80 then return false; end if;
      if jsonb_typeof(it->'price') is distinct from 'number' then return false; end if;
      if (it->>'price')::numeric <= 0 or (it->>'price')::numeric > 10000000 then return false; end if;
      if it ? 'description' then
        if jsonb_typeof(it->'description') is distinct from 'string' or char_length(it->>'description') > 300 then
          return false;
        end if;
      end if;
      if (it->>'id') = any(ids) then return false; end if;
      ids := ids || (it->>'id');
    end loop;
    if p ? 'fee' then
      if jsonb_typeof(p->'fee') is distinct from 'number' then return false; end if;
      if (p->>'fee')::numeric < 0 or (p->>'fee')::numeric > 1000000 then return false; end if;
    end if;
    return true;
  end if;

  return false;
end;
$$;

-- legacy links: their fixed amount used to live in bank_details.amount
update public.collections
set pricing = jsonb_build_object('mode', 'fixed', 'amount', (bank_details->>'amount')::numeric)
where pricing is null
  and (bank_details->>'amount') ~ '^[0-9]+(\.[0-9]+)?$'
  and (bank_details->>'amount')::numeric > 0;

update public.submissions s
set total_amount = (c.bank_details->>'amount')::numeric
from public.collections c
where s.collection_id = c.id
  and s.total_amount is null
  and (c.bank_details->>'amount') ~ '^[0-9]+(\.[0-9]+)?$';

-- Basic data validation (NOT VALID = applies to new/updated rows, won't fail on old data)
alter table public.collections drop constraint if exists collections_valid;
alter table public.collections add constraint collections_valid check (
  jsonb_typeof(custom_fields) = 'array'
  and char_length(title) between 1 and 120
  and bank_details ? 'accountNumber'
  and (bank_details->>'accountNumber') ~ '^[0-9]{10}$'
  and public.is_valid_pricing(pricing)
) not valid;

-- ---------- ROW LEVEL SECURITY ----------
alter table public.profiles enable row level security;
alter table public.collections enable row level security;
alter table public.submissions enable row level security;

-- remove the old, too-permissive policies
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Active collections are viewable by everyone" on public.collections;
drop policy if exists "Users can create collections" on public.collections;
drop policy if exists "Creators can update their own collections" on public.collections;
drop policy if exists "Anyone can submit a receipt proof" on public.submissions;
drop policy if exists "Creators can view submissions for their own collections" on public.submissions;
drop policy if exists "Creators can update fulfillment status for their submissions" on public.submissions;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "collections_select_own" on public.collections;
drop policy if exists "collections_insert_own" on public.collections;
drop policy if exists "collections_update_own" on public.collections;
drop policy if exists "collections_delete_own" on public.collections;
drop policy if exists "submissions_select_creator" on public.submissions;
drop policy if exists "submissions_update_creator" on public.submissions;
drop policy if exists "submissions_delete_creator" on public.submissions;

-- profiles: you can only see/edit yourself (emails are no longer public)
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- collections: creators manage their own. Payers read through get_public_collection() below.
create policy "collections_select_own" on public.collections for select to authenticated using (auth.uid() = creator_id);
create policy "collections_insert_own" on public.collections for insert to authenticated
  with check (auth.uid() = creator_id and not public.is_suspended());
create policy "collections_update_own" on public.collections for update to authenticated using (auth.uid() = creator_id) with check (auth.uid() = creator_id);
create policy "collections_delete_own" on public.collections for delete to authenticated using (auth.uid() = creator_id);

-- submissions: NO direct anonymous insert (goes through submit_proof()).
create policy "submissions_select_creator" on public.submissions for select to authenticated
  using (exists (select 1 from public.collections c where c.id = submissions.collection_id and c.creator_id = auth.uid()));
create policy "submissions_update_creator" on public.submissions for update to authenticated
  using (exists (select 1 from public.collections c where c.id = submissions.collection_id and c.creator_id = auth.uid()));
create policy "submissions_delete_creator" on public.submissions for delete to authenticated
  using (exists (select 1 from public.collections c where c.id = submissions.collection_id and c.creator_id = auth.uid()));

-- Column-level privileges: users can't make themselves admin, or edit anything but status/fulfilled
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, email, full_name, avatar_url, account_type) on public.profiles to authenticated;
grant update (full_name, avatar_url, account_type) on public.profiles to authenticated;

-- creators can never touch admin_disabled / admin_note
revoke all on public.collections from anon, authenticated;
grant select, delete on public.collections to authenticated;
grant insert (creator_id, title, description, template, bank_details, pricing, custom_fields, is_active, closes_at, show_sponsored)
  on public.collections to authenticated;
grant update (title, description, template, bank_details, pricing, custom_fields, is_active, closes_at, show_sponsored)
  on public.collections to authenticated;

revoke all on public.submissions from anon, authenticated;
grant select, delete on public.submissions to authenticated;
grant update (fulfilled, status) on public.submissions to authenticated;

-- ---------- NEW-USER TRIGGER ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- backfill profiles for anyone who signed up before the trigger existed
insert into public.profiles (id, email, full_name, avatar_url)
select u.id, u.email, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'avatar_url'
from auth.users u
on conflict (id) do nothing;

-- ---------- PUBLIC FUNCTIONS (what payers are allowed to do) ----------

-- Read ONE open collection by id (no listing/enumeration)
create or replace function public.get_public_collection(p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'id', c.id,
    'title', c.title,
    'description', c.description,
    'template', c.template,
    'bank_details', c.bank_details,
    'pricing', c.pricing,
    'custom_fields', c.custom_fields,
    'closes_at', c.closes_at
  )
  into v
  from public.collections c
  where c.id = p_id and c.is_active and not c.admin_disabled and (c.closes_at is null or c.closes_at > now());

  if v is not null then
    insert into public.daily_stats (day, payer_views) values (current_date, 1)
    on conflict (day) do update set payer_views = public.daily_stats.payer_views + 1;
  end if;
  return v;
end;
$$;

-- Submit proof: validates fields, works out the total price itself, throttles by network
drop function if exists public.submit_proof(uuid, jsonb, text);
create or replace function public.submit_proof(
  p_collection_id uuid,
  p_form_data jsonb,
  p_order jsonb,
  p_item_cost numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fields jsonb;
  v_pricing jsonb;
  v_field jsonb;
  v_item jsonb;
  v_key text;
  v_val text;
  v_type text;
  v_clean jsonb := '{}'::jsonb;
  v_order_clean jsonb := '{}'::jsonb;
  v_qtyj jsonb;
  v_qty int;
  v_total numeric := 0;
  v_item_cost numeric := null;
  v_ip text;
  v_hash text;
  v_recent int;
  v_id uuid;
begin
  select custom_fields, pricing into v_fields, v_pricing
  from public.collections
  where id = p_collection_id and is_active and not admin_disabled and (closes_at is null or closes_at > now());
  if not found or v_pricing is null then
    raise exception 'collection_unavailable';
  end if;

  if p_form_data is null or jsonb_typeof(p_form_data) <> 'object' or length(p_form_data::text) > 8000 then
    raise exception 'invalid_form';
  end if;

  -- reject unknown keys
  if exists (
    select 1 from jsonb_object_keys(p_form_data) k
    where k not in (select f->>'id' from jsonb_array_elements(v_fields) f)
  ) then
    raise exception 'invalid_form';
  end if;

  -- validate/clean each configured field
  for v_field in select e.value from jsonb_array_elements(v_fields) e loop
    v_key := v_field->>'id';
    v_type := coalesce(v_field->>'type', 'text');
    v_val := btrim(coalesce(p_form_data->>v_key, ''));

    if length(v_val) > (case when v_type = 'textarea' then 500 else 200 end) then
      raise exception 'invalid_form';
    end if;
    if coalesce((v_field->>'required')::boolean, true) and v_val = '' then
      raise exception 'missing_field';
    end if;
    -- dropdowns: must be one of the creator's options
    if v_type = 'select' and v_val <> '' and not (coalesce(v_field->'options', '[]'::jsonb) ? v_val) then
      raise exception 'invalid_form';
    end if;
    -- image fields hold a storage path inside THIS collection's folder (or '' when optional and skipped)
    if v_type = 'image' and v_val <> ''
       and v_val !~ ('^' || p_collection_id::text || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$') then
      raise exception 'invalid_form';
    end if;
    v_clean := v_clean || jsonb_build_object(v_key, v_val);
  end loop;

  -- work out what the payer owes (never trust a total sent by the browser)
  if v_pricing->>'mode' = 'fixed' then
    v_total := (v_pricing->>'amount')::numeric;

  elsif v_pricing->>'mode' = 'delivery' then
    if p_item_cost is null or p_item_cost < 0 or p_item_cost > 1000000 then
      raise exception 'invalid_amount';
    end if;
    v_item_cost := p_item_cost;
    v_total := (v_pricing->>'fee')::numeric + p_item_cost;

  elsif v_pricing->>'mode' = 'items' then
    if p_order is null or jsonb_typeof(p_order) <> 'object' then
      raise exception 'invalid_order';
    end if;
    for v_key, v_qtyj in select o.key, o.value from jsonb_each(p_order) o loop
      select e.value into v_item
      from jsonb_array_elements(v_pricing->'items') e
      where e.value->>'id' = v_key;
      if not found then raise exception 'invalid_order'; end if;
      if jsonb_typeof(v_qtyj) is distinct from 'number' or (v_qtyj #>> '{}') !~ '^[0-9]{1,2}$' then
        raise exception 'invalid_order';
      end if;
      v_qty := (v_qtyj #>> '{}')::int;
      if v_qty > 0 then
        v_order_clean := v_order_clean || jsonb_build_object(v_key, v_qty);
        v_total := v_total + (v_item->>'price')::numeric * v_qty;
      end if;
    end loop;
    if v_order_clean = '{}'::jsonb then
      raise exception 'invalid_order';
    end if;
    v_total := v_total + coalesce((v_pricing->>'fee')::numeric, 0);
  else
    raise exception 'collection_unavailable';
  end if;

  -- throttle: max 40 submissions per network per 10 minutes (campus wifi shares IPs, so this is generous)
  begin
    v_ip := split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1);
  exception when others then
    v_ip := '';
  end;
  if v_ip <> '' then
    v_hash := md5(btrim(v_ip));
    select count(*) into v_recent from public.submissions
    where submitter_hash = v_hash and submitted_at > now() - interval '10 minutes';
    if v_recent >= 40 then
      raise exception 'rate_limited';
    end if;
  end if;

  insert into public.submissions (collection_id, form_data, total_amount, order_items, item_cost, submitter_hash)
  values (
    p_collection_id,
    v_clean,
    v_total,
    case when v_order_clean = '{}'::jsonb then null else v_order_clean end,
    v_item_cost,
    v_hash
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Used by the storage upload policy below
create or replace function public.collection_accepts_uploads(p_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.collections
    where id::text = p_id and is_active and not admin_disabled and (closes_at is null or closes_at > now())
  );
$$;

revoke all on function public.get_public_collection(uuid) from public;
revoke all on function public.submit_proof(uuid, jsonb, jsonb, numeric) from public;
revoke all on function public.collection_accepts_uploads(text) from public;
grant execute on function public.get_public_collection(uuid) to anon, authenticated;
grant execute on function public.submit_proof(uuid, jsonb, jsonb, numeric) to anon, authenticated;
grant execute on function public.collection_accepts_uploads(text) to anon, authenticated;
drop function if exists public.admin_stats();   -- replaced by admin_overview()


-- =====================================================================
-- ADMIN, MODERATION & PROMOTIONS FUNCTIONS
-- Every admin_* function checks profiles.is_admin itself.
-- =====================================================================

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'new_creators_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'links', (select count(*) from public.collections),
    'active_links', (select count(*) from public.collections
                     where is_active and not admin_disabled and (closes_at is null or closes_at > now())),
    'disabled_links', (select count(*) from public.collections where admin_disabled),
    'links_by_template', (select coalesce(jsonb_object_agg(t.template, t.n), '{}'::jsonb)
                          from (select template, count(*) n from public.collections group by template) t),
    'submissions', (select count(*) from public.submissions),
    'submissions_7d', (select count(*) from public.submissions where submitted_at > now() - interval '7 days'),
    'verified_volume', (select coalesce(sum(total_amount), 0) from public.submissions where status = 'verified'),
    'pending_volume', (select coalesce(sum(total_amount), 0) from public.submissions where status = 'pending'),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'payer_views_7d', (select coalesce(sum(payer_views), 0) from public.daily_stats where day > current_date - 7),
    'last_keepalive', (select last_ping from public.heartbeat where id = 1),
    'storage_bytes', (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'n', coalesce(c.n, 0)) order by d.day), '[]'::jsonb)
      from (select g::date as day from generate_series(current_date - 13, current_date, interval '1 day') g) d
      left join (
        select submitted_at::date as day, count(*) n
        from public.submissions
        where submitted_at >= current_date - 13
        group by 1
      ) c on c.day = d.day
    )
  );
end;
$$;

create or replace function public.admin_list_links(p_search text default '', p_limit int default 25, p_offset int default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := '%' || coalesce(btrim(p_search), '') || '%';
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(x.j || jsonb_build_object('open_reports', x.open_reports) order by x.open_reports desc, x.created_at desc)
    from (
      select
        c.created_at,
        (select count(*) from public.reports r where r.collection_id = c.id and r.status = 'open') as open_reports,
        jsonb_build_object(
          'id', c.id, 'title', c.title, 'template', c.template,
          'creator_id', c.creator_id, 'creator_email', p.email, 'creator_name', p.full_name,
          'is_active', c.is_active, 'admin_disabled', c.admin_disabled, 'admin_note', c.admin_note,
          'closes_at', c.closes_at, 'created_at', c.created_at, 'bank_details', c.bank_details,
          'submissions', (select count(*) from public.submissions s where s.collection_id = c.id)
        ) as j
      from public.collections c
      join public.profiles p on p.id = c.creator_id
      where btrim(coalesce(p_search, '')) = ''
         or c.title ilike v_q or p.email ilike v_q
         or c.bank_details->>'accountNumber' ilike v_q or c.bank_details->>'accountName' ilike v_q
      order by open_reports desc, c.created_at desc
      limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_set_link_disabled(p_id uuid, p_disabled boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.collections
  set admin_disabled = p_disabled,
      admin_note = case when p_disabled then nullif(left(btrim(coalesce(p_note, '')), 200), '') else null end
  where id = p_id;
  if p_disabled then
    update public.reports set status = 'resolved' where collection_id = p_id and status = 'open';
  end if;
end;
$$;

-- file paths of every image a link's submissions uploaded (so they can be removed before deleting the link)
create or replace function public.admin_link_image_paths(p_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_paths text[];
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select coalesce(array_agg(distinct t.p) filter (where t.p is not null and t.p <> ''), '{}') into v_paths
  from (
    select s.receipt_path as p from public.submissions s where s.collection_id = p_id
    union all
    select s.form_data->>(f.value->>'id') as p
    from public.collections c
    join public.submissions s on s.collection_id = c.id
    cross join lateral jsonb_array_elements(c.custom_fields) f
    where c.id = p_id and f.value->>'type' = 'image'
  ) t;
  return v_paths;
end;
$$;

create or replace function public.admin_delete_link(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from public.collections where id = p_id;
end;
$$;

create or replace function public.admin_list_creators(p_search text default '', p_limit int default 25, p_offset int default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := '%' || coalesce(btrim(p_search), '') || '%';
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(x.j order by x.created_at desc)
    from (
      select
        p.created_at,
        jsonb_build_object(
          'id', p.id, 'email', p.email, 'full_name', p.full_name, 'account_type', p.account_type,
          'is_admin', p.is_admin, 'suspended', p.suspended, 'created_at', p.created_at,
          'links', (select count(*) from public.collections c where c.creator_id = p.id),
          'submissions', (select count(*) from public.submissions s
                          join public.collections c on c.id = s.collection_id where c.creator_id = p.id)
        ) as j
      from public.profiles p
      where btrim(coalesce(p_search, '')) = '' or p.email ilike v_q or p.full_name ilike v_q
      order by p.created_at desc
      limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_set_creator_suspended(p_id uuid, p_suspended boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_id = auth.uid() then raise exception 'cannot_suspend_self'; end if;
  if exists (select 1 from public.profiles where id = p_id and is_admin) then raise exception 'cannot_suspend_admin'; end if;

  update public.profiles set suspended = p_suspended where id = p_id;

  if p_suspended then
    update public.collections
    set admin_disabled = true,
        admin_note = 'Account suspended' || coalesce(': ' || nullif(left(btrim(coalesce(p_note, '')), 150), ''), '')
    where creator_id = p_id and not admin_disabled;
  else
    -- only re-open links that the suspension itself closed (not ones taken down individually)
    update public.collections
    set admin_disabled = false, admin_note = null
    where creator_id = p_id and admin_disabled and admin_note like 'Account suspended%';
  end if;
end;
$$;

-- Payers report a link (anonymous allowed, throttled)
create or replace function public.report_link(p_collection_id uuid, p_reason text, p_details text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ip text;
  v_hash text;
  v_recent int;
begin
  if p_reason is null or p_reason not in ('scam', 'wrong_details', 'inappropriate', 'other') then
    raise exception 'invalid_reason';
  end if;
  if p_details is not null and length(p_details) > 500 then
    raise exception 'invalid_form';
  end if;
  if not exists (select 1 from public.collections where id = p_collection_id) then
    raise exception 'collection_unavailable';
  end if;

  begin
    v_ip := split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1);
  exception when others then
    v_ip := '';
  end;
  if v_ip <> '' then
    v_hash := md5(btrim(v_ip));
    select count(*) into v_recent from public.reports
    where reporter_hash = v_hash and created_at > now() - interval '1 hour';
    if v_recent >= 10 then raise exception 'rate_limited'; end if;
  end if;

  insert into public.reports (collection_id, reason, details, reporter_hash)
  values (p_collection_id, p_reason, nullif(btrim(coalesce(p_details, '')), ''), v_hash);
end;
$$;

create or replace function public.admin_list_reports(p_status text default 'open', p_limit int default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(x.j order by x.created_at desc)
    from (
      select
        r.created_at,
        jsonb_build_object(
          'id', r.id, 'reason', r.reason, 'details', r.details, 'status', r.status, 'created_at', r.created_at,
          'link_id', c.id, 'link_title', c.title, 'link_disabled', c.admin_disabled,
          'creator_email', p.email, 'bank_details', c.bank_details,
          'reports_on_link', (select count(*) from public.reports r2 where r2.collection_id = c.id),
          'submissions', (select count(*) from public.submissions s where s.collection_id = c.id)
        ) as j
      from public.reports r
      join public.collections c on c.id = r.collection_id
      join public.profiles p on p.id = c.creator_id
      where r.status = p_status
      order by r.created_at desc
      limit least(greatest(p_limit, 1), 200)
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_resolve_report(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_status not in ('open', 'resolved', 'dismissed') then raise exception 'invalid_status'; end if;
  update public.reports set status = p_status where id = p_id;
end;
$$;

-- ---------- promotions ----------
-- Picks one live promotion for a placement ('dashboard' or 'landing') and counts the view
drop function if exists public.get_promotion(text);
create or replace function public.get_promotion(p_placement text, p_collection_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v jsonb;
begin
  if p_placement is null or p_placement not in ('dashboard', 'landing', 'payer_success') then return null; end if;

  -- payers only see a banner after they submit, and only if the link's creator hasn't opted out
  if p_placement = 'payer_success' then
    if p_collection_id is null then return null; end if;
    if not exists (select 1 from public.collections where id = p_collection_id and show_sponsored) then
      return null;
    end if;
  end if;

  select id into v_id
  from public.promotions
  where is_active and starts_at <= now() and (ends_at is null or ends_at > now())
    and (placement = p_placement
         or placement = 'everywhere'
         or (placement = 'both' and p_placement in ('dashboard', 'landing')))
  order by random()
  limit 1;
  if v_id is null then return null; end if;
  update public.promotions set views = views + 1 where id = v_id;
  select jsonb_build_object('id', id, 'title', title, 'image_path', image_path, 'link_url', link_url)
  into v from public.promotions where id = v_id;
  return v;
end;
$$;

create or replace function public.track_promotion_click(p_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.promotions set clicks = clicks + 1 where id = p_id and is_active;
$$;

create or replace function public.admin_list_promotions()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(p) order by p.created_at desc) from public.promotions p
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_create_promotion(
  p_title text, p_image_path text, p_link_url text, p_placement text,
  p_starts_at timestamptz, p_ends_at timestamptz, p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  insert into public.promotions (title, image_path, link_url, placement, starts_at, ends_at, is_active)
  values (btrim(p_title), p_image_path, btrim(p_link_url), p_placement,
          coalesce(p_starts_at, now()), p_ends_at, coalesce(p_is_active, true))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_set_promotion_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.promotions set is_active = p_active where id = p_id;
end;
$$;

-- returns the image path so the page can remove the file too
create or replace function public.admin_delete_promotion(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from public.promotions where id = p_id returning image_path into v_path;
  return v_path;
end;
$$;

-- Keep-alive: real reads + a tiny write, so the project counts as active. Safe to call from anywhere.
create or replace function public.keepalive()
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v timestamptz := now();
begin
  perform count(*) from public.collections;
  perform count(*) from public.profiles;
  insert into public.heartbeat (id, last_ping, pings) values (1, v, 1)
  on conflict (id) do update
    set last_ping = excluded.last_ping, pings = public.heartbeat.pings + 1
    where public.heartbeat.last_ping < v - interval '10 minutes';   -- limits write churn if hammered
  return v;
end;
$$;
revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;

revoke all on function public.admin_overview() from public;
revoke all on function public.admin_list_links(text, int, int) from public;
revoke all on function public.admin_set_link_disabled(uuid, boolean, text) from public;
revoke all on function public.admin_link_image_paths(uuid) from public;
revoke all on function public.admin_delete_link(uuid) from public;
revoke all on function public.admin_list_creators(text, int, int) from public;
revoke all on function public.admin_set_creator_suspended(uuid, boolean, text) from public;
revoke all on function public.report_link(uuid, text, text) from public;
revoke all on function public.admin_list_reports(text, int) from public;
revoke all on function public.admin_resolve_report(uuid, text) from public;
revoke all on function public.get_promotion(text, uuid) from public;
revoke all on function public.track_promotion_click(uuid) from public;
revoke all on function public.admin_list_promotions() from public;
revoke all on function public.admin_create_promotion(text, text, text, text, timestamptz, timestamptz, boolean) from public;
revoke all on function public.admin_set_promotion_active(uuid, boolean) from public;
revoke all on function public.admin_delete_promotion(uuid) from public;

grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_list_links(text, int, int) to authenticated;
grant execute on function public.admin_set_link_disabled(uuid, boolean, text) to authenticated;
grant execute on function public.admin_link_image_paths(uuid) to authenticated;
grant execute on function public.admin_delete_link(uuid) to authenticated;
grant execute on function public.admin_list_creators(text, int, int) to authenticated;
grant execute on function public.admin_set_creator_suspended(uuid, boolean, text) to authenticated;
grant execute on function public.report_link(uuid, text, text) to anon, authenticated;
grant execute on function public.admin_list_reports(text, int) to authenticated;
grant execute on function public.admin_resolve_report(uuid, text) to authenticated;
grant execute on function public.get_promotion(text, uuid) to anon, authenticated;
grant execute on function public.track_promotion_click(uuid) to anon, authenticated;
grant execute on function public.admin_list_promotions() to authenticated;
grant execute on function public.admin_create_promotion(text, text, text, text, timestamptz, timestamptz, boolean) to authenticated;
grant execute on function public.admin_set_promotion_active(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_promotion(uuid) to authenticated;

-- ---------- STORAGE: private receipts bucket ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Allow public receipt uploads" on storage.objects;
drop policy if exists "receipts_upload" on storage.objects;
drop policy if exists "receipts_creator_read" on storage.objects;
drop policy if exists "receipts_creator_delete" on storage.objects;

-- anyone may upload, but only to <open-collection-id>/<uuid>.<img ext>
create policy "receipts_upload" on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'receipts'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
    and public.collection_accepts_uploads((storage.foldername(name))[1])
  );

-- only the collection's creator can read/delete its images (via signed URLs)
create policy "receipts_creator_read" on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and exists (select 1 from public.collections c
                where c.id::text = (storage.foldername(name))[1] and c.creator_id = auth.uid())
  );
create policy "receipts_creator_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts'
    and exists (select 1 from public.collections c
                where c.id::text = (storage.foldername(name))[1] and c.creator_id = auth.uid())
  );

-- admins can remove files when they delete a link (they still can't read receipts)
drop policy if exists "receipts_admin_delete" on storage.objects;
create policy "receipts_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.is_admin());

-- public bucket for sponsored banners (ads are public by nature); only admins can write
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('promotions', 'promotions', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "promotions_admin_insert" on storage.objects;
drop policy if exists "promotions_admin_update" on storage.objects;
drop policy if exists "promotions_admin_delete" on storage.objects;
create policy "promotions_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'promotions' and public.is_admin());
create policy "promotions_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'promotions' and public.is_admin());
create policy "promotions_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'promotions' and public.is_admin());

-- collections created before receipts became a field: give them a required receipt-upload field
-- (only touches collections made before 21 Oct 2026 that have no image field at all)
update public.collections
set custom_fields = custom_fields || jsonb_build_array(jsonb_build_object(
  'id', 'receipt', 'label', 'Upload Payment Receipt Screenshot', 'type', 'image', 'required', true))
where created_at < timestamptz '2026-10-21 00:00:00+00'
  and not exists (select 1 from jsonb_array_elements(custom_fields) f where f->>'type' = 'image');

-- convert legacy public receipt URLs into storage paths (old links stop working once the bucket is private)
update public.submissions
set receipt_path = substring(receipt_url from '/receipts/([^?]+)')
where receipt_path is null and receipt_url like '%/receipts/%';

-- =====================================================================
-- AFTER running this, make yourself admin (replace the email):
--   update public.profiles set is_admin = true where email = 'you@gmail.com';
-- =====================================================================
