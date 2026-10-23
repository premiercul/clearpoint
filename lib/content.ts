// lib/content.ts
// Plain content shared by the landing page, the persona pages, structured data and llms.txt.
// Keep every claim here true to what the product really does (it is read by people and by AI answer engines).

export const FAQ: { q: string; a: string }[] = [
  {
    q: 'Do payers need an account?',
    a: 'No. Only the person creating the link signs in (with Google). Payers just open the link.',
  },
  {
    q: 'Where does the money go?',
    a: 'Straight from the payer to the bank account you enter. ClearPoint never receives, holds or moves money.',
  },
  {
    q: 'What if the price is not the same for everyone?',
    a: 'Pick the setup that fits: one fixed amount, your delivery fee plus the cost of what each person wants bought, or one product with a quantity picker. Everyone sees their own total, and you see the amount to expect next to each receipt.',
  },
  {
    q: 'Does ClearPoint deliver anything?',
    a: 'No. It is the tool runners and vendors use to take orders and payments proof. Runners set their own on-campus drop-off points (departments, faculties, lecture halls) and people pick from that list.',
  },
  {
    q: 'Does ClearPoint confirm that a payment really arrived?',
    a: 'No. You check each receipt against your own bank alert, then mark it verified or flagged. ClearPoint keeps everything in one place so that check is quick.',
  },
  {
    q: 'What if someone uploads a fake receipt?',
    a: 'Mark it flagged. Because payments go to your account, you decide what counts as paid.',
  },
  {
    q: 'Can I give my lecturer or supervisor a list?',
    a: 'Yes. Export the submissions as a CSV that opens in Excel, or print the page and save it as a PDF.',
  },
  {
    q: 'Can I delete the data afterwards?',
    a: 'Yes. You can delete all submissions and their receipt images for a link, or delete the link entirely.',
  },
]

export type PersonaSlug = 'class-reps' | 'delivery-runners' | 'campus-vendors'
export const PERSONA_ORDER: PersonaSlug[] = ['class-reps', 'delivery-runners', 'campus-vendors']

export interface Persona {
  slug: PersonaSlug
  navLabel: string
  title: string // page title (the site name is added automatically)
  h1: string
  description: string // meta description
  intro: string
  problems: string[]
  steps: { title: string; body: string }[]
  gets: string[]
  faq: { q: string; a: string }[]
}

export const PERSONAS: Record<PersonaSlug, Persona> = {
  'class-reps': {
    slug: 'class-reps',
    navLabel: 'Class reps',
    title: 'Collect class dues and course manual payments',
    h1: 'Collect class dues and course manual payments without the screenshot chaos',
    description:
      'One link for class dues and course manuals. Students pay you directly and upload a receipt; you get a clean list with duplicate matric numbers flagged.',
    intro:
      'ClearPoint gives class reps one link to share. Each student pays your account directly, fills in their name and matric number, and uploads their receipt. You check it against your bank alert and end up with a clean list for your lecturer.',
    problems: [
      'Receipts and transfer screenshots scattered across several chats',
      'No quick way to tell who has paid and who has not',
      'The same student paying twice, or a made-up matric number',
      'A lecturer who wants a list while you are retyping names',
    ],
    steps: [
      { title: 'Create a link', body: 'Set the amount and your account number, and choose what to collect: name, matric number, department and a payment receipt.' },
      { title: 'Share it in your class group', body: 'Students open the link on their phone. They do not need an account.' },
      { title: 'Check and tick off', body: 'Compare each receipt with your bank alert, then mark it verified or flagged.' },
      { title: 'Hand over the list', body: 'Export the verified payments as a CSV that opens in Excel (sorted by department), or print the page and save it as a PDF.' },
    ],
    gets: [
      'One fixed amount, or a price list if you collect for several items',
      'Receipt images that stay private to you',
      'A warning when the same matric number appears twice',
      'Export to Excel (CSV) or print as PDF',
      'An optional closing time so the link stops at your deadline',
    ],
    faq: [
      { q: 'Do students need an account to pay?', a: 'No. Only the class rep signs in (with Google). Students just open the link, fill in the form and upload their receipt.' },
      { q: 'Does ClearPoint hold the money?', a: 'No. Students transfer straight to the bank account you enter. ClearPoint only records their details and proof.' },
      { q: 'How do I know a payment really arrived?', a: 'ClearPoint does not check your bank. You compare each receipt with your own bank alert, then mark it verified or flagged.' },
    ],
  },
  'delivery-runners': {
    slug: 'delivery-runners',
    navLabel: 'Delivery runners',
    title: 'Run on-campus deliveries with every order in one list',
    h1: 'Run on-campus deliveries with every order, fee and drop-off in one list',
    description:
      'For campus delivery runners: share one link, get orders with drop-off points, item costs and receipts, then plan your route by building.',
    intro:
      'ClearPoint is for runners who deliver within campus, to departments and lecture halls. You set one flat delivery fee and your own list of drop-off points. Each customer enters what they want and what it costs, sees the delivery fee plus items as their total, pays you directly and uploads their receipt.',
    problems: [
      'Orders buried in group chats and direct messages',
      'Adding up item costs and your fee for every order',
      'Not knowing which department or lecture hall each order is going to',
      'Customers who say they paid when you cannot find the proof',
    ],
    steps: [
      { title: 'Set your fee and drop-off points', body: 'Enter your flat delivery fee and the departments, faculties and lecture halls you deliver to.' },
      { title: 'Share the link', body: 'Customers pick a drop-off point, say exactly where, describe what to buy, enter the item cost and see their total.' },
      { title: 'Work the run board', body: 'Orders are grouped by drop-off point with tap-to-call, the total to buy and your fees.' },
      { title: 'Mark delivered', body: 'Tick each order off as you go and see what is left.' },
    ],
    gets: [
      'A flat delivery fee plus the item cost, added up for the customer',
      'Drop-off points chosen from your own list',
      'A run board grouped by drop-off point, with tap-to-call',
      'Totals for items to buy and your fees',
      'Receipt images that stay private to you',
    ],
    faq: [
      { q: 'Does ClearPoint deliver the orders?', a: 'No. ClearPoint is the tool runners use to take orders and payment proof. You do the delivery.' },
      { q: 'What if an item costs more than the customer entered?', a: 'Flag the order and settle the difference with the customer. ClearPoint does not adjust totals yet.' },
      { q: 'Do customers need an account?', a: 'No. They open your link, fill in the form and upload their receipt.' },
    ],
  },
  'campus-vendors': {
    slug: 'campus-vendors',
    navLabel: 'Campus vendors',
    title: 'Take pre-orders and payment proof for your campus business',
    h1: 'Take pre-orders and payment proof for your campus business',
    description:
      'One link per product: customers choose a quantity, pay you directly and upload their receipt. You get a clean order list and totals to prepare.',
    intro:
      'ClearPoint gives campus vendors a simple order link for each product. Customers see your product name, price and description, choose how many they want, pay you directly and upload their receipt. You get a list of orders and the total to prepare.',
    problems: [
      'Pre-orders arriving as messages with quantities and proof mixed together',
      'Counting how many to prepare',
      'Chasing customers for receipts',
      'Customers not knowing where to collect',
    ],
    steps: [
      { title: 'Create a link for your product', body: 'Add the product name, price and a short description, plus your account number.' },
      { title: 'Share it on your status or group', body: 'Customers choose a quantity, pick a pickup point, pay you and upload their receipt.' },
      { title: 'Check receipts and tick off', body: 'Mark each order verified or flagged, then mark it handed over.' },
      { title: 'Prepare from the pick list', body: 'See the total quantity to prepare and the number of orders per pickup point.' },
    ],
    gets: [
      'A mobile-friendly order page with your product name, price and description',
      'A quantity picker with the total worked out for the customer',
      'Pickup points chosen from your own list',
      'A pick list with quantities and revenue',
      'Receipt images that stay private to you',
    ],
    faq: [
      { q: 'Can I sell several products?', a: 'Each link sells one product. Create another link for the next product, each with its own page and order list.' },
      { q: 'Does ClearPoint hold my customers’ money?', a: 'No. Customers pay straight into your account. ClearPoint only records orders and receipts.' },
      { q: 'Do customers need an account?', a: 'No. They open the link, choose a quantity, fill in the form and upload their receipt.' },
    ],
  },
}
