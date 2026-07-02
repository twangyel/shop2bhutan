import { supabase } from '@/lib/supabase'
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
} from '@/types'

// Step 05 helper: customer-facing order reads + payment proof upload.
// Keep admin roles in public.user_roles untouched. This file relies on RLS so
// customers can only see/update rows allowed by your backend policies.

type AnyRow = Record<string, any>

type RelatedRows = {
  items: AnyRow[]
  quotations: AnyRow[]
  quotationItems: AnyRow[]
  payments: AnyRow[]
}

export type PaymentProofInput = {
  order: Order
  userId: string
  file: File
  paymentMethodName: string
  transactionId: string
  amount: number
}

const ORDER_OWNER_COLUMNS = ['user_id', 'customer_id', 'profile_id']
const PLACEHOLDER_PRODUCT_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="#f5f5f5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="16" fill="#a3a3a3">S2B</text></svg>`
  )

function isMissingColumnOrRelationError(error: unknown) {
  const message = String((error as { message?: string })?.message ?? '').toLowerCase()
  return (
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find') ||
    message.includes('column') ||
    message.includes('relationship')
  )
}

function firstValue(row: AnyRow | null | undefined, keys: string[]) {
  if (!row) return undefined
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

function firstString(row: AnyRow | null | undefined, keys: string[], fallback = '') {
  const value = firstValue(row, keys)
  return value === undefined ? fallback : String(value)
}

function firstNumber(row: AnyRow | null | undefined, keys: string[], fallback = 0) {
  const value = firstValue(row, keys)
  if (value === undefined) return fallback
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function firstJsonObject(row: AnyRow | null | undefined, keys: string[]) {
  const value = firstValue(row, keys)
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, string>
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

function toArray(value: unknown) {
  if (!value) return [] as unknown[]
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : [value]
    } catch {
      return value
        .split('\n')
        .map((part) => part.trim())
        .filter(Boolean)
    }
  }
  return [] as unknown[]
}

export function normalizeOrderStatus(status: unknown): OrderStatus {
  const raw = String(status ?? '').toLowerCase()

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
  }

  return map[raw] ?? 'pending_confirmation'
}

export function normalizeQuotationStatus(status: unknown): QuotationStatus {
  const raw = String(status ?? '').toLowerCase()

  const map: Record<string, QuotationStatus> = {
    pending: 'pending',
    sent: 'sent',
    quoted: 'sent',
    approved: 'approved',
    accepted: 'approved',
    rejected: 'rejected',
    declined: 'rejected',
    expired: 'expired',
  }

  return map[raw] ?? 'pending'
}

export function normalizePaymentStatus(status: unknown): PaymentStatus {
  const raw = String(status ?? '').toLowerCase()

  const map: Record<string, PaymentStatus> = {
    pending: 'pending',
    pending_verification: 'pending',
    partial: 'pending',
    uploaded: 'pending',
    verified: 'verified',
    paid: 'verified',
    approved: 'verified',
    rejected: 'rejected',
    failed: 'rejected',
  }

  return map[raw] ?? 'pending'
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
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
  }
}

function makeDeliveryHub(row: AnyRow): DeliveryHub {
  const hubName = firstString(row, ['delivery_hub_name', 'hub_name', 'delivery_hub'], 'Selected Hub')
  const hubId = firstString(row, ['delivery_hub_id', 'hub_id'], 'hub1')

  return {
    id: hubId,
    name: hubName.includes('Hub') ? hubName : `${hubName} Hub`,
    dzongkhag: firstString(row, ['delivery_hub_dzongkhag', 'hub_dzongkhag', 'delivery_city'], ''),
    address: firstString(row, ['delivery_hub_address', 'hub_address'], ''),
    phone: firstString(row, ['delivery_hub_phone', 'hub_phone'], ''),
    isActive: true,
  }
}

function makeShippingAddress(row: AnyRow, userId: string): Address {
  const nested = firstJsonObject(row, ['shipping_address', 'delivery_address_json', 'address'])
  const source = { ...row, ...nested }

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
  }
}

function itemBelongsToOrder(item: AnyRow, row: AnyRow) {
  return String(item.order_id ?? '') === String(row.id ?? '')
}

function quotationBelongsToOrder(quotation: AnyRow, row: AnyRow) {
  return String(quotation.order_id ?? '') === String(row.id ?? '')
}

function paymentBelongsToOrder(payment: AnyRow, row: AnyRow) {
  return String(payment.order_id ?? '') === String(row.id ?? '')
}

function makeOrderItems(row: AnyRow, relatedItems: AnyRow[]): OrderItem[] {
  const mappedItems = relatedItems.map((item, index) => ({
    id: firstString(item, ['id'], `item-${row.id}-${index}`),
    productId: firstString(item, ['product_id'], ''),
    sourceUrl: firstString(item, ['source_url', 'product_url', 'url'], ''),
    sourcePlatform: firstString(item, ['source_platform', 'platform'], 'internal') as OrderItem['sourcePlatform'],
    productName: firstString(item, ['title_snapshot', 'product_name', 'item_name', 'name', 'title'], 'Product item'),
    productImage: firstString(item, ['image_path', 'attachment_path', 'product_image', 'image_url', 'image', 'screenshot_url'], PLACEHOLDER_PRODUCT_IMAGE),
    quantity: firstNumber(item, ['quantity', 'qty'], 1),
    unitPrice: firstNumber(item, ['quoted_unit_price', 'estimated_price', 'unit_price', 'price', 'quoted_price', 'product_price'], 0),
    attributes: firstJsonObject(item, ['attributes', 'selected_attributes']) as Record<string, string>,
  }))

  if (mappedItems.length > 0) return mappedItems

  const productLinks = toArray(firstValue(row, ['product_links', 'links', 'source_urls']))
  const quantities = toArray(firstValue(row, ['quantities', 'qtys']))

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
    }))
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
  ]
}

function makeQuotationItems(quotation: AnyRow, orderItems: OrderItem[], quotationItems: AnyRow[]): QuotationItem[] {
  const quoteId = String(quotation.id ?? '')
  const directItems = quotationItems.filter((item) => String(item.quotation_id ?? item.quote_id ?? '') === quoteId)

  if (directItems.length > 0) {
    return directItems.map((item, index) => ({
      id: firstString(item, ['id'], `quote-item-${quoteId}-${index}`),
      orderItemId: firstString(item, ['order_item_id'], orderItems[index]?.id ?? ''),
      productName: firstString(item, ['item_name', 'product_name', 'name', 'title'], orderItems[index]?.productName ?? 'Quoted item'),
      productImage: firstString(item, ['product_image', 'image_url', 'image'], orderItems[index]?.productImage ?? PLACEHOLDER_PRODUCT_IMAGE),
      quantity: firstNumber(item, ['quantity', 'qty'], orderItems[index]?.quantity ?? 1),
      unitPrice: firstNumber(item, ['unit_price', 'price', 'quoted_price'], orderItems[index]?.unitPrice ?? 0),
      totalPrice: firstNumber(item, ['total_price', 'line_total'], 0),
      notes: firstString(item, ['notes'], ''),
    }))
  }

  return orderItems.map((item) => ({
    id: `quote-${quoteId}-${item.id}`,
    orderItemId: item.id,
    productName: item.productName,
    productImage: item.productImage,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.unitPrice * item.quantity,
  }))
}

function makeQuotation(quotation: AnyRow | undefined, orderItems: OrderItem[], quotationItems: AnyRow[]): Quotation | undefined {
  if (!quotation) return undefined

  const items = makeQuotationItems(quotation, orderItems, quotationItems)
  const productTotal = firstNumber(quotation, ['product_subtotal', 'product_total', 'product_price', 'subtotal'], items.reduce((sum, item) => sum + item.totalPrice, 0))
  const serviceCharge = firstNumber(quotation, ['service_charge', 'service_fee'], 0)
  const deliveryFee = firstNumber(quotation, ['delivery_fee', 'shipping_fee'], 0)
  const taxAmount = firstNumber(quotation, ['tax_amount', 'tax'], 0)
  const totalAmount = firstNumber(quotation, ['total_amount', 'total'], productTotal + serviceCharge + deliveryFee + taxAmount)

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
  }
}

function makePayment(payment: AnyRow | undefined): Payment | undefined {
  if (!payment) return undefined

  return {
    id: firstString(payment, ['id'], ''),
    orderId: firstString(payment, ['order_id'], ''),
    amount: firstNumber(payment, ['amount', 'total_amount', 'advance_paid'], 0),
    method: firstString(payment, ['method', 'payment_method'], ''),
    transactionId: firstString(payment, ['transaction_id', 'reference_id', 'txn_id'], ''),
    screenshotUrl: firstString(payment, ['proof_file_path', 'screenshot_url', 'payment_proof_url', 'proof_url'], ''),
    status: normalizePaymentStatus(firstValue(payment, ['status'])),
    verifiedBy: firstString(payment, ['verified_by'], ''),
    verifiedAt: firstString(payment, ['verified_at'], ''),
    notes: firstString(payment, ['notes'], ''),
    createdAt: firstString(payment, ['created_at'], ''),
  }
}

function mapOrderRow(row: AnyRow, related: RelatedRows, authUserId: string, authEmail = ''): Order {
  const items = makeOrderItems(row, related.items.filter((item) => itemBelongsToOrder(item, row)))
  const quotationRow = related.quotations.find((quotation) => quotationBelongsToOrder(quotation, row))
  const paymentRow = related.payments.find((payment) => paymentBelongsToOrder(payment, row))
  const customerId = firstString(row, ORDER_OWNER_COLUMNS, authUserId)

  return {
    id: firstString(row, ['id'], ''),
    orderNumber: firstString(row, ['order_no', 'order_number', 'order_id', 'public_id'], firstString(row, ['id'], '').slice(0, 8).toUpperCase()),
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
  }
}

async function safeSelectIn(table: string, column: string, values: string[]) {
  const cleanValues = values.filter(Boolean)
  if (cleanValues.length === 0) return [] as AnyRow[]

  const { data, error } = await supabase.from(table).select('*').in(column, cleanValues)

  if (error) {
    if (!isMissingColumnOrRelationError(error)) {
      console.warn(`[customerOrders] ${table} lookup skipped:`, error)
    }
    return [] as AnyRow[]
  }

  return (data ?? []) as AnyRow[]
}

async function fetchRelatedRows(orderRows: AnyRow[]): Promise<RelatedRows> {
  const dbIds = orderRows.map((row) => String(row.id ?? '')).filter(Boolean)

  const itemsByDbId = await safeSelectIn('order_items', 'order_id', dbIds)
  const quotations = await safeSelectIn('quotations', 'order_id', dbIds)
  const payments = await safeSelectIn('payments', 'order_id', dbIds)

  const quotationIds = quotations.map((quote) => String(quote.id ?? '')).filter(Boolean)
  const quotationItems = await safeSelectIn('quotation_items', 'quotation_id', quotationIds)

  return {
    items: itemsByDbId,
    quotations,
    quotationItems,
    payments,
  }
}

async function queryCustomerOrderRows(userId: string) {
  let lastError: unknown = null

  for (const ownerColumn of ORDER_OWNER_COLUMNS) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq(ownerColumn, userId)
      .order('created_at', { ascending: false })

    if (!error) return (data ?? []) as AnyRow[]

    lastError = error
    if (!isMissingColumnOrRelationError(error)) {
      console.warn(`[customerOrders] orders.${ownerColumn} lookup failed, trying fallback:`, error)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to load customer orders.')
}

async function querySingleOrderRow(orderIdOrNumber: string, userId: string) {
  const lookupColumns = isUuidLike(orderIdOrNumber) ? ['id'] : ['order_no']

  let lastError: unknown = null

  for (const lookupColumn of lookupColumns) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq(lookupColumn, orderIdOrNumber)
      .maybeSingle()

    if (!error && data) {
      const ownerValue = firstString(data as AnyRow, ORDER_OWNER_COLUMNS, '')
      if (ownerValue && ownerValue !== userId) {
        throw new Error('Order not found.')
      }
      return data as AnyRow
    }

    if (!error && !data) continue

    lastError = error
    if (!isMissingColumnOrRelationError(error)) {
      console.warn(`[customerOrders] orders.${lookupColumn} lookup failed, trying fallback:`, error)
    }
  }

  if (lastError && !isMissingColumnOrRelationError(lastError)) throw lastError
  return null
}

export async function fetchCustomerOrders(userId: string, email = '') {
  if (!userId) return [] as Order[]

  const rows = await queryCustomerOrderRows(userId)
  const related = await fetchRelatedRows(rows)

  return rows.map((row) => mapOrderRow(row, related, userId, email))
}

export async function fetchCustomerOrderById(orderIdOrNumber: string, userId: string, email = '') {
  if (!orderIdOrNumber || !userId) return null

  const row = await querySingleOrderRow(orderIdOrNumber, userId)
  if (!row) return null

  const related = await fetchRelatedRows([row])
  return mapOrderRow(row, related, userId, email)
}

export async function updateQuotationStatus(quotationId: string, status: QuotationStatus) {
  const { error } = await supabase
    .from('quotations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', quotationId)

  if (error) throw error
}

export async function updateCustomerOrderStatus(orderId: string, status: OrderStatus) {
  const standard = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  if (!standard.error) return

  const legacy = await supabase
    .from('orders')
    .update({ order_status: status, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  if (legacy.error) throw standard.error
}

function makeStoragePath(userId: string, orderId: string, file: File) {
  const rawExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const ext = rawExt.replace(/[^a-z0-9]/g, '') || 'jpg'
  return `${userId}/${orderId}/payment-${Date.now()}.${ext}`
}

async function findExistingPayment(order: Order) {
  if (order.payment?.id) return order.payment

  const dbLookup = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', order.id)
    .maybeSingle()

  if (!dbLookup.error && dbLookup.data) return makePayment(dbLookup.data as AnyRow)

  return undefined
}

function paymentMethodToDbValue(paymentMethodName: string) {
  const raw = paymentMethodName.toLowerCase()
  if (raw.includes('wallet') || raw.includes('mbo') || raw.includes('mpay') || raw.includes('mobile')) {
    return 'mobile_wallet'
  }
  if (raw.includes('bank') || raw.includes('transfer') || raw.includes('bob') || raw.includes('bnb') || raw.includes('tbank')) {
    return 'bank_transfer'
  }
  return 'other'
}

async function insertPaymentWithKnownSchema(payload: {
  orderId: string
  quotationId?: string
  userId: string
  amount: number
  paymentMethodName: string
  transactionId: string
  path: string
}) {
  const paymentTypeCandidates = ['full', 'advance', 'partial', 'balance', 'deposit', 'confirm_later']
  let lastError: unknown = null

  for (const paymentType of paymentTypeCandidates) {
    const { error } = await supabase.from('payments').insert({
      order_id: payload.orderId,
      quotation_id: payload.quotationId || null,
      user_id: payload.userId,
      payment_type: paymentType,
      payment_method: paymentMethodToDbValue(payload.paymentMethodName),
      amount: payload.amount,
      currency: 'BTN',
      proof_file_path: payload.path,
      admin_notes: `Customer reference: ${payload.transactionId}. Customer selected method: ${payload.paymentMethodName}`,
    })

    if (!error) return
    lastError = error
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to create payment row. Check public.payment_type enum values.')
}

export async function submitCustomerPaymentProof(input: PaymentProofInput) {
  const { order, userId, file, paymentMethodName, transactionId, amount } = input
  const path = makeStoragePath(userId, order.id, file)

  const { error: uploadError } = await supabase.storage.from('order-screenshots').upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || 'image/jpeg',
    upsert: false,
  })

  if (uploadError) throw uploadError

  try {
    const existingPayment = await findExistingPayment(order)

    if (existingPayment?.id) {
      const { error } = await supabase
        .from('payments')
        .update({
          amount,
          payment_method: paymentMethodToDbValue(paymentMethodName),
          proof_file_path: path,
          admin_notes: `Customer reference: ${transactionId}. Customer selected method: ${paymentMethodName}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPayment.id)

      if (error) throw error
    } else {
      await insertPaymentWithKnownSchema({
        orderId: order.id,
        quotationId: order.quotation?.id,
        userId,
        amount,
        paymentMethodName,
        transactionId,
        path,
      })
    }
  } catch (error) {
    await supabase.storage.from('order-screenshots').remove([path])
    throw error
  }

  if (order.quotation?.id) {
    try {
      await updateQuotationStatus(order.quotation.id, 'approved')
    } catch (error) {
      console.warn('[customerOrders] quotation status update skipped:', error)
    }
  }

  try {
    await updateCustomerOrderStatus(order.id, 'payment_pending')
  } catch (error) {
    console.warn('[customerOrders] order status update skipped:', error)
  }

  return { path }
}


// ============ Step 06C: Product-link preview + paste-link customer order creation ============

export type ProductLinkPreview = {
  url: string
  platform: string
  title: string
  image?: string
  price?: number
  currency?: string
  fetched: boolean
  message?: string
}

export type PasteLinkOrderItemInput = {
  sourceUrl?: string
  sourcePlatform?: string
  productName?: string
  productImage?: string
  price?: number
  quantity?: number
  notes?: string
  screenshotFile?: File
  attachmentPath?: string
}

export type SubmitPasteLinkOrderInput = {
  userId: string
  email?: string | null
  customerName: string
  customerPhone: string
  deliveryAddress?: string | null
  customerNotes?: string | null
  items: PasteLinkOrderItemInput[]
}

export type SubmitPasteLinkOrderResult = {
  orderId: string
  orderNo: string
}

function cleanText(value: unknown) {
  return String(value ?? '').trim()
}

export function normalizeProductUrl(value: string) {
  const trimmed = cleanText(value)
  if (!trimmed) return ''

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const url = new URL(withProtocol)
    return url.toString()
  } catch {
    return ''
  }
}

export function detectSourcePlatformFromUrl(url: string) {
  const raw = String(url ?? '').toLowerCase()

  if (raw.includes('amazon.')) return 'amazon'
  if (raw.includes('flipkart.')) return 'flipkart'
  if (raw.includes('myntra.')) return 'myntra'
  if (raw.includes('meesho.')) return 'meesho'

  return 'other'
}

function platformToDbValue(platformOrUrl: string | undefined) {
  const raw = String(platformOrUrl ?? '').toLowerCase()

  if (raw === 'amazon' || raw.includes('amazon.')) return 'amazon'
  if (raw === 'flipkart' || raw.includes('flipkart.')) return 'flipkart'
  if (raw === 'myntra' || raw.includes('myntra.')) return 'myntra'
  if (raw === 'meesho' || raw.includes('meesho.')) return 'meesho'

  return 'other'
}

function productNameFromPlatform(platform: string) {
  if (!platform || platform === 'other') return 'Pasted product link'
  return `Product from ${platform.charAt(0).toUpperCase()}${platform.slice(1)}`
}

function fallbackProductPreview(url: string, message?: string): ProductLinkPreview {
  const normalizedUrl = normalizeProductUrl(url) || cleanText(url)
  const platform = detectSourcePlatformFromUrl(normalizedUrl)

  return {
    url: normalizedUrl,
    platform,
    title: productNameFromPlatform(platform),
    fetched: false,
    message: message || 'We could not auto-detect product details. You can still continue — Shop2Bhutan will verify the item before quotation.',
  }
}

function pickPreviewObject(raw: AnyRow): AnyRow {
  // Accept all common Edge Function response contracts:
  // {title,image,price}, {preview:{...}}, {product:{...}}, {data:{...}}, or {ok:true, product:{...}}.
  const candidates = [raw.preview, raw.product, raw.item, raw.data, raw.result, raw]

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate as AnyRow
    }
  }

  return raw
}

function parsePreviewPrice(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : undefined
  }

  const clean = String(value ?? '')
    .replace(/,/g, '')
    .replace(/[^0-9.]/g, '')

  const numeric = Number(clean)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined
}

function normalizePreviewPayload(payload: unknown, requestedUrl: string): ProductLinkPreview {
  const raw = (payload ?? {}) as AnyRow
  const preview = pickPreviewObject(raw)

  const rawUrl =
    preview.url ||
    preview.sourceUrl ||
    preview.productUrl ||
    preview.link ||
    raw.url ||
    requestedUrl

  const normalizedUrl = normalizeProductUrl(String(rawUrl ?? requestedUrl)) || requestedUrl
  const platform =
    cleanText(preview.platform || preview.sourcePlatform || raw.platform) ||
    detectSourcePlatformFromUrl(normalizedUrl)

  const title =
    cleanText(
      preview.title ||
        preview.name ||
        preview.productName ||
        preview.product_title ||
        preview.item_name ||
        raw.title ||
        raw.name
    ) || productNameFromPlatform(platform)

  const image = cleanText(
    preview.image ||
      preview.imageUrl ||
      preview.image_url ||
      preview.productImage ||
      preview.thumbnail ||
      preview.thumbnailUrl ||
      raw.image ||
      raw.imageUrl
  )

  const price = parsePreviewPrice(
    preview.price ||
      preview.amount ||
      preview.currentPrice ||
      preview.current_price ||
      preview.salePrice ||
      preview.sale_price ||
      preview.mrp ||
      raw.price ||
      raw.amount
  )

  const fetchedFlag = preview.fetched ?? raw.fetched ?? raw.ok ?? raw.success
  const fetched =
    typeof fetchedFlag === 'boolean'
      ? fetchedFlag
      : Boolean(title && title !== productNameFromPlatform(platform)) || Boolean(image) || Boolean(price)

  return {
    url: normalizedUrl,
    platform,
    title,
    image: image || undefined,
    price,
    currency: cleanText(preview.currency || preview.priceCurrency || raw.currency) || undefined,
    fetched,
    message: cleanText(preview.message || raw.message || raw.error),
  }
}

export async function fetchProductLinkPreview(url: string): Promise<ProductLinkPreview> {
  const normalizedUrl = normalizeProductUrl(url)

  if (!normalizedUrl) {
    return fallbackProductPreview(url, 'Please enter a valid product URL.')
  }

  try {
    const invokePromise = supabase.functions.invoke('product-link-preview', {
      body: { url: normalizedUrl },
    })

    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) => {
      window.setTimeout(() => {
        resolve({
          data: null,
          error: new Error('Auto-fetch timed out. You can still continue — Shop2Bhutan will verify the item before quotation.'),
        })
      }, 8000)
    })

    const { data, error } = await Promise.race([invokePromise, timeoutPromise])

    if (error) {
      console.warn('[customerOrders] product preview fallback:', error)
      return fallbackProductPreview(
        normalizedUrl,
        error.message || 'Auto-fetch is not available right now. You can still continue — Shop2Bhutan will verify the item before quotation.'
      )
    }

    const preview = normalizePreviewPayload(data, normalizedUrl)

    return {
      ...preview,
      title: preview.title || productNameFromPlatform(preview.platform),
      message:
        preview.message ||
        (preview.fetched
          ? ''
          : 'Product details were not detected. Shop2Bhutan will verify the product manually before quotation.'),
    }
  } catch (error) {
    console.warn('[customerOrders] product preview failed:', error)
    return fallbackProductPreview(normalizedUrl)
  }
}

function isEnumError(error: unknown) {
  const message = String((error as { message?: string })?.message ?? '').toLowerCase()
  return (
    message.includes('invalid input value for enum') ||
    message.includes('violates check constraint') ||
    message.includes('not present in enum')
  )
}

async function insertPasteLinkOrderRow(input: SubmitPasteLinkOrderInput) {
  const orderTypeCandidates = ['paste_link', 'external_link', 'link_order']

  let lastError: unknown = null

  for (const orderType of orderTypeCandidates) {
    const { data, error } = await supabase
      .from('orders')
      .insert({
        user_id: input.userId,
        order_type: orderType,
        customer_name: cleanText(input.customerName),
        customer_phone: cleanText(input.customerPhone),
        customer_email: cleanText(input.email),
        delivery_address: cleanText(input.deliveryAddress) || null,
        customer_notes: cleanText(input.customerNotes) || null,
      })
      .select('id, order_no')
      .single()

    if (!error && data) {
      return data as { id: string; order_no: string | null }
    }

    lastError = error

    if (error && !isEnumError(error)) {
      throw error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to create paste-link order.')
}

function makeOrderItemPayloads(params: {
  orderId: string
  itemType: string
  items: PasteLinkOrderItemInput[]
  forceOtherPlatform?: boolean
}) {
  return params.items.map((item) => {
    const sourceUrl = normalizeProductUrl(item.sourceUrl || '') || cleanText(item.sourceUrl) || ''
    const detectedPlatform = detectSourcePlatformFromUrl(sourceUrl)
    const dbPlatform = params.forceOtherPlatform
      ? 'other'
      : platformToDbValue(item.sourcePlatform || detectedPlatform || sourceUrl)

    const quantity = Number(item.quantity ?? 1)
    const price = Number(item.price ?? 0)
    const itemNotes = cleanText(item.notes)

    return {
      order_id: params.orderId,
      item_type: params.itemType,
      source_platform: dbPlatform,
      source_url: sourceUrl,
      title_snapshot:
        cleanText(item.productName) ||
        (item.screenshotFile ? 'Screenshot product request' : productNameFromPlatform(dbPlatform)),
      image_path: cleanText(item.productImage) || null,
      attachment_path: cleanText(item.attachmentPath) || null,
      variant_text: itemNotes || null,
      quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
      customer_notes: itemNotes || null,
      estimated_price: Number.isFinite(price) && price > 0 ? price : null,
    }
  })
}

async function insertPasteLinkOrderItems(orderId: string, items: PasteLinkOrderItemInput[]) {
  const itemTypeCandidates = ['paste_link', 'external_link', 'link', 'other']

  let lastError: unknown = null

  for (const forceOtherPlatform of [false, true]) {
    for (const itemType of itemTypeCandidates) {
      const payloads = makeOrderItemPayloads({
        orderId,
        itemType,
        items,
        forceOtherPlatform,
      })

      const { error } = await supabase.from('order_items').insert(payloads)

      if (!error) return

      lastError = error

      if (error && !isEnumError(error)) {
        throw error
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to create paste-link order items.')
}

async function uploadOrderItemScreenshots(
  userId: string,
  orderId: string,
  items: PasteLinkOrderItemInput[]
): Promise<string[]> {
  const uploadedPaths: string[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item.screenshotFile) continue

    const rawExt = item.screenshotFile.name.split('.').pop()?.toLowerCase() || 'jpg'
    const ext = rawExt.replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `${userId}/${orderId}/request-item-${i + 1}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('order-screenshots')
      .upload(path, item.screenshotFile, {
        cacheControl: '3600',
        contentType: item.screenshotFile.type || 'image/jpeg',
        upsert: false,
      })

    if (uploadError) {
      console.warn(`[customerOrders] Screenshot upload failed for item ${i + 1}:`, uploadError)
      continue
    }

    uploadedPaths.push(path)
    items[i] = { ...item, attachmentPath: path }
  }

  return uploadedPaths
}

async function addCustomerSubmittedTrackingEvent(orderId: string, userId: string) {
  const statusCandidates = ['pending', 'pending_confirmation']

  for (const status of statusCandidates) {
    const { error } = await supabase.from('tracking_events').insert({
      order_id: orderId,
      status,
      title: 'Order submitted',
      message: 'Your paste-link order request has been received by Shop2Bhutan.',
      location: 'Online',
      visible_to_customer: true,
      created_by: userId,
    })

    if (!error) return

    if (!isEnumError(error)) {
      console.warn('[customerOrders] tracking event skipped:', error)
      return
    }
  }
}

export async function submitPasteLinkOrder(input: SubmitPasteLinkOrderInput): Promise<SubmitPasteLinkOrderResult> {
  if (!input.userId) {
    throw new Error('Please sign in before submitting your order.')
  }

  if (!cleanText(input.customerName)) {
    throw new Error('Customer name is required.')
  }

  if (!cleanText(input.customerPhone)) {
    throw new Error('Phone number is required.')
  }

  const cleanItems = input.items
    .map((item) => ({
      ...item,
      sourceUrl: item.sourceUrl ? (normalizeProductUrl(item.sourceUrl) || cleanText(item.sourceUrl)) : '',
      productName: cleanText(item.productName),
      productImage: cleanText(item.productImage),
      notes: cleanText(item.notes),
      quantity: Number(item.quantity ?? 1),
      price: Number(item.price ?? 0),
    }))
    .filter((item) => item.sourceUrl || item.screenshotFile)

  if (cleanItems.length === 0) {
    throw new Error('Please add at least one product link or screenshot.')
  }

  const orderRow = await insertPasteLinkOrderRow({
    ...input,
    items: cleanItems,
  })

  try {
    await uploadOrderItemScreenshots(input.userId, orderRow.id, cleanItems)
  } catch (error) {
    console.warn('[customerOrders] Screenshot upload had issues:', error)
  }

  try {
    await insertPasteLinkOrderItems(orderRow.id, cleanItems)
  } catch (error) {
    try {
      await supabase.from('orders').delete().eq('id', orderRow.id).eq('user_id', input.userId)
    } catch (cleanupError) {
      console.warn('[customerOrders] cleanup after failed paste-link item insert failed:', cleanupError)
    }

    throw error
  }

  await addCustomerSubmittedTrackingEvent(orderRow.id, input.userId)

  return {
    orderId: orderRow.id,
    orderNo: orderRow.order_no || orderRow.id,
  }
}
