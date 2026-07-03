import { supabase } from '@/lib/supabase'
import type {
  Address,
  DeliveryFeeRule,
  DeliveryHub,
  Notification as AppNotification,
  Order,
  OrderItem,
  OrderStatus,
  OrderType,
  Payment,
  PaymentCoverage,
  PaymentStatus,
  PaymentSummary,
  Quotation,
  QuotationItem,
  QuotationStatus,
  RequestBag,
  RequestBagItem,
  ServiceChargeRule,
  User,
} from '@/types'

// React Order Step 03 helper:
// - customer order reads
// - admin order reads
// - paste-link order submission
// - private order-screenshots uploads
//
// Important: related tables must always use orders.id UUID.
// orders.order_no is display only.

type AnyRow = Record<string, any>

type RelatedRows = {
  items: AnyRow[]
  quotations: AnyRow[]
  quotationItems: AnyRow[]
  payments: AnyRow[]
  profiles: AnyRow[]
  requestBags: AnyRow[]
}

export type PaymentProofInput = {
  order: Order
  userId: string
  file: File
  paymentMethodName: string
  transactionId: string
  amount: number
  note?: string
}

export type AdminQuotationItemInput = {
  orderItemId: string
  productName: string
  productImage?: string
  quantity: number
  unitPrice: number
  notes?: string
}

export type CreateAdminQuotationInput = {
  orderId: string
  items: AdminQuotationItemInput[]
  serviceCharge: number
  deliveryFee: number
  taxAmount: number
  additionalChargeLabel?: string
  additionalChargeAmount?: number
  notes?: string
  validUntil?: string
}

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

const ORDER_OWNER_COLUMNS = ['user_id', 'customer_id', 'profile_id']
const PLACEHOLDER_PRODUCT_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="18" fill="#f5f5f5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="16" fill="#a3a3a3">S2B</text></svg>`
  )

const DEFAULT_DELIVERY_FEE_RULES: DeliveryFeeRule[] = [
  {
    id: 'delivery-phuntsholing',
    destination: 'Phuntsholing / Chhukha',
    destinationKey: 'phuntsholing',
    dzongkhag: 'Chhukha',
    hubId: 'phuntsholing',
    baseFee: 150,
    perKgFee: 0,
    estimatedDays: 2,
    isActive: true,
    manualQuote: false,
    sortOrder: 1,
    notes: 'Border-side delivery destination.',
  },
  {
    id: 'delivery-thimphu',
    destination: 'Thimphu',
    destinationKey: 'thimphu',
    dzongkhag: 'Thimphu',
    hubId: 'thimphu',
    baseFee: 350,
    perKgFee: 0,
    estimatedDays: 3,
    isActive: true,
    manualQuote: false,
    sortOrder: 2,
    notes: 'Scheduled delivery to Thimphu.',
  },
  {
    id: 'delivery-paro',
    destination: 'Paro',
    destinationKey: 'paro',
    dzongkhag: 'Paro',
    hubId: 'paro',
    baseFee: 400,
    perKgFee: 0,
    estimatedDays: 3,
    isActive: true,
    manualQuote: false,
    sortOrder: 3,
    notes: 'Scheduled delivery to Paro.',
  },
  {
    id: 'delivery-other',
    destination: 'Other Dzongkhags',
    destinationKey: 'other',
    dzongkhag: 'Other',
    hubId: 'manual',
    baseFee: 0,
    perKgFee: 0,
    estimatedDays: 0,
    isActive: false,
    manualQuote: true,
    sortOrder: 99,
    notes: 'Orders accepted, delivery not available yet. Quote manually if required.',
  },
]

const DEFAULT_SERVICE_CHARGE_RULES: ServiceChargeRule[] = [
  { id: 'service-0-999', name: 'Starter Orders', minAmount: 0, maxAmount: 999, percentage: 15, flatFee: 100, minimumCharge: 100, isActive: true, requiresManualReview: false, sortOrder: 1 },
  { id: 'service-1000-1999', name: 'Everyday Orders I', minAmount: 1000, maxAmount: 1999, percentage: 13, flatFee: 200, minimumCharge: 200, isActive: true, requiresManualReview: false, sortOrder: 2 },
  { id: 'service-2000-4999', name: 'Everyday Orders II', minAmount: 2000, maxAmount: 4999, percentage: 12, flatFee: 300, minimumCharge: 300, isActive: true, requiresManualReview: false, sortOrder: 3 },
  { id: 'service-5000-9999', name: 'Medium Orders', minAmount: 5000, maxAmount: 9999, percentage: 10, flatFee: 500, minimumCharge: 500, isActive: true, requiresManualReview: false, sortOrder: 4 },
  { id: 'service-10000-19999', name: 'Large Orders', minAmount: 10000, maxAmount: 19999, percentage: 8, flatFee: 800, minimumCharge: 800, isActive: true, requiresManualReview: false, sortOrder: 5 },
  { id: 'service-20000-plus', name: 'High Value Orders', minAmount: 20000, maxAmount: null, percentage: 6, flatFee: 0, minimumCharge: 0, isActive: true, requiresManualReview: true, sortOrder: 6 },
]

export type CalculatedChargeSettings = {
  serviceCharge: number
  serviceRule?: ServiceChargeRule
  serviceNeedsReview: boolean
  deliveryFee: number
  deliveryRule?: DeliveryFeeRule
  deliveryNeedsManualQuote: boolean
}

function normalizeKey(value: unknown) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function normalizeDestinationKey(value: unknown) {
  const text = cleanText(value).toLowerCase()
  if (text.includes('paro')) return 'paro'
  if (text.includes('thimphu')) return 'thimphu'
  if (
    text.includes('chhukha') ||
    text.includes('phuntsholing') ||
    text.includes('phuentsholing') ||
    text.includes('jaigaon') ||
    text.includes('pling')
  ) {
    return 'phuntsholing'
  }
  return normalizeKey(text) || 'other'
}

function normalizeDeliveryRule(row: AnyRow): DeliveryFeeRule {
  const destination = firstString(row, ['destination', 'destination_name', 'dzongkhag'], 'Delivery destination')
  const destinationKey = firstString(row, ['destination_key', 'key'], normalizeDestinationKey(destination))

  return {
    id: firstString(row, ['id'], destinationKey),
    destination,
    destinationKey,
    dzongkhag: firstString(row, ['dzongkhag'], destination),
    hubId: firstString(row, ['hub_id', 'delivery_hub_id'], destinationKey),
    baseFee: firstNumber(row, ['base_fee', 'delivery_fee', 'fee', 'baseFee'], 0),
    perKgFee: firstNumber(row, ['per_kg_fee', 'perKgFee'], 0),
    estimatedDays: firstNumber(row, ['estimated_days', 'estimatedDays'], 0),
    isActive: Boolean(firstValue(row, ['is_active', 'isActive']) ?? true),
    manualQuote: Boolean(firstValue(row, ['manual_quote', 'manualQuote']) ?? false),
    sortOrder: firstNumber(row, ['sort_order', 'sortOrder'], 0),
    notes: firstString(row, ['notes'], ''),
  }
}

function normalizeServiceRule(row: AnyRow): ServiceChargeRule {
  const rawFeeType = firstString(row, ['fee_type', 'feeType'], 'percentage').toLowerCase()
  const feeValue = firstNumber(row, ['fee_value', 'feeValue'], 0)
  const percentage = rawFeeType.includes('percent') ? feeValue : firstNumber(row, ['percentage', 'percent'], feeValue)
  const minimumCharge = firstNumber(row, ['minimum_charge', 'minimumCharge', 'flat_fee', 'flatFee'], 0)
  const maxValue = firstValue(row, ['max_order_amount', 'max_amount', 'maxAmount'])

  return {
    id: firstString(row, ['id'], normalizeKey(firstString(row, ['name'], 'service-rule'))),
    name: firstString(row, ['name', 'tier_name'], 'Service tier'),
    minAmount: firstNumber(row, ['min_order_amount', 'min_amount', 'minAmount'], 0),
    maxAmount: maxValue === null || maxValue === undefined || maxValue === '' ? null : firstNumber(row, ['max_order_amount', 'max_amount', 'maxAmount'], 0),
    percentage,
    flatFee: minimumCharge,
    minimumCharge,
    isActive: Boolean(firstValue(row, ['is_active', 'isActive']) ?? true),
    requiresManualReview: Boolean(firstValue(row, ['requires_manual_review', 'requiresManualReview']) ?? false),
    sortOrder: firstNumber(row, ['sort_order', 'sortOrder'], 0),
  }
}

function sortDeliveryRules(rules: DeliveryFeeRule[]) {
  return [...rules].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.destination.localeCompare(b.destination))
}

function sortServiceRules(rules: ServiceChargeRule[]) {
  return [...rules].sort((a, b) => a.minAmount - b.minAmount || (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}

export async function fetchDeliveryFeeRules(): Promise<DeliveryFeeRule[]> {
  const { data, error } = await supabase.from('delivery_fee_rules').select('*').order('sort_order', { ascending: true })

  if (error) {
    if (isMissingColumnOrRelationError(error)) return DEFAULT_DELIVERY_FEE_RULES
    throw error
  }

  const rules = (data ?? []).map((row) => normalizeDeliveryRule(row as AnyRow))
  return rules.length ? sortDeliveryRules(rules) : DEFAULT_DELIVERY_FEE_RULES
}

export async function saveDeliveryFeeRules(rules: DeliveryFeeRule[]): Promise<DeliveryFeeRule[]> {
  const now = new Date().toISOString()

  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index]
    const destination = cleanText(rule.destination || rule.dzongkhag) || 'Delivery destination'
    const destinationKey = normalizeDestinationKey(rule.destinationKey || destination)
    const payload = {
      destination,
      destination_key: destinationKey,
      dzongkhag: cleanText(rule.dzongkhag) || destination,
      hub_id: cleanText(rule.hubId) || destinationKey,
      base_fee: numericAmount(rule.baseFee),
      per_kg_fee: numericAmount(rule.perKgFee ?? 0),
      estimated_days: Math.max(0, Math.floor(Number(rule.estimatedDays) || 0)),
      is_active: Boolean(rule.isActive),
      manual_quote: Boolean(rule.manualQuote),
      sort_order: rule.sortOrder ?? index + 1,
      notes: cleanText(rule.notes) || null,
      updated_at: now,
    }

    const result = isUuidLike(cleanText(rule.id))
      ? await supabase.from('delivery_fee_rules').update(payload).eq('id', rule.id)
      : await supabase.from('delivery_fee_rules').upsert(payload, { onConflict: 'destination_key' })

    if (result.error) {
      if (isMissingColumnOrRelationError(result.error)) {
        throw new Error('Delivery fee settings table is missing. Please run the Step 04C SQL first.')
      }
      throw result.error
    }
  }

  return fetchDeliveryFeeRules()
}

export async function fetchServiceChargeRules(): Promise<ServiceChargeRule[]> {
  const { data, error } = await supabase.from('service_charge_rules').select('*').order('min_order_amount', { ascending: true })

  if (error) {
    if (isMissingColumnOrRelationError(error)) return DEFAULT_SERVICE_CHARGE_RULES
    throw error
  }

  const rules = (data ?? []).map((row) => normalizeServiceRule(row as AnyRow))
  return rules.length ? sortServiceRules(rules) : DEFAULT_SERVICE_CHARGE_RULES
}

export async function saveServiceChargeRules(rules: ServiceChargeRule[]): Promise<ServiceChargeRule[]> {
  const now = new Date().toISOString()

  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index]
    const payload = {
      name: cleanText(rule.name) || `Service tier ${index + 1}`,
      source_platform: null,
      fee_type: 'percentage',
      fee_value: numericAmount(rule.percentage),
      min_order_amount: numericAmount(rule.minAmount),
      max_order_amount: rule.maxAmount === null || rule.maxAmount === undefined ? null : numericAmount(rule.maxAmount),
      minimum_charge: numericAmount(rule.minimumCharge ?? rule.flatFee ?? 0),
      is_default: true,
      is_active: Boolean(rule.isActive),
      requires_manual_review: Boolean(rule.requiresManualReview),
      sort_order: rule.sortOrder ?? index + 1,
      notes: null,
      updated_at: now,
    }

    const result = isUuidLike(cleanText(rule.id))
      ? await supabase.from('service_charge_rules').update(payload).eq('id', rule.id)
      : await supabase.from('service_charge_rules').insert(payload)

    if (result.error) {
      if (isMissingColumnOrRelationError(result.error)) {
        throw new Error('Service charge settings table is missing or not upgraded. Please run the corrected Step 04C SQL first.')
      }
      throw result.error
    }
  }

  return fetchServiceChargeRules()
}

export async function deleteServiceChargeRule(rule: ServiceChargeRule): Promise<ServiceChargeRule[]> {
  const id = cleanText(rule.id)

  if (!isUuidLike(id)) return fetchServiceChargeRules()

  const result = await supabase.from('service_charge_rules').delete().eq('id', id)

  if (result.error) {
    if (isMissingColumnOrRelationError(result.error)) {
      throw new Error('Service charge settings table is missing or not upgraded. Please run the corrected Step 04C SQL first.')
    }
    throw result.error
  }

  return fetchServiceChargeRules()
}

export async function deleteDeliveryFeeRule(rule: DeliveryFeeRule): Promise<DeliveryFeeRule[]> {
  const id = cleanText(rule.id)
  const destinationKey = normalizeDestinationKey(rule.destinationKey || rule.destination || rule.dzongkhag)

  const result = isUuidLike(id)
    ? await supabase.from('delivery_fee_rules').delete().eq('id', id)
    : await supabase.from('delivery_fee_rules').delete().eq('destination_key', destinationKey)

  if (result.error) {
    if (isMissingColumnOrRelationError(result.error)) {
      throw new Error('Delivery fee settings table is missing. Please run the Step 04C SQL first.')
    }
    throw result.error
  }

  return fetchDeliveryFeeRules()
}

export function calculateServiceChargeFromRules(productTotal: number, rules: ServiceChargeRule[]) {
  const amount = numericAmount(productTotal)
  const activeRules = sortServiceRules(rules.filter((rule) => rule.isActive))
  const rule =
    activeRules.find((item) => amount >= item.minAmount && (item.maxAmount === null || item.maxAmount === undefined || amount <= item.maxAmount)) ??
    activeRules[activeRules.length - 1]

  if (!rule) {
    return {
      amount: 0,
      rule: undefined,
      needsReview: false,
    }
  }

  const percentageAmount = Math.round(amount * (numericAmount(rule.percentage) / 100))
  const minimumCharge = numericAmount(rule.minimumCharge ?? rule.flatFee ?? 0)

  return {
    amount: Math.max(percentageAmount, minimumCharge),
    rule,
    needsReview: Boolean(rule.requiresManualReview),
  }
}

export function resolveDeliveryDestinationKeyForOrder(order: Order) {
  return normalizeDestinationKey(
    [
      order.shippingAddress?.dzongkhag,
      order.shippingAddress?.village,
      order.shippingAddress?.gewog,
      order.shippingAddress?.landmark,
      order.deliveryHub?.name,
      order.deliveryHub?.dzongkhag,
      order.deliveryHub?.address,
    ].join(' ')
  )
}

export function calculateDeliveryFeeForOrder(order: Order, rules: DeliveryFeeRule[]) {
  const destinationKey = resolveDeliveryDestinationKeyForOrder(order)
  const activeRules = sortDeliveryRules(rules.filter((rule) => rule.isActive))
  const rule =
    activeRules.find((item) => normalizeDestinationKey(item.destinationKey || item.destination || item.dzongkhag) === destinationKey) ??
    activeRules.find((item) => normalizeDestinationKey(item.destinationKey || item.destination || item.dzongkhag) === 'other')

  if (!rule) {
    return {
      amount: 0,
      rule: undefined,
      needsManualQuote: true,
    }
  }

  return {
    amount: numericAmount(rule.baseFee),
    rule,
    needsManualQuote: Boolean(rule.manualQuote) || numericAmount(rule.baseFee) <= 0,
  }
}

export function calculateQuotationSettingsAmounts(params: {
  order: Order
  productTotal: number
  serviceRules: ServiceChargeRule[]
  deliveryRules: DeliveryFeeRule[]
}): CalculatedChargeSettings {
  const service = calculateServiceChargeFromRules(params.productTotal, params.serviceRules)
  const delivery = calculateDeliveryFeeForOrder(params.order, params.deliveryRules)

  return {
    serviceCharge: service.amount,
    serviceRule: service.rule,
    serviceNeedsReview: service.needsReview,
    deliveryFee: delivery.amount,
    deliveryRule: delivery.rule,
    deliveryNeedsManualQuote: delivery.needsManualQuote,
  }
}

function cleanText(value: unknown) {
  return String(value ?? '').trim()
}

function errorMessage(error: unknown, fallback = 'Unexpected Supabase error.') {
  return cleanText((error as { message?: string })?.message) || fallback
}

function isMissingColumnOrRelationError(error: unknown) {
  const message = errorMessage(error, '').toLowerCase()
  return (
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find') ||
    message.includes('column') ||
    message.includes('relationship')
  )
}

function isEnumError(error: unknown) {
  const message = errorMessage(error, '').toLowerCase()
  return (
    message.includes('invalid input value for enum') ||
    message.includes('invalid input syntax for type') ||
    message.includes('cannot cast') ||
    message.includes('violates check constraint') ||
    message.includes('not present in enum')
  )
}

function shouldTryFallbackPayload(error: unknown) {
  return isMissingColumnOrRelationError(error) || isEnumError(error)
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


function uniqueAddressParts(parts: unknown[]) {
  const seen = new Set<string>()

  return parts
    .map((part) => cleanText(part))
    .filter(Boolean)
    .filter((part) => {
      const key = part.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function makeSubmittedAddressSnapshot(input: SubmitPasteLinkOrderInput) {
  const fullAddress = cleanText(input.deliveryAddress)

  return {
    recipient_name: cleanText(input.customerName),
    phone: cleanText(input.customerPhone),
    customer_phone: cleanText(input.customerPhone),
    delivery_address: fullAddress,
    full_address: fullAddress,
    formatted_address: fullAddress,
    village: fullAddress,
  }
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

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function isExternalOrDataUrl(value: string) {
  return /^(https?:|data:|blob:)/i.test(value)
}

async function makeSignedScreenshotUrl(pathOrUrl: string) {
  const value = cleanText(pathOrUrl)
  if (!value) return ''
  if (isExternalOrDataUrl(value)) return value

  const { data, error } = await supabase.storage.from('order-screenshots').createSignedUrl(value, 60 * 30)
  if (error) {
    console.warn('[customerOrders] signed URL skipped:', error.message)
    return ''
  }

  return data?.signedUrl || ''
}

async function makeDisplayImage(primary: string, fallbackPath?: string) {
  const primaryValue = cleanText(primary)
  if (primaryValue) {
    if (isExternalOrDataUrl(primaryValue)) return primaryValue

    const signed = await makeSignedScreenshotUrl(primaryValue)
    if (signed) return signed
  }

  const fallbackValue = cleanText(fallbackPath)
  if (fallbackValue) {
    const signed = await makeSignedScreenshotUrl(fallbackValue)
    if (signed) return signed
  }

  return PLACEHOLDER_PRODUCT_IMAGE
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
    draft: 'pending',
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


function normalizeNotificationType(value: unknown): AppNotification['type'] {
  const raw = String(value ?? '').toLowerCase()
  if (raw === 'order_update' || raw === 'quotation' || raw === 'payment' || raw === 'promotion' || raw === 'system') {
    return raw as AppNotification['type']
  }
  return 'system'
}

function makeNotification(row: AnyRow): AppNotification {
  return {
    id: firstString(row, ['id'], ''),
    userId: firstString(row, ['user_id', 'customer_id', 'profile_id'], ''),
    type: normalizeNotificationType(firstValue(row, ['type', 'notification_type'])),
    title: firstString(row, ['title'], 'Notification'),
    message: firstString(row, ['message', 'body', 'description'], ''),
    link: firstString(row, ['link', 'url', 'action_url'], ''),
    isRead: Boolean(firstValue(row, ['is_read', 'read', 'isRead']) ?? false),
    createdAt: firstString(row, ['created_at'], new Date().toISOString()),
  }
}

function emitNotificationUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('shop2bhutan:notifications-updated'))
  }
}

export async function fetchCustomerNotifications(userId: string): Promise<AppNotification[]> {
  if (!userId) return []

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(80)

  if (error) {
    if (isMissingColumnOrRelationError(error)) return []
    throw error
  }

  return (data ?? []).map((row) => makeNotification(row as AnyRow))
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  if (!userId) return 0

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (!error) return count ?? 0
  if (isMissingColumnOrRelationError(error)) return 0

  const notifications = await fetchCustomerNotifications(userId)
  return notifications.filter((item) => !item.isRead).length
}

export async function markCustomerNotificationRead(notificationId: string, userId: string) {
  if (!notificationId || !userId) return

  const now = new Date().toISOString()
  const withReadAt = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: now, updated_at: now })
    .eq('id', notificationId)
    .eq('user_id', userId)

  if (!withReadAt.error) {
    emitNotificationUpdated()
    return
  }

  const withoutReadAt = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId)

  if (withoutReadAt.error && !isMissingColumnOrRelationError(withoutReadAt.error)) throw withoutReadAt.error
  emitNotificationUpdated()
}

export async function markAllCustomerNotificationsRead(userId: string) {
  if (!userId) return

  const now = new Date().toISOString()
  const withReadAt = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: now, updated_at: now })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (!withReadAt.error) {
    emitNotificationUpdated()
    return
  }

  const withoutReadAt = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (withoutReadAt.error && !isMissingColumnOrRelationError(withoutReadAt.error)) throw withoutReadAt.error
  emitNotificationUpdated()
}

async function createCustomerNotification(input: {
  userId: string
  type: AppNotification['type']
  title: string
  message: string
  link?: string
  dedupeKey?: string
}) {
  const userId = cleanText(input.userId)
  if (!userId) return

  const now = new Date().toISOString()
  const basePayload = {
    user_id: userId,
    type: input.type,
    title: cleanText(input.title),
    message: cleanText(input.message),
    link: cleanText(input.link) || null,
    is_read: false,
    created_at: now,
    updated_at: now,
  }
  const dedupeKey = cleanText(input.dedupeKey)

  if (dedupeKey) {
    const upsert = await supabase
      .from('notifications')
      .upsert({ ...basePayload, dedupe_key: dedupeKey }, { onConflict: 'dedupe_key' })

    if (!upsert.error) {
      emitNotificationUpdated()
      return
    }

    if (!isMissingColumnOrRelationError(upsert.error)) {
      const duplicateMessage = errorMessage(upsert.error, '').toLowerCase()
      if (duplicateMessage.includes('duplicate')) return
      throw upsert.error
    }
  }

  const insert = await supabase.from('notifications').insert(basePayload)
  if (insert.error) {
    const duplicateMessage = errorMessage(insert.error, '').toLowerCase()
    if (duplicateMessage.includes('duplicate')) return
    if (isMissingColumnOrRelationError(insert.error)) {
      console.warn('[customerOrders] notifications table missing or not upgraded:', insert.error.message)
      return
    }
    throw insert.error
  }

  emitNotificationUpdated()
}

async function createQuotationReadyNotificationForOrder(orderId: string, quotationRow: AnyRow) {
  try {
    const orderRow = await querySingleAdminOrderRow(orderId)
    if (!orderRow) return

    const userId = firstString(orderRow, ORDER_OWNER_COLUMNS, '')
    if (!userId) return

    const orderNo = firstString(orderRow, ['order_no', 'order_number', 'public_id'], orderId.slice(0, 8).toUpperCase())
    const quotationId = firstString(quotationRow, ['id'], '')

    await createCustomerNotification({
      userId,
      type: 'quotation',
      title: 'Quotation Ready',
      message: `Your quotation for order #${orderNo} is ready for review.`,
      link: `/quotation/${orderId}`,
      dedupeKey: `quotation-ready:${quotationId || orderId}`,
    })
  } catch (error) {
    console.warn('[customerOrders] quotation notification skipped:', error)
  }
}

function findProfileForOrder(row: AnyRow, profiles: AnyRow[]) {
  const ownerId = firstString(row, ORDER_OWNER_COLUMNS, '')
  if (!ownerId) return undefined
  return profiles.find((profile) => String(profile.id ?? '') === ownerId)
}

function makeFallbackUser(rowOrUserId: AnyRow | string, email = '', profiles: AnyRow[] = []): User {
  const row = typeof rowOrUserId === 'string' ? ({ user_id: rowOrUserId } as AnyRow) : rowOrUserId
  const profile = findProfileForOrder(row, profiles)
  const userId = firstString(row, ORDER_OWNER_COLUMNS, '')
  const customerEmail = firstString(row, ['customer_email', 'email'], email)
  const profileName = firstString(profile, ['full_name', 'name'], '')
  const customerName = firstString(row, ['customer_name', 'recipient_name', 'delivery_name', 'full_name', 'name'], '')
  const displayName = customerName || profileName || (customerEmail ? customerEmail.split('@')[0] : 'Customer')

  return {
    id: userId,
    name: displayName,
    email: customerEmail,
    phone: firstString(row, ['customer_phone', 'recipient_phone', 'delivery_phone', 'phone', 'whatsapp'], firstString(profile, ['phone'], '')),
    avatar: firstString(profile, ['avatar_url'], ''),
    role: 'customer',
    dzongkhag: firstString(row, ['dzongkhag', 'delivery_dzongkhag', 'delivery_city'], ''),
    isActive: true,
    createdAt: firstString(row, ['created_at'], new Date().toISOString()),
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

function makeShippingAddress(row: AnyRow, userId: string, profiles: AnyRow[] = []): Address {
  const nested = firstJsonObject(row, ['shipping_address', 'delivery_address_json', 'address'])
  const profile = findProfileForOrder(row, profiles)
  const source = { ...profile, ...row, ...nested }
  const submittedAddress = firstString(source, ['delivery_address', 'full_address', 'formatted_address', 'address_text'], '')
  const addressLine = firstString(source, ['address_line1', 'address1', 'line1', 'street_address', 'town_area', 'town', 'area', 'area_name', 'locality'], '')
  const buildingLine = firstString(source, ['address_line2', 'address2', 'line2', 'building', 'building_name', 'building_no', 'house_no', 'house_number', 'flat_no', 'apartment', 'room_no'], '')
  const village = firstString(source, ['village', 'delivery_village'], '')
  const gewog = firstString(source, ['gewog', 'delivery_gewog'], '')
  const dzongkhag = firstString(source, ['dzongkhag', 'dzongkhag_name', 'delivery_dzongkhag', 'delivery_city'], '')
  const landmark = firstString(source, ['landmark', 'delivery_landmark'], '')
  const fullAddress = uniqueAddressParts([submittedAddress, addressLine, buildingLine, village, gewog, dzongkhag, landmark]).join(', ')

  return {
    id: firstString(source, ['shipping_address_id', 'address_id'], `addr-${row.id ?? 'order'}`),
    userId,
    label: firstString(source, ['address_label', 'label'], 'Delivery'),
    recipientName: firstString(source, ['recipient_name', 'delivery_name', 'customer_name', 'full_name', 'name'], 'Customer'),
    phone: firstString(source, ['recipient_phone', 'delivery_phone', 'customer_phone', 'phone', 'whatsapp'], ''),
    dzongkhag,
    gewog,
    village: fullAddress || village || addressLine || submittedAddress,
    landmark,
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

function quotationRowTime(row: AnyRow) {
  const raw = firstString(row, ['responded_at', 'accepted_at', 'updated_at', 'created_at'], '')
  const time = raw ? Date.parse(raw) : 0
  return Number.isFinite(time) ? time : 0
}

function quotationRowRank(row: AnyRow) {
  const status = firstString(row, ['status'], '').toLowerCase()

  if (status === 'approved' || status === 'accepted') return 5
  if (status === 'sent' || status === 'quoted') return 4
  if (status === 'pending' || status === 'draft') return 3
  if (status === 'rejected' || status === 'declined') return 2
  if (status === 'expired') return 1

  return 0
}

function findQuotationForOrder(row: AnyRow, quotations: AnyRow[]) {
  const matches = quotations.filter((quotation) => quotationBelongsToOrder(quotation, row))
  if (matches.length <= 1) return matches[0]

  return [...matches].sort((a, b) => {
    const timeDifference = quotationRowTime(b) - quotationRowTime(a)
    if (timeDifference !== 0) return timeDifference

    return quotationRowRank(b) - quotationRowRank(a)
  })[0]
}

function paymentBelongsToOrder(payment: AnyRow, row: AnyRow) {
  return String(payment.order_id ?? '') === String(row.id ?? '')
}

async function makeOrderItems(row: AnyRow, relatedItems: AnyRow[]): Promise<OrderItem[]> {
  const mappedItems = await Promise.all(
    relatedItems.map(async (item, index) => {
      const attachmentPath = firstString(item, ['attachment_path', 'screenshot_path', 'proof_file_path'], '')
      const screenshotUrl = attachmentPath ? await makeSignedScreenshotUrl(attachmentPath) : ''
      const productImage = await makeDisplayImage(
        firstString(item, ['product_image', 'image_url', 'image', 'thumbnail_url', 'image_path', 'screenshot_url'], ''),
        attachmentPath
      )

      return {
        id: firstString(item, ['id'], `item-${row.id}-${index}`),
        productId: firstString(item, ['product_id'], ''),
        sourceUrl: firstString(item, ['source_url', 'product_url', 'url'], ''),
        sourcePlatform: firstString(item, ['source_platform', 'platform'], 'internal') as OrderItem['sourcePlatform'],
        productName: firstString(item, ['title_snapshot', 'product_name', 'item_name', 'name', 'title'], 'Product item'),
        productImage,
        quantity: firstNumber(item, ['quantity', 'qty'], 1),
        unitPrice: firstNumber(item, ['quoted_unit_price', 'estimated_price', 'unit_price', 'price', 'quoted_price', 'product_price', 'price_shown'], 0),
        attributes: firstJsonObject(item, ['attributes', 'selected_attributes']) as Record<string, string>,
        notes: firstString(item, ['notes', 'customer_notes', 'variant_text', 'item_notes'], ''),
        screenshotUrl,
        attachmentPath,
      }
    })
  )

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
      notes: '',
      screenshotUrl: '',
      attachmentPath: '',
    }))
  }

  const screenshotUrl = await makeDisplayImage(firstString(row, ['product_image', 'image_url', 'screenshot_url'], ''))

  return [
    {
      id: `item-${row.id}-fallback`,
      sourceUrl: firstString(row, ['product_url', 'source_url'], ''),
      sourcePlatform: 'internal',
      productName: firstString(row, ['product_name', 'item_name', 'title'], 'Order item'),
      productImage: screenshotUrl,
      quantity: firstNumber(row, ['quantity', 'qty'], 1),
      unitPrice: firstNumber(row, ['unit_price', 'product_price', 'amount'], 0),
      attributes: {},
      notes: firstString(row, ['notes', 'customer_notes'], ''),
      screenshotUrl,
      attachmentPath: '',
    },
  ]
}

function makeQuotationItems(quotation: AnyRow, orderItems: OrderItem[], quotationItems: AnyRow[]): QuotationItem[] {
  const quoteId = String(quotation.id ?? '')
  const directItems = quotationItems.filter((item) => String(item.quotation_id ?? item.quote_id ?? '') === quoteId)
  const findOriginalItem = (quoteItem: AnyRow, index: number) => {
    const orderItemId = firstString(quoteItem, ['order_item_id'], '')
    return orderItems.find((orderItem) => orderItem.id === orderItemId) ?? orderItems[index]
  }

  if (directItems.length > 0) {
    return directItems.map((item, index) => {
      const originalItem = findOriginalItem(item, index)
      const quantity = firstNumber(item, ['quantity', 'qty'], originalItem?.quantity ?? 1)
      const unitPrice = firstNumber(item, ['unit_price', 'price', 'quoted_price'], originalItem?.unitPrice ?? 0)
      const productName = firstString(
        item,
        ['item_name', 'product_name', 'name', 'title'],
        originalItem?.productName ?? 'Quoted item'
      )
      const productImage = firstString(
        item,
        ['product_image', 'image_url', 'image'],
        originalItem?.productImage ?? PLACEHOLDER_PRODUCT_IMAGE
      )

      return {
        id: firstString(item, ['id'], `quote-item-${quoteId}-${index}`),
        orderItemId: firstString(item, ['order_item_id'], originalItem?.id ?? ''),
        productName,
        productImage,
        quantity,
        unitPrice,
        totalPrice: firstNumber(item, ['total_price', 'line_total'], unitPrice * quantity),
        notes: firstString(item, ['notes', 'admin_notes'], ''),
        sourceUrl: firstString(item, ['source_url', 'product_url', 'url'], originalItem?.sourceUrl ?? ''),
        sourcePlatform: firstString(item, ['source_platform', 'platform'], originalItem?.sourcePlatform ?? ''),
        screenshotUrl: firstString(item, ['screenshot_url', 'screenshotUrl'], originalItem?.screenshotUrl ?? ''),
      }
    })
  }

  return orderItems.map((item) => ({
    id: `quote-${quoteId}-${item.id}`,
    orderItemId: item.id,
    productName: item.productName,
    productImage: item.productImage,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.unitPrice * item.quantity,
    notes: item.notes,
    sourceUrl: item.sourceUrl,
    sourcePlatform: item.sourcePlatform,
    screenshotUrl: item.screenshotUrl,
  }))
}

function makeQuotation(quotation: AnyRow | undefined, orderItems: OrderItem[], quotationItems: AnyRow[]): Quotation | undefined {
  if (!quotation) return undefined

  const items = makeQuotationItems(quotation, orderItems, quotationItems)
  const productTotal = firstNumber(
    quotation,
    ['product_subtotal', 'product_total', 'product_price', 'subtotal'],
    items.reduce((sum, item) => sum + item.totalPrice, 0)
  )
  const serviceCharge = firstNumber(quotation, ['service_charge', 'service_fee'], 0)
  const deliveryFee = firstNumber(quotation, ['delivery_fee', 'shipping_fee'], 0)
  const taxAmount = firstNumber(quotation, ['tax_amount', 'tax'], 0)
  const additionalChargeAmount = firstNumber(quotation, ['additional_charge_amount', 'extra_charge_amount', 'other_charges'], 0)
  const totalAmount = firstNumber(quotation, ['total_amount', 'total'], productTotal + serviceCharge + deliveryFee + taxAmount + additionalChargeAmount)

  return {
    id: firstString(quotation, ['id'], ''),
    orderId: firstString(quotation, ['order_id'], ''),
    status: normalizeQuotationStatus(firstValue(quotation, ['status'])),
    items,
    productTotal,
    serviceCharge,
    deliveryFee,
    taxAmount,
    additionalChargeLabel: firstString(quotation, ['additional_charge_label', 'extra_charge_label'], ''),
    additionalChargeAmount,
    totalAmount,
    validUntil: firstString(quotation, ['valid_until', 'expires_at'], ''),
    notes: firstString(quotation, ['notes', 'customer_message', 'admin_notes'], ''),
    createdAt: firstString(quotation, ['created_at'], ''),
    respondedAt: firstString(quotation, ['responded_at', 'updated_at'], ''),
  }
}

async function makePayment(payment: AnyRow | undefined): Promise<Payment | undefined> {
  if (!payment) return undefined

  const proofPath = firstString(payment, ['proof_file_path', 'screenshot_url', 'payment_proof_url', 'proof_url'], '')
  const screenshotUrl = await makeSignedScreenshotUrl(proofPath)

  return {
    id: firstString(payment, ['id'], ''),
    orderId: firstString(payment, ['order_id'], ''),
    amount: firstNumber(payment, ['amount', 'total_amount', 'advance_paid'], 0),
    method: firstString(payment, ['method', 'payment_method'], ''),
    transactionId: firstString(payment, ['transaction_id', 'reference_id', 'txn_id'], ''),
    screenshotUrl: screenshotUrl || proofPath,
    status: normalizePaymentStatus(firstValue(payment, ['status'])),
    verifiedBy: firstString(payment, ['verified_by'], ''),
    verifiedAt: firstString(payment, ['verified_at'], ''),
    notes: firstString(payment, ['notes', 'admin_notes'], ''),
    createdAt: firstString(payment, ['created_at'], ''),
  }
}

function sortPayments(payments: Payment[]) {
  return [...payments].sort((a, b) => {
    const bTime = new Date(b.createdAt || 0).getTime() || 0
    const aTime = new Date(a.createdAt || 0).getTime() || 0
    return bTime - aTime
  })
}

async function makePayments(payments: AnyRow[]): Promise<Payment[]> {
  const mapped = await Promise.all(payments.map((payment) => makePayment(payment)))
  return sortPayments(mapped.filter(Boolean) as Payment[])
}

function getPrimaryPayment(payments: Payment[]) {
  return (
    payments.find((payment) => payment.status === 'pending') ??
    payments.find((payment) => payment.status === 'rejected') ??
    payments[0]
  )
}

export function calculatePaymentSummary(params: {
  quotationTotal?: number
  payments?: Payment[]
}): PaymentSummary {
  const totalPayable = numericAmount(params.quotationTotal ?? 0)
  const payments = params.payments ?? []
  const verifiedPaid = payments
    .filter((payment) => payment.status === 'verified')
    .reduce((sum, payment) => sum + numericAmount(payment.amount), 0)
  const pendingAmount = payments
    .filter((payment) => payment.status === 'pending')
    .reduce((sum, payment) => sum + numericAmount(payment.amount), 0)
  const rejectedAmount = payments
    .filter((payment) => payment.status === 'rejected')
    .reduce((sum, payment) => sum + numericAmount(payment.amount), 0)
  const balanceDue = Math.max(totalPayable - verifiedPaid, 0)
  let coverage: PaymentCoverage = 'unpaid'

  if (totalPayable > 0 && verifiedPaid > totalPayable) {
    coverage = 'overpaid'
  } else if (totalPayable > 0 && verifiedPaid >= totalPayable) {
    coverage = 'fully_paid'
  } else if (verifiedPaid > 0) {
    coverage = 'partial_paid'
  }

  return {
    totalPayable,
    verifiedPaid,
    pendingAmount,
    rejectedAmount,
    balanceDue,
    coverage,
    hasPendingPayment: pendingAmount > 0 || payments.some((payment) => payment.status === 'pending'),
  }
}


function findRequestBagForOrder(row: AnyRow, requestBags: AnyRow[]) {
  const orderId = firstString(row, ['id'], '')
  if (!orderId) return undefined
  return requestBags.find((bag) => String(bag.submitted_order_id ?? '') === orderId)
}

function mergeSubmittedRequestBagAddress(row: AnyRow, related: RelatedRows) {
  const bag = findRequestBagForOrder(row, related.requestBags)
  if (!bag) return row

  return {
    ...bag,
    ...row,
    customer_name: firstString(row, ['customer_name']) || firstString(bag, ['customer_name']),
    customer_phone: firstString(row, ['customer_phone']) || firstString(bag, ['customer_phone']),
    delivery_address: firstString(row, ['delivery_address', 'full_address', 'formatted_address']) || firstString(bag, ['delivery_address', 'full_address', 'formatted_address']),
    customer_notes: firstString(row, ['customer_notes', 'notes']) || firstString(bag, ['customer_notes']),
  }
}

async function mapOrderRow(row: AnyRow, related: RelatedRows, authUserId: string, authEmail = ''): Promise<Order> {
  const displayRow = mergeSubmittedRequestBagAddress(row, related)
  const items = await makeOrderItems(row, related.items.filter((item) => itemBelongsToOrder(item, row)))
  const quotationRow = findQuotationForOrder(row, related.quotations)
  const quotation = makeQuotation(quotationRow, items, related.quotationItems)
  const relatedPaymentRows = related.payments.filter((payment) => paymentBelongsToOrder(payment, row))
  const payments = await makePayments(relatedPaymentRows)
  const payment = getPrimaryPayment(payments)
  const customerId = firstString(displayRow, ORDER_OWNER_COLUMNS, authUserId)

  return {
    id: firstString(row, ['id'], ''),
    orderNumber: firstString(
      row,
      ['order_no', 'order_number', 'public_id'],
      firstString(row, ['id'], '').slice(0, 8).toUpperCase()
    ),
    userId: customerId,
    user: makeFallbackUser(displayRow, authEmail, related.profiles),
    items,
    status: normalizeOrderStatus(firstValue(row, ['status', 'order_status'])),
    type: firstString(row, ['order_type', 'type'], 'paste_link') as OrderType,
    deliveryHubId: firstString(row, ['delivery_hub_id', 'hub_id'], 'hub1'),
    deliveryHub: makeDeliveryHub(displayRow),
    shippingAddress: makeShippingAddress(displayRow, customerId, related.profiles),
    quotation,
    payment,
    payments,
    paymentSummary: calculatePaymentSummary({
      quotationTotal: quotation?.totalAmount ?? 0,
      payments,
    }),
    notes: firstString(displayRow, ['notes', 'customer_notes', 'admin_notes'], ''),
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
  const ownerIds = orderRows
    .flatMap((row) => ORDER_OWNER_COLUMNS.map((column) => String(row[column] ?? '')))
    .filter(Boolean)

  const items = await safeSelectIn('order_items', 'order_id', dbIds)
  const quotations = await safeSelectIn('quotations', 'order_id', dbIds)
  const payments = await safeSelectIn('payments', 'order_id', dbIds)
  const profiles = await safeSelectIn('profiles', 'id', Array.from(new Set(ownerIds)))
  const requestBags = await safeSelectIn('customer_request_bags', 'submitted_order_id', dbIds)

  const quotationIds = quotations.map((quote) => String(quote.id ?? '')).filter(Boolean)
  const quotationItems = await safeSelectIn('quotation_items', 'quotation_id', quotationIds)

  return {
    items,
    quotations,
    quotationItems,
    payments,
    profiles,
    requestBags,
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

  throw new Error(errorMessage(lastError, 'Unable to load customer orders.'))
}

async function querySingleCustomerOrderRow(orderIdOrNumber: string, userId: string) {
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
      if (ownerValue && ownerValue !== userId) throw new Error('Order not found.')
      return data as AnyRow
    }

    if (!error && !data) continue

    lastError = error
    if (!isMissingColumnOrRelationError(error)) {
      console.warn(`[customerOrders] orders.${lookupColumn} lookup failed, trying fallback:`, error)
    }
  }

  if (lastError && !isMissingColumnOrRelationError(lastError)) {
    throw new Error(errorMessage(lastError, 'Unable to load order.'))
  }

  return null
}

async function querySingleAdminOrderRow(orderIdOrNumber: string) {
  const lookupColumns = isUuidLike(orderIdOrNumber) ? ['id'] : ['order_no']
  let lastError: unknown = null

  for (const lookupColumn of lookupColumns) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq(lookupColumn, orderIdOrNumber)
      .maybeSingle()

    if (!error && data) return data as AnyRow
    if (!error && !data) continue

    lastError = error
    if (!isMissingColumnOrRelationError(error)) throw error
  }

  if (lastError && !isMissingColumnOrRelationError(lastError)) {
    throw new Error(errorMessage(lastError, 'Unable to load admin order.'))
  }

  return null
}

export async function fetchCustomerOrders(userId: string, email = '') {
  if (!userId) return [] as Order[]

  const rows = await queryCustomerOrderRows(userId)
  const related = await fetchRelatedRows(rows)

  return Promise.all(rows.map((row) => mapOrderRow(row, related, userId, email)))
}

export async function fetchCustomerOrderById(orderIdOrNumber: string, userId: string, email = '') {
  if (!orderIdOrNumber || !userId) return null

  const row = await querySingleCustomerOrderRow(orderIdOrNumber, userId)
  if (!row) return null

  const related = await fetchRelatedRows([row])
  return mapOrderRow(row, related, userId, email)
}

export async function fetchAdminOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  const rows = (data ?? []) as AnyRow[]
  const related = await fetchRelatedRows(rows)

  return Promise.all(rows.map((row) => mapOrderRow(row, related, firstString(row, ORDER_OWNER_COLUMNS, ''), firstString(row, ['customer_email', 'email'], ''))))
}

export async function fetchAdminOrderById(orderIdOrNumber: string) {
  if (!orderIdOrNumber) return null

  const row = await querySingleAdminOrderRow(orderIdOrNumber)
  if (!row) return null

  const related = await fetchRelatedRows([row])
  return mapOrderRow(row, related, firstString(row, ORDER_OWNER_COLUMNS, ''), firstString(row, ['customer_email', 'email'], ''))
}

export async function updateQuotationStatus(quotationId: string, status: QuotationStatus) {
  const now = new Date().toISOString()
  const statusCandidates =
    status === 'approved'
      ? ['approved', 'accepted']
      : status === 'rejected'
        ? ['rejected', 'declined']
        : status === 'sent'
          ? ['sent', 'pending', 'draft']
          : [status]

  let lastError: unknown = null

  for (const dbStatus of statusCandidates) {
    const payload: AnyRow = {
      status: dbStatus,
      updated_at: now,
    }

    if (dbStatus === 'accepted') payload.accepted_at = now

    const withTimestamp = await supabase
      .from('quotations')
      .update(payload)
      .eq('id', quotationId)
      .select('id,status')
      .maybeSingle()

    if (!withTimestamp.error && withTimestamp.data) return

    lastError = withTimestamp.error
    if (withTimestamp.error && !shouldTryFallbackPayload(withTimestamp.error)) throw withTimestamp.error

    const fallbackPayload: AnyRow = { status: dbStatus }
    if (dbStatus === 'accepted') fallbackPayload.accepted_at = now

    const withoutTimestamp = await supabase
      .from('quotations')
      .update(fallbackPayload)
      .eq('id', quotationId)
      .select('id,status')
      .maybeSingle()

    if (!withoutTimestamp.error && withoutTimestamp.data) return

    lastError = withoutTimestamp.error ?? lastError
    if (withoutTimestamp.error && !shouldTryFallbackPayload(withoutTimestamp.error)) throw withoutTimestamp.error
  }

  throw new Error(errorMessage(lastError, 'Unable to update quotation status.'))
}

export async function updateCustomerOrderStatus(orderId: string, status: OrderStatus) {
  let lastError: unknown = null

  const standard = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select('id')
    .maybeSingle()

  if (!standard.error && standard.data) return
  lastError = standard.error

  const standardNoTimestamp = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select('id')
    .maybeSingle()

  if (!standardNoTimestamp.error && standardNoTimestamp.data) return
  lastError = standardNoTimestamp.error ?? lastError

  const legacy = await supabase
    .from('orders')
    .update({ order_status: status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select('id')
    .maybeSingle()

  if (!legacy.error && legacy.data) return
  lastError = legacy.error ?? lastError

  const legacyNoTimestamp = await supabase
    .from('orders')
    .update({ order_status: status })
    .eq('id', orderId)
    .select('id')
    .maybeSingle()

  if (!legacyNoTimestamp.error && legacyNoTimestamp.data) return
  lastError = legacyNoTimestamp.error ?? lastError

  throw new Error(errorMessage(lastError, 'Unable to update order status.'))
}


function numericAmount(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0
}

function quotationSubtotal(items: AdminQuotationItemInput[]) {
  return items.reduce((sum, item) => sum + numericAmount(item.unitPrice) * Math.max(1, Math.floor(Number(item.quantity) || 1)), 0)
}

function makeQuotationPayloadCandidates(input: CreateAdminQuotationInput, status: string): AnyRow[] {
  const productTotal = quotationSubtotal(input.items)
  const serviceCharge = numericAmount(input.serviceCharge)
  const deliveryFee = numericAmount(input.deliveryFee)
  const taxAmount = numericAmount(input.taxAmount)
  const additionalChargeAmount = numericAmount(input.additionalChargeAmount ?? 0)
  const additionalChargeLabel = cleanText(input.additionalChargeLabel) || null
  const totalAmount = productTotal + serviceCharge + deliveryFee + taxAmount + additionalChargeAmount
  const notes = cleanText(input.notes) || null
  const validUntil = cleanText(input.validUntil) || null
  const now = new Date().toISOString()

  return [
    {
      order_id: input.orderId,
      status,
      product_subtotal: productTotal,
      shipping_fee: 0,
      service_fee: serviceCharge,
      delivery_fee: deliveryFee,
      discount_amount: 0,
      additional_charge_label: additionalChargeLabel,
      additional_charge_amount: additionalChargeAmount,
      total_amount: totalAmount,
      advance_required: 0,
      due_amount: totalAmount,
      currency: 'BTN',
      admin_notes: notes,
      customer_message: notes,
      expires_at: validUntil,
      updated_at: now,
    },
    {
      order_id: input.orderId,
      status,
      product_subtotal: productTotal,
      shipping_fee: 0,
      service_fee: serviceCharge,
      delivery_fee: deliveryFee,
      discount_amount: 0,
      total_amount: totalAmount,
      advance_required: 0,
      due_amount: totalAmount,
      currency: 'BTN',
      admin_notes: notes,
      customer_message: notes,
      expires_at: validUntil,
      updated_at: now,
    },
    {
      order_id: input.orderId,
      status,
      product_subtotal: productTotal,
      service_fee: serviceCharge,
      delivery_fee: deliveryFee,
      shipping_fee: deliveryFee,
      total_amount: totalAmount,
      currency: 'BTN',
      expires_at: validUntil,
      admin_notes: notes,
      customer_message: notes,
      updated_at: now,
    },
    {
      order_id: input.orderId,
      status,
      product_subtotal: productTotal,
      service_fee: serviceCharge,
      delivery_fee: deliveryFee,
      total_amount: totalAmount,
      currency: 'BTN',
      expires_at: validUntil,
      admin_notes: notes,
      customer_message: notes,
    },
  ]
}

async function findQuotationRowForOrder(orderId: string) {
  const ordered = await supabase
    .from('quotations')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!ordered.error) return (ordered.data ?? null) as AnyRow | null

  if (!isMissingColumnOrRelationError(ordered.error)) throw ordered.error

  const fallback = await supabase.from('quotations').select('*').eq('order_id', orderId).limit(1).maybeSingle()

  if (fallback.error) {
    if (isMissingColumnOrRelationError(fallback.error)) return null
    throw fallback.error
  }

  return (fallback.data ?? null) as AnyRow | null
}

async function saveQuotationRow(input: CreateAdminQuotationInput, existingQuotationId?: string) {
  const statusCandidates = ['sent', 'pending', 'draft', 'quoted']
  let lastError: unknown = null

  for (const status of statusCandidates) {
    for (const payload of makeQuotationPayloadCandidates(input, status)) {
      if (existingQuotationId) {
        const { data, error } = await supabase
          .from('quotations')
          .update(payload)
          .eq('id', existingQuotationId)
          .select('*')
          .single()

        if (!error && data) return data as AnyRow
        lastError = error
        if (error && !shouldTryFallbackPayload(error)) throw error
      } else {
        const { data, error } = await supabase.from('quotations').insert(payload).select('*').single()

        if (!error && data) return data as AnyRow
        lastError = error

        const message = errorMessage(error, '').toLowerCase()
        if (message.includes('duplicate') || message.includes('unique')) {
          const existing = await findQuotationRowForOrder(input.orderId)
          if (existing?.id) return saveQuotationRow(input, String(existing.id))
        }

        if (error && !shouldTryFallbackPayload(error)) throw error
      }
    }
  }

  throw new Error(errorMessage(lastError, 'Unable to save quotation row.'))
}

function makeQuotationItemPayloadCandidates(quotationId: string, item: AdminQuotationItemInput): AnyRow[] {
  const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1))
  const unitPrice = numericAmount(item.unitPrice)
  const totalPrice = quantity * unitPrice
  const notes = cleanText(item.notes) || null
  const image = cleanText(item.productImage) || null
  const name = cleanText(item.productName) || 'Quoted item'

  return [
    {
      quotation_id: quotationId,
      order_item_id: item.orderItemId,
      item_name: name,
      product_image: image,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      notes,
    },
    {
      quotation_id: quotationId,
      order_item_id: item.orderItemId,
      item_name: name,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      notes,
    },
    {
      quotation_id: quotationId,
      order_item_id: item.orderItemId,
      name,
      image_url: image,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      notes,
    },
    {
      quotation_id: quotationId,
      order_item_id: item.orderItemId,
      product_name: name,
      product_image: image,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      notes,
    },
  ]
}

async function replaceQuotationItems(quotationId: string, items: AdminQuotationItemInput[]) {
  const deleteResult = await supabase.from('quotation_items').delete().eq('quotation_id', quotationId)
  if (deleteResult.error && !isMissingColumnOrRelationError(deleteResult.error)) throw deleteResult.error

  if (items.length === 0) return

  const candidateGroups = makeQuotationItemPayloadCandidates(quotationId, items[0]).map((_, candidateIndex) =>
    items.map((item) => makeQuotationItemPayloadCandidates(quotationId, item)[candidateIndex])
  )

  let lastError: unknown = null

  for (const payloads of candidateGroups) {
    const { error } = await supabase.from('quotation_items').insert(payloads)
    if (!error) return

    lastError = error
    if (!shouldTryFallbackPayload(error)) throw error
  }

  throw new Error(errorMessage(lastError, 'Unable to save quotation items.'))
}

async function markOrderQuoted(orderId: string) {
  try {
    await updateCustomerOrderStatus(orderId, 'quoted')
  } catch (error) {
    if (!isEnumError(error)) throw error
    await updateCustomerOrderStatus(orderId, 'quotation_pending')
  }
}

export async function createOrUpdateAdminQuotation(input: CreateAdminQuotationInput): Promise<Quotation> {
  if (!input.orderId) throw new Error('Order UUID is required.')
  if (!isUuidLike(input.orderId)) throw new Error('Invalid order UUID. Use orders.id, not order number.')
  if (!input.items.length) throw new Error('At least one quoted item is required.')

  const existing = await findQuotationRowForOrder(input.orderId)
  const quotationRow = await saveQuotationRow(input, existing?.id ? String(existing.id) : undefined)
  const quotationId = firstString(quotationRow, ['id'], '')

  if (!quotationId) throw new Error('Quotation was saved but no quotation UUID was returned.')

  await replaceQuotationItems(quotationId, input.items)
  await markOrderQuoted(input.orderId)
  await createQuotationReadyNotificationForOrder(input.orderId, quotationRow)

  const refreshed = await fetchAdminOrderById(input.orderId)
  if (refreshed?.quotation) return refreshed.quotation

  return makeQuotation(quotationRow, [], []) as Quotation
}

function makeStoragePath(userId: string, orderId: string, file: File, prefix = 'payment') {
  const rawExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const ext = rawExt.replace(/[^a-z0-9]/g, '') || 'jpg'
  return `${userId}/${orderId}/${prefix}-${Date.now()}.${ext}`
}

function paymentMethodToDbValue(paymentMethodName: string) {
  const raw = paymentMethodName.toLowerCase()
  if (raw.includes('wallet') || raw.includes('mbo') || raw.includes('mpay') || raw.includes('mobile')) return 'mobile_wallet'
  if (raw.includes('bank') || raw.includes('transfer') || raw.includes('bob') || raw.includes('bnb') || raw.includes('tbank')) return 'bank_transfer'
  return 'other'
}

function paymentAdminNotes(payload: {
  transactionId: string
  paymentMethodName: string
  path: string
  note?: string
}) {
  return [
    `Customer reference: ${payload.transactionId || 'Not provided'}`,
    `Customer selected method: ${payload.paymentMethodName}`,
    `Storage path: ${payload.path}`,
    payload.note ? `Customer note: ${payload.note}` : '',
  ].filter(Boolean).join('\n')
}

async function insertPaymentWithKnownSchema(payload: {
  orderId: string
  quotationId?: string
  userId: string
  amount: number
  paymentMethodName: string
  transactionId: string
  path: string
  note?: string
}) {
  const paymentTypeCandidates = ['full', 'advance', 'partial', 'balance', 'deposit', 'confirm_later']
  let lastError: unknown = null
  const adminNotes = paymentAdminNotes(payload)

  for (const paymentType of paymentTypeCandidates) {
    const basePayload = {
      order_id: payload.orderId,
      quotation_id: payload.quotationId || null,
      user_id: payload.userId,
      payment_type: paymentType,
      payment_method: paymentMethodToDbValue(payload.paymentMethodName),
      amount: payload.amount,
      currency: 'BTN',
      proof_file_path: payload.path,
      transaction_id: payload.transactionId || null,
      admin_notes: adminNotes,
    }
    const legacyPayload = { ...basePayload }
    delete (legacyPayload as Partial<typeof basePayload>).transaction_id

    const candidates = [
      { ...basePayload, status: 'pending' },
      basePayload,
      { ...legacyPayload, status: 'pending' },
      legacyPayload,
    ]

    for (const candidate of candidates) {
      const result = await supabase.from('payments').insert(candidate)
      if (!result.error) return

      lastError = result.error
      if (!shouldTryFallbackPayload(result.error)) throw result.error
    }
  }

  throw new Error(errorMessage(lastError, 'Unable to create payment row. Check public.payment_type enum values.'))
}

export async function submitCustomerPaymentProof(input: PaymentProofInput) {
  const { order, userId, file, paymentMethodName, transactionId, amount, note } = input
  const path = makeStoragePath(userId, order.id, file, 'payment')

  const { error: uploadError } = await supabase.storage.from('order-screenshots').upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || 'image/jpeg',
    upsert: false,
  })

  if (uploadError) throw uploadError

  try {
    await insertPaymentWithKnownSchema({
      orderId: order.id,
      quotationId: order.quotation?.id,
      userId,
      amount,
      paymentMethodName,
      transactionId,
      path,
      note,
    })
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

async function updatePaymentReviewStatus(params: {
  paymentId: string
  status: PaymentStatus
  adminId?: string
  adminNote?: string
}) {
  const now = new Date().toISOString()
  const adminNote = cleanText(params.adminNote)
  const withFullPayload: AnyRow = {
    status: params.status,
    admin_notes: adminNote || null,
    updated_at: now,
  }

  if (params.status === 'verified') {
    withFullPayload.verified_by = cleanText(params.adminId) || null
    withFullPayload.verified_at = now
  } else {
    withFullPayload.verified_by = null
    withFullPayload.verified_at = null
  }

  const candidates: AnyRow[] = [
    withFullPayload,
    params.status === 'verified'
      ? {
          status: params.status,
          verified_by: cleanText(params.adminId) || null,
          verified_at: now,
          updated_at: now,
        }
      : {
          status: params.status,
          updated_at: now,
        },
    adminNote
      ? {
          status: params.status,
          admin_notes: adminNote,
        }
      : {
          status: params.status,
        },
    {
      status: params.status,
    },
  ]

  let lastError: unknown = null

  for (const candidate of candidates) {
    const result = await supabase.from('payments').update(candidate).eq('id', params.paymentId)
    if (!result.error) return

    lastError = result.error
    if (!shouldTryFallbackPayload(result.error)) throw result.error
  }

  throw new Error(errorMessage(lastError, 'Unable to update payment status.'))
}

export async function verifyCustomerPayment(input: {
  order: Order
  paymentId: string
  adminId?: string
  adminNote?: string
}) {
  await updatePaymentReviewStatus({
    paymentId: input.paymentId,
    status: 'verified',
    adminId: input.adminId,
    adminNote: input.adminNote,
  })

  if (input.order.status === 'quoted' || input.order.status === 'payment_pending') {
    try {
      await updateCustomerOrderStatus(input.order.id, 'payment_pending')
    } catch (error) {
      console.warn('[customerOrders] order status after payment verification skipped:', error)
    }
  }
}

export async function rejectCustomerPayment(input: {
  order: Order
  paymentId: string
  adminId?: string
  adminNote?: string
}) {
  await updatePaymentReviewStatus({
    paymentId: input.paymentId,
    status: 'rejected',
    adminId: input.adminId,
    adminNote: input.adminNote || 'Rejected by admin.',
  })

  if (input.order.status === 'quoted' || input.order.status === 'payment_pending') {
    try {
      await updateCustomerOrderStatus(input.order.id, 'payment_pending')
    } catch (error) {
      console.warn('[customerOrders] order status after payment rejection skipped:', error)
    }
  }
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
    message: message || 'Shop2Bhutan will verify this product manually before quotation.',
  }
}

function pickPreviewObject(raw: AnyRow): AnyRow {
  const candidates = [raw.preview, raw.product, raw.item, raw.data, raw.result, raw]

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) return candidate as AnyRow
  }

  return raw
}

function parsePreviewPrice(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : undefined

  const clean = String(value ?? '')
    .replace(/,/g, '')
    .replace(/[^0-9.]/g, '')

  const numeric = Number(clean)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined
}

function normalizePreviewPayload(payload: unknown, requestedUrl: string): ProductLinkPreview {
  const raw = (payload && typeof payload === 'object' ? payload : {}) as AnyRow
  const preview = pickPreviewObject(raw)
  const rawUrl = preview.url || preview.sourceUrl || preview.productUrl || raw.url
  const normalizedUrl = normalizeProductUrl(String(rawUrl ?? requestedUrl)) || requestedUrl
  const platform = cleanText(preview.platform || preview.sourcePlatform || raw.platform) || detectSourcePlatformFromUrl(normalizedUrl)

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

  if (!normalizedUrl) return fallbackProductPreview(url, 'Please enter a valid product URL.')

  try {
    const invokePromise = supabase.functions.invoke('product-link-preview', { body: { url: normalizedUrl } })

    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) => {
      window.setTimeout(() => {
        resolve({
          data: null,
          error: new Error('Product preview was not available in time.'),
        })
      }, 8000)
    })

    const { data, error } = await Promise.race([invokePromise, timeoutPromise])

    if (error) {
      console.warn('[customerOrders] product preview fallback:', error)
      return fallbackProductPreview(normalizedUrl)
    }

    const preview = normalizePreviewPayload(data, normalizedUrl)

    return {
      ...preview,
      title: preview.title || productNameFromPlatform(preview.platform),
      message:
        preview.message ||
        (preview.fetched
          ? ''
          : 'Shop2Bhutan will verify this product manually before quotation.'),
    }
  } catch (error) {
    console.warn('[customerOrders] product preview failed:', error)
    return fallbackProductPreview(normalizedUrl)
  }
}

function makeOrderPayloadCandidates(input: SubmitPasteLinkOrderInput): AnyRow[] {
  const deliveryAddress = cleanText(input.deliveryAddress)
  const customerNotes =
    cleanText(input.customerNotes) ||
    `Paste-link order submitted by customer. Name: ${cleanText(input.customerName)}. Phone: ${cleanText(input.customerPhone)}.`
  const notesWithAddress = deliveryAddress && !customerNotes.toLowerCase().includes('delivery address')
    ? `${customerNotes}

Delivery address: ${deliveryAddress}`
    : customerNotes
  const shippingSnapshot = makeSubmittedAddressSnapshot(input)

  const base: AnyRow = {
    user_id: input.userId,
    customer_name: cleanText(input.customerName),
    customer_phone: cleanText(input.customerPhone),
    customer_email: cleanText(input.email),
    delivery_address: deliveryAddress || null,
    customer_notes: notesWithAddress,
  }

  return [
    { ...base, shipping_address: shippingSnapshot, order_type: 'paste_link' },
    { ...base, delivery_address_json: shippingSnapshot, order_type: 'paste_link' },
    { ...base, order_type: 'paste_link' },
    { ...base, order_type: 'external_link' },
    { ...base, type: 'paste_link' },
    {
      user_id: input.userId,
      order_type: 'paste_link',
      notes: notesWithAddress,
    },
    {
      user_id: input.userId,
      type: 'paste_link',
      notes: notesWithAddress,
    },
  ]
}

async function insertPasteLinkOrderRow(input: SubmitPasteLinkOrderInput) {
  let lastError: unknown = null

  for (const payload of makeOrderPayloadCandidates(input)) {
    const { data, error } = await supabase.from('orders').insert(payload as any).select('id, order_no').single()

    if (!error && data) return data as { id: string; order_no: string | null }

    lastError = error
    if (error && !shouldTryFallbackPayload(error)) throw error
  }

  throw new Error(errorMessage(lastError, 'Unable to create paste-link order.'))
}

function makeOrderItemPayloads(params: {
  orderId: string
  itemType?: string
  items: PasteLinkOrderItemInput[]
  forceOtherPlatform?: boolean
  compact?: boolean
}) {
  return params.items.map((item) => {
    const sourceUrl = normalizeProductUrl(item.sourceUrl || '') || cleanText(item.sourceUrl) || ''
    const detectedPlatform = detectSourcePlatformFromUrl(sourceUrl)
    const dbPlatform = params.forceOtherPlatform ? 'other' : platformToDbValue(item.sourcePlatform || detectedPlatform || sourceUrl)
    const quantity = Number(item.quantity ?? 1)
    const price = Number(item.price ?? 0)
    const itemNotes = cleanText(item.notes)
    const titleSnapshot =
      cleanText(item.productName) || (item.screenshotFile ? 'Screenshot product request' : productNameFromPlatform(dbPlatform))

    if (params.compact) {
      return {
        order_id: params.orderId,
        source_url: sourceUrl || null,
        product_name: titleSnapshot,
        quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
      }
    }

    return {
      order_id: params.orderId,
      ...(params.itemType ? { item_type: params.itemType } : {}),
      source_platform: dbPlatform,
      source_url: sourceUrl || null,
      title_snapshot: titleSnapshot,
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
      const payloads = makeOrderItemPayloads({ orderId, itemType, items, forceOtherPlatform })
      const { error } = await supabase.from('order_items').insert(payloads as any)

      if (!error) return
      lastError = error
      if (error && !shouldTryFallbackPayload(error)) throw error
    }

    const noItemTypePayloads = makeOrderItemPayloads({ orderId, items, forceOtherPlatform })
    const { error } = await supabase.from('order_items').insert(noItemTypePayloads as any)
    if (!error) return

    lastError = error
    if (error && !shouldTryFallbackPayload(error)) throw error
  }

  const compactPayloads = makeOrderItemPayloads({ orderId, items, compact: true })
  const { error } = await supabase.from('order_items').insert(compactPayloads as any)
  if (!error) return

  throw new Error(errorMessage(error || lastError, 'Unable to create paste-link order items.'))
}

async function uploadOrderItemScreenshots(userId: string, orderId: string, items: PasteLinkOrderItemInput[]): Promise<string[]> {
  const uploadedPaths: string[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item.screenshotFile) continue

    const path = makeStoragePath(userId, orderId, item.screenshotFile, `request-item-${i + 1}`)

    const { error: uploadError } = await supabase.storage.from('order-screenshots').upload(path, item.screenshotFile, {
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
  const statusCandidates = ['pending_confirmation', 'pending']

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
    if (!shouldTryFallbackPayload(error)) {
      console.warn('[customerOrders] tracking event skipped:', error)
      return
    }
  }
}

export async function submitPasteLinkOrder(input: SubmitPasteLinkOrderInput): Promise<SubmitPasteLinkOrderResult> {
  if (!input.userId) throw new Error('Please sign in before submitting your order.')
  if (!cleanText(input.customerName)) throw new Error('Customer name is required.')
  if (!cleanText(input.customerPhone)) throw new Error('Phone number is required.')

  const cleanItems = input.items
    .map((item) => ({
      ...item,
      sourceUrl: item.sourceUrl ? normalizeProductUrl(item.sourceUrl) || cleanText(item.sourceUrl) : '',
      productName: cleanText(item.productName),
      productImage: cleanText(item.productImage),
      notes: cleanText(item.notes),
      quantity: Number(item.quantity ?? 1),
      price: Number(item.price ?? 0),
    }))
    .filter((item) => item.sourceUrl || item.screenshotFile || item.attachmentPath)

  if (cleanItems.length === 0) throw new Error('Please add at least one product link or screenshot.')

  const orderRow = await insertPasteLinkOrderRow({ ...input, items: cleanItems })
  const uploadedPaths: string[] = []

  try {
    uploadedPaths.push(...(await uploadOrderItemScreenshots(input.userId, orderRow.id, cleanItems)))
    await insertPasteLinkOrderItems(orderRow.id, cleanItems)
    await addCustomerSubmittedTrackingEvent(orderRow.id, input.userId)
  } catch (error) {
    try {
      if (uploadedPaths.length > 0) await supabase.storage.from('order-screenshots').remove(uploadedPaths)
      await supabase.from('orders').delete().eq('id', orderRow.id).eq('user_id', input.userId)
    } catch (cleanupError) {
      console.warn('[customerOrders] cleanup after failed paste-link submit failed:', cleanupError)
    }

    throw error
  }

  return {
    orderId: orderRow.id,
    orderNo: orderRow.order_no || orderRow.id,
  }
}


// ============ Request Bag / Quote Cart ============

export type AddRequestBagItemInput = {
  userId: string
  item: PasteLinkOrderItemInput
}

export type SubmitRequestBagInput = {
  bagId: string
  userId: string
  email?: string | null
  customerName: string
  customerPhone: string
  deliveryAddress: string
  customerNotes?: string | null
}

function normalizeBagStatus(status: unknown): RequestBag['status'] {
  const raw = cleanText(status).toLowerCase()
  if (raw === 'submitted' || raw === 'abandoned') return raw
  return 'active'
}

async function findActiveRequestBagRow(userId: string) {
  const { data, error } = await supabase
    .from('customer_request_bags')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as AnyRow | null
}

async function ensureActiveRequestBagRow(userId: string) {
  const existing = await findActiveRequestBagRow(userId)
  if (existing) return existing

  const { data, error } = await supabase
    .from('customer_request_bags')
    .insert({ user_id: userId, status: 'active' })
    .select('*')
    .single()

  if (!error && data) return data as AnyRow

  // If two tabs created a bag at the same time, the partial unique index may
  // reject one insert. Re-read the active bag before surfacing the error.
  const retry = await findActiveRequestBagRow(userId)
  if (retry) return retry

  throw error
}

async function makeRequestBagItemDisplay(row: AnyRow): Promise<RequestBagItem> {
  const screenshotPath = firstString(row, ['screenshot_path', 'attachment_path'], '')
  const productImage = await makeDisplayImage(
    firstString(row, ['product_image', 'image_url', 'image'], ''),
    screenshotPath
  )

  const quantity = firstNumber(row, ['quantity'], 1)
  const priceShown = firstNumber(row, ['price_shown', 'estimated_price', 'price'], 0)

  return {
    id: firstString(row, ['id'], ''),
    bagId: firstString(row, ['bag_id'], ''),
    userId: firstString(row, ['user_id'], ''),
    sourceUrl: firstString(row, ['source_url'], ''),
    sourcePlatform: firstString(row, ['source_platform'], 'other'),
    productName: firstString(row, ['product_name', 'title_snapshot', 'name'], 'Product request'),
    productImage,
    priceShown,
    quantity: quantity > 0 ? quantity : 1,
    notes: firstString(row, ['notes', 'customer_notes', 'variant_text'], ''),
    screenshotPath,
    screenshotUrl: screenshotPath ? await makeSignedScreenshotUrl(screenshotPath) : '',
    createdAt: firstString(row, ['created_at'], ''),
    updatedAt: firstString(row, ['updated_at'], firstString(row, ['created_at'], '')),
  }
}

async function fetchRequestBagItems(bagId: string) {
  const { data, error } = await supabase
    .from('customer_request_bag_items')
    .select('*')
    .eq('bag_id', bagId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return Promise.all(((data ?? []) as AnyRow[]).map(makeRequestBagItemDisplay))
}

async function makeRequestBagDisplay(row: AnyRow): Promise<RequestBag> {
  const items = await fetchRequestBagItems(firstString(row, ['id'], ''))

  return {
    id: firstString(row, ['id'], ''),
    userId: firstString(row, ['user_id'], ''),
    status: normalizeBagStatus(firstValue(row, ['status'])),
    customerName: firstString(row, ['customer_name'], ''),
    customerPhone: firstString(row, ['customer_phone'], ''),
    deliveryAddress: firstString(row, ['delivery_address'], ''),
    customerNotes: firstString(row, ['customer_notes'], ''),
    submittedOrderId: firstString(row, ['submitted_order_id'], ''),
    items,
    createdAt: firstString(row, ['created_at'], ''),
    updatedAt: firstString(row, ['updated_at'], firstString(row, ['created_at'], '')),
  }
}

export async function fetchActiveRequestBag(userId: string) {
  if (!userId) throw new Error('Please sign in to view your Request Bag.')
  const row = await ensureActiveRequestBagRow(userId)
  return makeRequestBagDisplay(row)
}

export async function getRequestBagItemCount(userId: string) {
  if (!userId) return 0

  const bag = await findActiveRequestBagRow(userId)
  if (!bag?.id) return 0

  const { count, error } = await supabase
    .from('customer_request_bag_items')
    .select('id', { count: 'exact', head: true })
    .eq('bag_id', String(bag.id))

  if (error) {
    console.warn('[customerOrders] Request Bag count skipped:', error)
    return 0
  }

  return count ?? 0
}

async function uploadRequestBagScreenshot(userId: string, bagId: string, file: File) {
  const path = makeStoragePath(userId, `request-bag/${bagId}`, file, 'item')

  const { error } = await supabase.storage.from('order-screenshots').upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || 'image/jpeg',
    upsert: false,
  })

  if (error) throw error
  return path
}

export async function addItemToRequestBag(input: AddRequestBagItemInput) {
  if (!input.userId) throw new Error('Please sign in before adding items to your Request Bag.')

  const sourceUrl = input.item.sourceUrl ? normalizeProductUrl(input.item.sourceUrl) || cleanText(input.item.sourceUrl) : ''
  const screenshotFile = input.item.screenshotFile
  if (!sourceUrl && !screenshotFile) throw new Error('Please paste a product link or upload a screenshot.')

  const bag = await ensureActiveRequestBagRow(input.userId)
  let screenshotPath = cleanText(input.item.attachmentPath)

  try {
    if (screenshotFile) {
      screenshotPath = await uploadRequestBagScreenshot(input.userId, firstString(bag, ['id'], ''), screenshotFile)
    }

    const platform = platformToDbValue(input.item.sourcePlatform || detectSourcePlatformFromUrl(sourceUrl))
    const quantity = Number(input.item.quantity ?? 1)
    const priceShown = Number(input.item.price ?? 0)

    const { data, error } = await supabase
      .from('customer_request_bag_items')
      .insert({
        bag_id: firstString(bag, ['id'], ''),
        user_id: input.userId,
        source_url: sourceUrl || null,
        source_platform: platform,
        product_name: cleanText(input.item.productName) || (sourceUrl ? productNameFromPlatform(platform) : 'Screenshot product request'),
        product_image: cleanText(input.item.productImage) || null,
        price_shown: Number.isFinite(priceShown) && priceShown > 0 ? priceShown : null,
        quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
        notes: cleanText(input.item.notes) || null,
        screenshot_path: screenshotPath || null,
      })
      .select('*')
      .single()

    if (error) throw error

    await supabase
      .from('customer_request_bags')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', firstString(bag, ['id'], ''))

    return makeRequestBagItemDisplay(data as AnyRow)
  } catch (error) {
    if (screenshotPath && screenshotFile) {
      await supabase.storage.from('order-screenshots').remove([screenshotPath])
    }
    throw error
  }
}

export async function updateRequestBagItem(
  userId: string,
  itemId: string,
  patch: Partial<Pick<RequestBagItem, 'productName' | 'priceShown' | 'quantity' | 'notes'>>
) {
  if (!userId || !itemId) throw new Error('Missing Request Bag item.')

  const payload: AnyRow = {
    updated_at: new Date().toISOString(),
  }

  if (patch.productName !== undefined) payload.product_name = cleanText(patch.productName) || 'Product request'
  if (patch.priceShown !== undefined) {
    const price = Number(patch.priceShown)
    payload.price_shown = Number.isFinite(price) && price > 0 ? price : null
  }
  if (patch.quantity !== undefined) {
    const quantity = Number(patch.quantity)
    payload.quantity = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1
  }
  if (patch.notes !== undefined) payload.notes = cleanText(patch.notes) || null

  const { error } = await supabase
    .from('customer_request_bag_items')
    .update(payload)
    .eq('id', itemId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function removeRequestBagItem(userId: string, itemId: string) {
  if (!userId || !itemId) throw new Error('Missing Request Bag item.')

  const { data: existing } = await supabase
    .from('customer_request_bag_items')
    .select('screenshot_path')
    .eq('id', itemId)
    .eq('user_id', userId)
    .maybeSingle()

  const { error } = await supabase
    .from('customer_request_bag_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', userId)

  if (error) throw error

  const screenshotPath = firstString(existing as AnyRow | null, ['screenshot_path'], '')
  if (screenshotPath) {
    await supabase.storage.from('order-screenshots').remove([screenshotPath])
  }
}

export async function submitRequestBagAsOrder(input: SubmitRequestBagInput): Promise<SubmitPasteLinkOrderResult> {
  if (!input.userId) throw new Error('Please sign in before requesting a quotation.')
  if (!input.bagId) throw new Error('Request Bag not found.')

  const { data: bagRow, error: bagError } = await supabase
    .from('customer_request_bags')
    .select('*')
    .eq('id', input.bagId)
    .eq('user_id', input.userId)
    .eq('status', 'active')
    .maybeSingle()

  if (bagError) throw bagError
  if (!bagRow) throw new Error('Request Bag not found or already submitted.')

  const { data: itemRows, error: itemsError } = await supabase
    .from('customer_request_bag_items')
    .select('*')
    .eq('bag_id', input.bagId)
    .eq('user_id', input.userId)
    .order('created_at', { ascending: true })

  if (itemsError) throw itemsError

  const items = ((itemRows ?? []) as AnyRow[]).map((item) => ({
    sourceUrl: firstString(item, ['source_url'], ''),
    sourcePlatform: firstString(item, ['source_platform'], 'other'),
    productName: firstString(item, ['product_name'], 'Product request'),
    productImage: firstString(item, ['product_image'], ''),
    price: firstNumber(item, ['price_shown'], 0),
    quantity: firstNumber(item, ['quantity'], 1),
    notes: firstString(item, ['notes'], ''),
    attachmentPath: firstString(item, ['screenshot_path'], ''),
  }))

  if (items.length === 0) throw new Error('Your Request Bag is empty.')

  const result = await submitPasteLinkOrder({
    userId: input.userId,
    email: input.email,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    deliveryAddress: input.deliveryAddress,
    customerNotes:
      cleanText(input.customerNotes) ||
      `Request Bag submitted by customer. Name: ${cleanText(input.customerName)}. Phone: ${cleanText(input.customerPhone)}.`,
    items,
  })

  const { error: updateError } = await supabase
    .from('customer_request_bags')
    .update({
      status: 'submitted',
      submitted_order_id: result.orderId,
      customer_name: cleanText(input.customerName),
      customer_phone: cleanText(input.customerPhone),
      delivery_address: cleanText(input.deliveryAddress),
      customer_notes: cleanText(input.customerNotes) || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.bagId)
    .eq('user_id', input.userId)

  if (updateError) {
    console.warn('[customerOrders] Request Bag submitted but status update failed:', updateError)
  }

  return result
}
