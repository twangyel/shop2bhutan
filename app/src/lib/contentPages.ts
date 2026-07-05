import { supabase } from '@/lib/supabase';

export type FAQItemRecord = {
  id: string;
  category: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ContentPageSlug = 'terms' | 'privacy' | 'returns';

export type ContentPageRecord = {
  id?: string;
  slug: ContentPageSlug;
  title: string;
  content: string;
  isPublished: boolean;
  updatedAt?: string;
};

type AnyRow = Record<string, any>;

const DEFAULT_FAQS: FAQItemRecord[] = [
  {
    id: 'default-ordering-1',
    category: 'Ordering',
    question: 'How do I place an order?',
    answer:
      'You can browse the Shop2Bhutan catalog or paste a product link from supported Indian shopping sites. Add the item to your Request Bag, submit it for quotation, review the admin quote, then upload payment proof after accepting.',
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 'default-ordering-2',
    category: 'Ordering',
    question: 'Which Indian websites are supported?',
    answer:
      'Shop2Bhutan currently supports manual order requests from popular Indian sites such as Amazon India, Flipkart, Myntra, and Meesho. If automatic preview is unavailable, you can still submit the link with a screenshot.',
    sortOrder: 2,
    isActive: true,
  },
  {
    id: 'default-payment-1',
    category: 'Payment',
    question: 'What payment methods are accepted?',
    answer:
      'Available payment methods are shown in the payment screen. You can upload your transfer screenshot or payment proof after accepting a quotation.',
    sortOrder: 3,
    isActive: true,
  },
  {
    id: 'default-payment-2',
    category: 'Payment',
    question: 'Is my payment secure?',
    answer:
      'Payments are manually verified by the Shop2Bhutan admin team before order processing continues. Always upload a clear screenshot with visible amount and reference number.',
    sortOrder: 4,
    isActive: true,
  },
  {
    id: 'default-delivery-1',
    category: 'Delivery',
    question: 'How long does delivery take?',
    answer:
      'Delivery timelines depend on product availability, seller dispatch, customs/logistics, and the selected Bhutan delivery hub. The admin team updates order progress in the app.',
    sortOrder: 5,
    isActive: true,
  },
  {
    id: 'default-delivery-2',
    category: 'Delivery',
    question: 'Where can I pick up my order?',
    answer:
      'Shop2Bhutan currently focuses delivery/pickup around available hubs such as Thimphu, Phuntsholing, and Paro. Delivery options are confirmed during quotation and fulfillment.',
    sortOrder: 6,
    isActive: true,
  },
  {
    id: 'default-returns-1',
    category: 'Returns',
    question: 'Can I cancel or return an order?',
    answer:
      'Cancellation and return eligibility depends on the order stage, seller policy, and product condition. Contact support as early as possible if there is an issue.',
    sortOrder: 7,
    isActive: true,
  },
];

const DEFAULT_CONTENT: Record<ContentPageSlug, ContentPageRecord> = {
  terms: {
    slug: 'terms',
    title: 'Terms of Service',
    isPublished: true,
    content: `Welcome to Shop2Bhutan.

By using Shop2Bhutan, you agree to use the platform responsibly and provide accurate contact, delivery, and order information.

1. Service Scope
Shop2Bhutan helps customers in Bhutan request quotations and order products from supported platforms and sellers. Some products, sellers, or locations may require manual review.

2. Quotations
All quotations are prepared by the admin team based on available product price, delivery fee, service charge, and any additional charges. Prices may change if the seller price or availability changes before payment/order placement.

3. Payment
Orders are processed only after payment proof is uploaded and verified. Customers must upload a clear transaction screenshot with visible amount and reference details.

4. Delivery and Pickup
Delivery timelines are estimates and may vary due to seller dispatch, logistics, customs, weather, or route availability.

5. Customer Responsibility
Customers must ensure the requested product is correct, legal, and deliverable. Shop2Bhutan may reject or cancel requests that cannot be fulfilled.

6. Support
For account, payment, delivery, or order issues, contact Shop2Bhutan support through the app support page.`,
  },
  privacy: {
    slug: 'privacy',
    title: 'Privacy Policy',
    isPublished: true,
    content: `Shop2Bhutan respects your privacy.

1. Information We Collect
We may collect your name, phone number, email address if provided, delivery details, order information, payment proof, and support messages.

2. How We Use Information
We use this information to create your account, process quotations and orders, verify payments, provide delivery updates, and contact you about your requests.

3. Payment Proof
Payment screenshots are used only for verification and order processing. Do not upload unnecessary personal information beyond what is required to verify payment.

4. Data Access
Only authorized Shop2Bhutan admin users should access customer and order information for operational purposes.

5. Account Support
For phone-only accounts, admin-assisted password reset may be required. Reset requests may notify the admin team so they can assist you.

6. Contact
For privacy-related questions, contact Shop2Bhutan support.`,
  },
  returns: {
    slug: 'returns',
    title: 'Return Policy',
    isPublished: true,
    content: `Shop2Bhutan return and cancellation handling depends on the product, seller policy, order status, and delivery condition.

1. Before Payment
You may choose not to accept a quotation before payment. Unpaid quotation requests may be cancelled or allowed to expire.

2. After Payment Verification
After payment verification and seller order placement, cancellation may not always be possible. Any cancellation depends on seller policy and order status.

3. Damaged or Wrong Items
If an item is damaged or different from what was ordered, contact support as soon as possible with photos and order details.

4. Non-returnable Items
Some items may be non-returnable due to hygiene, medicine, perishability, seller restrictions, or other policy limitations.

5. Refunds and Adjustments
Refunds, replacements, or adjustments are reviewed case by case after verification by the Shop2Bhutan team.

6. Support
Please keep your order number, payment proof, and item photos ready when contacting support.`,
  },
};

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function errorMessage(error: unknown, fallback = 'Unexpected Supabase error.') {
  return cleanText((error as { message?: string })?.message) || fallback;
}

function isMissingTableError(error: unknown) {
  const message = errorMessage(error, '').toLowerCase();
  return (
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find') ||
    message.includes('relation') ||
    message.includes('column')
  );
}

function normalizeFaq(row: AnyRow): FAQItemRecord {
  return {
    id: cleanText(row.id),
    category: cleanText(row.category) || 'General',
    question: cleanText(row.question),
    answer: cleanText(row.answer),
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0) || 0,
    isActive: Boolean(row.is_active ?? row.isActive ?? true),
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
  };
}

function normalizeContent(row: AnyRow, fallbackSlug?: ContentPageSlug): ContentPageRecord {
  const slug = (cleanText(row.slug) || fallbackSlug || 'terms') as ContentPageSlug;
  const fallback = DEFAULT_CONTENT[slug] ?? DEFAULT_CONTENT.terms;

  return {
    id: cleanText(row.id),
    slug,
    title: cleanText(row.title) || fallback.title,
    content: cleanText(row.content) || fallback.content,
    isPublished: Boolean(row.is_published ?? row.isPublished ?? true),
    updatedAt: cleanText(row.updated_at),
  };
}

export function getDefaultFaqItems() {
  return [...DEFAULT_FAQS];
}

export function getDefaultContentPage(slug: ContentPageSlug) {
  return { ...DEFAULT_CONTENT[slug] };
}

export async function fetchPublicFaqItems(): Promise<FAQItemRecord[]> {
  const { data, error } = await supabase
    .from('faq_items')
    .select('*')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingTableError(error)) return getDefaultFaqItems();
    throw error;
  }

  const rows = (data ?? []).map((row) => normalizeFaq(row as AnyRow));
  return rows.length ? rows : getDefaultFaqItems();
}

export async function fetchAdminFaqItems(): Promise<FAQItemRecord[]> {
  const { data, error } = await supabase
    .from('faq_items')
    .select('*')
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingTableError(error)) return getDefaultFaqItems();
    throw error;
  }

  const rows = (data ?? []).map((row) => normalizeFaq(row as AnyRow));
  return rows.length ? rows : getDefaultFaqItems();
}

export async function createFaqItem(input: {
  category: string;
  question: string;
  answer: string;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const payload = {
    category: cleanText(input.category) || 'General',
    question: cleanText(input.question),
    answer: cleanText(input.answer),
    sort_order: Number(input.sortOrder ?? 0) || 0,
    is_active: input.isActive ?? true,
    updated_at: new Date().toISOString(),
  };

  if (!payload.question || !payload.answer) {
    throw new Error('Question and answer are required.');
  }

  const { error } = await supabase.from('faq_items').insert(payload);

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error('FAQ table is not ready. Please run the FAQ / Terms SQL first.');
    }
    throw error;
  }
}

export async function updateFaqItem(
  id: string,
  input: {
    category: string;
    question: string;
    answer: string;
    sortOrder?: number;
    isActive?: boolean;
  },
) {
  const cleanId = cleanText(id);
  if (!cleanId) throw new Error('FAQ ID is required.');

  const payload = {
    category: cleanText(input.category) || 'General',
    question: cleanText(input.question),
    answer: cleanText(input.answer),
    sort_order: Number(input.sortOrder ?? 0) || 0,
    is_active: input.isActive ?? true,
    updated_at: new Date().toISOString(),
  };

  if (!payload.question || !payload.answer) {
    throw new Error('Question and answer are required.');
  }

  const { error } = await supabase.from('faq_items').update(payload).eq('id', cleanId);

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error('FAQ table is not ready. Please run the FAQ / Terms SQL first.');
    }
    throw error;
  }
}

export async function deleteFaqItem(id: string) {
  const cleanId = cleanText(id);
  if (!cleanId) return;

  const { error } = await supabase.from('faq_items').delete().eq('id', cleanId);

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error('FAQ table is not ready. Please run the FAQ / Terms SQL first.');
    }
    throw error;
  }
}

export async function fetchPublicContentPage(slug: ContentPageSlug): Promise<ContentPageRecord> {
  const fallback = getDefaultContentPage(slug);

  const { data, error } = await supabase
    .from('content_pages')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return fallback;
    throw error;
  }

  return data ? normalizeContent(data as AnyRow, slug) : fallback;
}

export async function fetchAdminContentPage(slug: ContentPageSlug): Promise<ContentPageRecord> {
  const fallback = getDefaultContentPage(slug);

  const { data, error } = await supabase
    .from('content_pages')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return fallback;
    throw error;
  }

  return data ? normalizeContent(data as AnyRow, slug) : fallback;
}

export async function saveContentPage(input: ContentPageRecord) {
  const slug = input.slug;
  const fallback = getDefaultContentPage(slug);
  const payload = {
    slug,
    title: cleanText(input.title) || fallback.title,
    content: cleanText(input.content) || fallback.content,
    is_published: input.isPublished,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('content_pages')
    .upsert(payload, { onConflict: 'slug' });

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error('Content pages table is not ready. Please run the FAQ / Terms SQL first.');
    }
    throw error;
  }
}
