import { supabase } from '@/lib/supabase';
import type {
  Address,
  DeliveryHub,
  Order,
  OrderItem,
  OrderStatus,
  OrderType,
  Payment,
  PaymentStatus,
  Quotation,
  QuotationItem,
  QuotationStatus,
  User,
} from '@/types';

// Step 05 helper: customer-facing order reads + payment proof upload.
// Keep admin roles in public.user_roles untouched. This file relies on RLS so
// customers can only see/update rows allowed by your backend policies.

type AnyRow = Record<string, any>;

type RelatedRows = {
  items: AnyRow[];
  quotations: AnyRow[];
  quotationItems: AnyRow[];
  payments: AnyRow[];
};

export type PaymentProofInput = {
  order: Order;
  userId: string;
  file: File;
  paymentMethodName: string;
  transactionId: string;
  amount: number;
};

const ORDER_OWNER_COLUMNS = ['user_id', 'customer_id', 'profile_id'];
const ORDER_LOOKUP_COLUMNS = ['id', 'order_id', 'order_number'];

const PLACEHOLDER_PRODUCT_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="#f5f5f5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="16" fill="#a3a3a3">S2B</text></svg>`
  );

function isMissingColumnOrRelationError(error: unknown) {
  const message = String((error as { message?: string })?.message ?? '').toLowerCase();
  return (
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find') ||
    message.includes('column') ||
    message.includes('relationship')
  );
}

function firstValue(row: AnyRow | null | undefined, keys: string[]) {
  if (!row) return undefined;
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function firstString(row: AnyRow | null | undefined, keys: string[], fallback = '') {
  const value = firstValue(row, keys);
  return value === undefined ? fallback : String(value);
}

function firstNumber(row: AnyRow | null | undefined, keys: string[], fallback = 0) {
  const value = firstValue(row, keys);
  if (value === undefined) return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function firstJsonObject(row: AnyRow | null | undefined, keys: string[]) {
  const value = firstValue(row, keys);
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, string>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function toArray(value: unknown) {
  if (!value) return [] as unknown[];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch {
      return value
        .split('\n')
        .map((part) => part.trim())
        .filter(Boolean);
    }
  }
  return [] as unknown[];
}

export function normalizeOrderStatus(status: unknown): OrderStatus {
  const raw = String(status ?? '').toLowerCase();

  const map: Record<string, OrderStatus> = {
    pending: 'pending_confirmation',
    pending_confirmation: 'pending_confirmation',
    quotation_pending: 'quotation_pending',
    quote_pending: 'quotation_pending',
    quoted: 'quoted',
    payment_pending: 'payment_pending',
    payment_uploaded: 'payment_pending',
    payment_verified: 'payment_verified',
    confirmed: 'order_placed',
    order_placed: 'order_placed',
    ordered: 'order_placed',
    reached_jaigaon: 'in_transit',
    in_transit: 'in_transit',
    reached_phuntsholing: 'arrived_at_hub',
    arrived_at_hub: 'arrived_at_hub',
    out_for_delivery: 'out_for_delivery',
    shipped: 'out_for_delivery',
    delivered: 'delivered',
    cancelled: 'cancelled',
    canceled: 'cancelled',
  };

  return map[raw] ?? 'pending_confirmation';
}

export function normalizeQuotationStatus(status: unknown): QuotationStatus {
  const raw = String(status ?? '').toLowerCase();

  const map: Record<string, QuotationStatus> = {
    pending: 'pending',
    sent: 'sent',
    quoted: 'sent',
    approved: 'approved',
    accepted: 'approved',
    rejected: 'rejected',
    declined: 'rejected',
    expired: 'expired',
  };

  return map[raw] ?? 'pending';
}

export function normalizePaymentStatus(status: unknown): PaymentStatus {
  const raw = String(status ?? '').toLowerCase();

  const map: Record<string, PaymentStatus> = {
    pending: 'pending',
    partial: 'pending',
    uploaded: 'pending',
    verified: 'verified',
    paid: 'verified',
    approved: 'verified',
    rejected: 'rejected',
    failed: 'rejected',
  };

  return map[raw] ?? 'pending';
}

function makeFallbackUser(userId: string, email = ''): User {
  return {
    id: userId,
    name: email ? email.split('@')[0] : 'Customer',
    email,
    phone: '',
    role: 'customer',
    dzongkhag: '',
    isActive: true,
    createdAt: new Date().toISOString(),
  };
}

function makeDeliveryHub(row: AnyRow): DeliveryHub {
  const hubName = firstString(row, ['delivery_hub_name', 'hub_name', 'delivery_hub'], 'Selected Hub');
  const hubId = firstString(row, ['delivery_hub_id', 'hub_id'], 'hub1');

  return {
    id: hubId,
    name: hubName.includes('Hub') ? hubName : `${hubName} Hub`,
    dzongkhag: firstString(row, ['delivery_hub_dzongkhag', 'hub_dzongkhag', 'delivery_city'], ''),
    address: firstString(row, ['delivery_hub_address', 'hub_address'], ''),
    phone: firstString(row, ['delivery_hub_phone', 'hub_phone'], ''),
    isActive: true,
  };
}

function makeShippingAddress(row: AnyRow, userId: string): Address {
  const nested = firstJsonObject(row, ['shipping_address', 'delivery_address_json', 'address']);
  const source = { ...row, ...nested };

  return {
    id: firstString(source, ['shipping_address_id', 'address_id'], `addr-${row.id ?? 'order'}`),
    userId,
    label: firstString(source, ['address_label', 'label'], 'Delivery'),
    recipientName: firstString(source, ['recipient_name', 'delivery_name', 'customer_name', 'full_name'], 'Customer'),
    phone: firstString(source, ['recipient_phone', 'delivery_phone', 'phone', 'whatsapp'], ''),
    dzongkhag: firstString(source, ['dzongkhag', 'delivery_dzongkhag', 'delivery_city'], ''),
    gewog: firstString(source, ['gewog', 'delivery_gewog'], ''),
    village: firstString(source, ['village', 'delivery_village', 'delivery_address'], ''),
    landmark: firstString(source, ['landmark', 'delivery_landmark'], ''),
    isDefault: false,
    deliveryHubId: firstString(source, ['delivery_hub_id', 'hub_id'], 'hub1'),
  };
}

function itemBelongsToOrder(item: AnyRow, row: AnyRow) {
  const itemOrderId = String(item.order_id ?? '');
  const possibleIds = [row.id, row.order_id, row.order_number].filter(Boolean).map(String);
  return possibleIds.includes(itemOrderId);
}

function quotationBelongsToOrder(quotation: AnyRow, row: AnyRow) {
  const quotationOrderId = String(quotation.order_id ?? '');
  const possibleIds = [row.id, row.order_id, row.order_number].filter(Boolean).map(String);
  return possibleIds.includes(quotationOrderId);
}

function paymentBelongsToOrder(payment: AnyRow, row: AnyRow) {
  const paymentOrderId = String(payment.order_id ?? '');
  const possibleIds = [row.id, row.order_id, row.order_number].filter(Boolean).map(String);
  return possibleIds.includes(paymentOrderId);
}

function makeOrderItems(row: AnyRow, relatedItems: AnyRow[]): OrderItem[] {
  const mappedItems = relatedItems.map((item, index) => ({
    id: firstString(item, ['id'], `item-${row.id}-${index}`),
    productId: firstString(item, ['product_id'], ''),
    sourceUrl: firstString(item, ['source_url', 'product_url', 'url'], ''),
    sourcePlatform: firstString(item, ['source_platform', 'platform'], 'internal') as OrderItem['sourcePlatform'],
    productName: firstString(item, ['product_name', 'name', 'title'], 'Product item'),
    productImage: firstString(item, ['product_image', 'image_url', 'image', 'screenshot_url'], PLACEHOLDER_PRODUCT_IMAGE),
    quantity: firstNumber(item, ['quantity', 'qty'], 1),
    unitPrice: firstNumber(item, ['unit_price', 'price', 'quoted_price', 'product_price'], 0),
    attributes: firstJsonObject(item, ['attributes', 'selected_attributes']) as Record<string, string>,
  }));

  if (mappedItems.length > 0) return mappedItems;

  const productLinks = toArray(firstValue(row, ['product_links', 'links', 'source_urls']));
  const quantities = toArray(firstValue(row, ['quantities', 'qtys']));

  if (productLinks.length > 0) {
    return productLinks.map((link, index) => ({
      id: `item-${row.id}-${index}`,
      sourceUrl: String(link),
      sourcePlatform: 'internal',
      productName: `Product link ${index + 1}`,
      productImage: PLACEHOLDER_PRODUCT_IMAGE,
      quantity: Number(quantities[index] ?? 1) || 1,
      unitPrice: 0,
      attributes: {},
    }));
  }

  return [
    {
      id: `item-${row.id}-fallback`,
      sourceUrl: firstString(row, ['product_url', 'source_url'], ''),
      sourcePlatform: 'internal',
      productName: firstString(row, ['product_name', 'item_name', 'title'], 'Order item'),
      productImage: firstString(row, ['product_image', 'image_url', 'screenshot_url'], PLACEHOLDER_PRODUCT_IMAGE),
      quantity: firstNumber(row, ['quantity', 'qty'], 1),
      unitPrice: firstNumber(row, ['unit_price', 'product_price', 'amount'], 0),
      attributes: {},
    },
  ];
}

function makeQuotationItems(quotation: AnyRow, orderItems: OrderItem[], quotationItems: AnyRow[]): QuotationItem[] {
  const quoteId = String(quotation.id ?? '');
  const directItems = quotationItems.filter((item) => String(item.quotation_id ?? item.quote_id ?? '') === quoteId);

  if (directItems.length > 0) {
    return directItems.map((item, index) => ({
      id: firstString(item, ['id'], `quote-item-${quoteId}-${index}`),
      orderItemId: firstString(item, ['order_item_id'], orderItems[index]?.id ?? ''),
      productName: firstString(item, ['product_name', 'name', 'title'], orderItems[index]?.productName ?? 'Quoted item'),
      productImage: firstString(item, ['product_image', 'image_url', 'image'], orderItems[index]?.productImage ?? PLACEHOLDER_PRODUCT_IMAGE),
      quantity: firstNumber(item, ['quantity', 'qty'], orderItems[index]?.quantity ?? 1),
      unitPrice: firstNumber(item, ['unit_price', 'price', 'quoted_price'], orderItems[index]?.unitPrice ?? 0),
      totalPrice: firstNumber(item, ['total_price', 'line_total'], 0),
      notes: firstString(item, ['notes'], ''),
    }));
  }

  return orderItems.map((item) => ({
    id: `quote-${quoteId}-${item.id}`,
    orderItemId: item.id,
    productName: item.productName,
    productImage: item.productImage,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.unitPrice * item.quantity,
  }));
}

function makeQuotation(quotation: AnyRow | undefined, orderItems: OrderItem[], quotationItems: AnyRow[]): Quotation | undefined {
  if (!quotation) return undefined;

  const items = makeQuotationItems(quotation, orderItems, quotationItems);
  const productTotal = firstNumber(quotation, ['product_total', 'product_price', 'subtotal'], items.reduce((sum, item) => sum + item.totalPrice, 0));
  const serviceCharge = firstNumber(quotation, ['service_charge', 'service_fee'], 0);
  const deliveryFee = firstNumber(quotation, ['delivery_fee', 'shipping_fee'], 0);
  const taxAmount = firstNumber(quotation, ['tax_amount', 'tax'], 0);
  const totalAmount = firstNumber(quotation, ['total_amount', 'total'], productTotal + serviceCharge + deliveryFee + taxAmount);

  return {
    id: firstString(quotation, ['id'], ''),
    orderId: firstString(quotation, ['order_id'], ''),
    status: normalizeQuotationStatus(firstValue(quotation, ['status'])),
    items,
    productTotal,
    serviceCharge,
    deliveryFee,
    taxAmount,
    totalAmount,
    validUntil: firstString(quotation, ['valid_until', 'expires_at'], ''),
    notes: firstString(quotation, ['notes'], ''),
    createdAt: firstString(quotation, ['created_at'], ''),
    respondedAt: firstString(quotation, ['responded_at', 'updated_at'], ''),
  };
}

function makePayment(payment: AnyRow | undefined): Payment | undefined {
  if (!payment) return undefined;

  return {
    id: firstString(payment, ['id'], ''),
    orderId: firstString(payment, ['order_id'], ''),
    amount: firstNumber(payment, ['amount', 'total_amount', 'advance_paid'], 0),
    method: firstString(payment, ['method', 'payment_method'], ''),
    transactionId: firstString(payment, ['transaction_id', 'reference_id', 'txn_id'], ''),
    screenshotUrl: firstString(payment, ['screenshot_url', 'payment_proof_url', 'proof_url'], ''),
    status: normalizePaymentStatus(firstValue(payment, ['status'])),
    verifiedBy: firstString(payment, ['verified_by'], ''),
    verifiedAt: firstString(payment, ['verified_at'], ''),
    notes: firstString(payment, ['notes'], ''),
    createdAt: firstString(payment, ['created_at'], ''),
  };
}

function mapOrderRow(row: AnyRow, related: RelatedRows, authUserId: string, authEmail = ''): Order {
  const items = makeOrderItems(row, related.items.filter((item) => itemBelongsToOrder(item, row)));
  const quotationRow = related.quotations.find((quotation) => quotationBelongsToOrder(quotation, row));
  const paymentRow = related.payments.find((payment) => paymentBelongsToOrder(payment, row));
  const customerId = firstString(row, ORDER_OWNER_COLUMNS, authUserId);

  return {
    id: firstString(row, ['id'], ''),
    orderNumber: firstString(row, ['order_number', 'order_id', 'public_id'], firstString(row, ['id'], '').slice(0, 8).toUpperCase()),
    userId: customerId,
    user: makeFallbackUser(customerId, authEmail),
    items,
    status: normalizeOrderStatus(firstValue(row, ['status', 'order_status'])),
    type: firstString(row, ['type', 'order_type'], 'paste_link') as OrderType,
    deliveryHubId: firstString(row, ['delivery_hub_id', 'hub_id'], 'hub1'),
    deliveryHub: makeDeliveryHub(row),
    shippingAddress: makeShippingAddress(row, customerId),
    quotation: makeQuotation(quotationRow, items, related.quotationItems),
    payment: makePayment(paymentRow),
    notes: firstString(row, ['notes', 'customer_notes'], ''),
    createdAt: firstString(row, ['created_at'], ''),
    updatedAt: firstString(row, ['updated_at'], firstString(row, ['created_at'], '')),
  };
}

async function safeSelectIn(table: string, column: string, values: string[]) {
  const cleanValues = values.filter(Boolean);
  if (cleanValues.length === 0) return [] as AnyRow[];

  const { data, error } = await supabase.from(table).select('*').in(column, cleanValues);

  if (error) {
    if (!isMissingColumnOrRelationError(error)) {
      console.warn(`[customerOrders] ${table} lookup skipped:`, error);
    }
    return [] as AnyRow[];
  }

  return (data ?? []) as AnyRow[];
}

async function fetchRelatedRows(orderRows: AnyRow[]): Promise<RelatedRows> {
  const dbIds = orderRows.map((row) => String(row.id ?? '')).filter(Boolean);
  const publicIds = orderRows
    .flatMap((row) => [row.order_id, row.order_number, row.public_id])
    .filter(Boolean)
    .map(String);

  const itemsByDbId = await safeSelectIn('order_items', 'order_id', dbIds);

  let quotations = await safeSelectIn('quotations', 'order_id', dbIds);
  if (quotations.length === 0 && publicIds.length > 0) {
    quotations = await safeSelectIn('quotations', 'order_id', publicIds);
  }

  let payments = await safeSelectIn('payments', 'order_id', dbIds);
  if (payments.length === 0 && publicIds.length > 0) {
    payments = await safeSelectIn('payments', 'order_id', publicIds);
  }

  const quotationIds = quotations.map((quote) => String(quote.id ?? '')).filter(Boolean);
  const quotationItems = await safeSelectIn('quotation_items', 'quotation_id', quotationIds);

  return {
    items: itemsByDbId,
    quotations,
    quotationItems,
    payments,
  };
}

async function queryCustomerOrderRows(userId: string) {
  let lastError: unknown = null;

  for (const ownerColumn of ORDER_OWNER_COLUMNS) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq(ownerColumn, userId)
      .order('created_at', { ascending: false });

    if (!error) return (data ?? []) as AnyRow[];

    lastError = error;
    if (!isMissingColumnOrRelationError(error)) {
      console.warn(`[customerOrders] orders.${ownerColumn} lookup failed, trying fallback:`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to load customer orders.');
}

async function querySingleOrderRow(orderIdOrNumber: string, userId: string) {
  let lastError: unknown = null;

  for (const lookupColumn of ORDER_LOOKUP_COLUMNS) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq(lookupColumn, orderIdOrNumber)
      .maybeSingle();

    if (!error && data) {
      const ownerValue = firstString(data as AnyRow, ORDER_OWNER_COLUMNS, '');
      if (ownerValue && ownerValue !== userId) {
        throw new Error('Order not found.');
      }
      return data as AnyRow;
    }

    if (!error && !data) continue;

    lastError = error;
    if (!isMissingColumnOrRelationError(error)) {
      console.warn(`[customerOrders] orders.${lookupColumn} lookup failed, trying fallback:`, error);
    }
  }

  if (lastError && !isMissingColumnOrRelationError(lastError)) throw lastError;
  return null;
}

export async function fetchCustomerOrders(userId: string, email = '') {
  if (!userId) return [] as Order[];

  const rows = await queryCustomerOrderRows(userId);
  const related = await fetchRelatedRows(rows);

  return rows.map((row) => mapOrderRow(row, related, userId, email));
}

export async function fetchCustomerOrderById(orderIdOrNumber: string, userId: string, email = '') {
  if (!orderIdOrNumber || !userId) return null;

  const row = await querySingleOrderRow(orderIdOrNumber, userId);
  if (!row) return null;

  const related = await fetchRelatedRows([row]);
  return mapOrderRow(row, related, userId, email);
}

export async function updateQuotationStatus(quotationId: string, status: QuotationStatus) {
  const { error } = await supabase
    .from('quotations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', quotationId);

  if (error) throw error;
}

export async function updateCustomerOrderStatus(orderId: string, status: OrderStatus) {
  const standard = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (!standard.error) return;

  const legacy = await supabase
    .from('orders')
    .update({ order_status: status, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (legacy.error) throw standard.error;
}

function makeStoragePath(userId: string, orderId: string, file: File) {
  const rawExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const ext = rawExt.replace(/[^a-z0-9]/g, '') || 'jpg';
  return `${userId}/${orderId}/payment-${Date.now()}.${ext}`;
}

async function findExistingPayment(order: Order) {
  if (order.payment?.id) return order.payment;

  const dbLookup = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', order.id)
    .maybeSingle();

  if (!dbLookup.error && dbLookup.data) return makePayment(dbLookup.data as AnyRow);

  const publicLookup = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', order.orderNumber)
    .maybeSingle();

  if (!publicLookup.error && publicLookup.data) return makePayment(publicLookup.data as AnyRow);

  return undefined;
}

export async function submitCustomerPaymentProof(input: PaymentProofInput) {
  const { order, userId, file, paymentMethodName, transactionId, amount } = input;
  const path = makeStoragePath(userId, order.id, file);

  const { error: uploadError } = await supabase.storage.from('order-screenshots').upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });

  if (uploadError) throw uploadError;

  const existingPayment = await findExistingPayment(order);
  const basePayload = {
    order_id: order.id,
    amount,
    method: paymentMethodName,
    transaction_id: transactionId,
    screenshot_url: path,
    status: 'pending' as PaymentStatus,
    notes: `Uploaded by customer. Storage bucket: order-screenshots. Path: ${path}`,
  };

  if (existingPayment?.id) {
    const { error } = await supabase.from('payments').update(basePayload).eq('id', existingPayment.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('payments').insert(basePayload);
    if (error) {
      const legacyPayload = {
        order_id: order.orderNumber,
        total_amount: amount,
        payment_method: paymentMethodName,
        payment_proof_url: path,
        status: 'pending',
        updated_at: new Date().toISOString(),
      };

      const legacy = await supabase.from('payments').insert(legacyPayload);
      if (legacy.error) throw error;
    }
  }

  if (order.quotation?.id) {
    try {
      await updateQuotationStatus(order.quotation.id, 'approved');
    } catch (error) {
      console.warn('[customerOrders] quotation status update skipped:', error);
    }
  }

  try {
    await updateCustomerOrderStatus(order.id, 'payment_pending');
  } catch (error) {
    console.warn('[customerOrders] order status update skipped:', error);
  }

  return { path };
}
