import { supabase } from '@/lib/supabase'
import {
  assertCustomerAppAvailable,
  assertNewShoppingRequestsAllowed,
} from '@/lib/appSettings'
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
  PaymentType,
  PaymentMethod,
  PaymentCoverage,
  PaymentStatus,
  PaymentSummary,
  Quotation,
  TrackingEvent,
  QuotationItem,
  QuotationStatus,
  RequestBag,
  RequestBagItem,
  ServiceChargeRule,
  User,
  VerificationBadge,
  FulfillmentMode,
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
  trackingEvents: AnyRow[]
}

export type PaymentSourceBank = 'bob' | 'dk' | 'bnb'

export function normalizePaymentReference(value: unknown) {
  return cleanText(value).toUpperCase().replace(/[^A-Z0-9]+/g, '')
}

export function paymentSourceBankLabel(value: unknown) {
  const bank = cleanText(value).toLowerCase()
  if (bank === 'bob') return 'Bank of Bhutan'
  if (bank === 'dk') return 'DK Bank'
  if (bank === 'bnb') return 'Bhutan National Bank'
  return 'Not specified'
}

function normalizePaymentSourceBank(value: unknown): PaymentSourceBank | '' {
  const bank = cleanText(value).toLowerCase()
  return bank === 'bob' || bank === 'dk' || bank === 'bnb' ? bank : ''
}

export type PaymentProofInput = {
  order: Order
  userId: string
  file: File
  paymentMethodName: string
  paymentMethodId?: string
  paymentMethodType?: PaymentMethod['type'] | string
  sourceBank: PaymentSourceBank
  transactionId: string
  amount: number
  paymentType?: PaymentType | string
  note?: string
}

export type AdminPaymentRecord = Payment & {
  orderNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  orderStatus: OrderStatus
  proofPath?: string
  paymentType: PaymentType
  sourceBank: PaymentSourceBank | ''
  normalizedTransactionId: string
  duplicateReferenceCount: number
}

export type CustomerPaymentHistoryRecord = {
  id: string
  orderId: string
  orderNumber: string
  quotationId: string
  transactionId: string
  normalizedTransactionId: string
  sourceBank: PaymentSourceBank | ''
  receiptVerificationToken: string
  amount: number
  currency: string
  orderTotal: number
  previouslyVerified: number
  balanceDue: number
  paymentType: PaymentType
  paymentMethod: string
  status: PaymentStatus
  proofUrl: string
  customerName: string
  customerPhone: string
  submittedAt: string
  verifiedAt: string
  rejectionReason: string
  adminNotes: string
  createdAt: string
}

export type CustomerPaymentHistorySummary = {
  totalPayments: number
  verifiedCount: number
  pendingCount: number
  rejectedCount: number
  verifiedPaid: number
  pendingAmount: number
  rejectedAmount: number
}

export type CustomerPaymentHistoryResult = {
  payments: CustomerPaymentHistoryRecord[]
  summary: CustomerPaymentHistorySummary
}

export type AdminCustomerRecord = {
  id: string
  name: string
  email: string
  phone: string
  dzongkhag: string
  orders: number
  totalSpent: number
  joined: string
  lastOrderAt?: string
  isActive: boolean
  accountStatus: 'active' | 'deactivated' | 'unknown'
  deactivatedAt?: string
  deactivationReason?: string
  mustChangePassword: boolean
  passwordResetByAdminAt?: string
  accountType: 'phone_only' | 'email'
  verificationBadge: VerificationBadge
  verifiedAt?: string
  verifiedBy?: string
  verificationNote?: string
}

export type AdminTemporaryPasswordResetResult = {
  userId: string
  temporaryPassword: string
  mustChangePassword: boolean
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
  payableProductTotal?: number
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
  fulfillmentMode?: FulfillmentMode | string
  pickupHubId?: string | null
  pickupHubName?: string | null
  pickupInstructions?: string | null
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


const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'default-bank-bob',
    name: 'Bank Transfer',
    type: 'bank_transfer',
    accountNumber: '',
    accountName: 'Shop2Bhutan',
    bankName: '',
    branch: '',
    qrImage: '',
    instructions: 'Transfer to the listed bank account and upload the payment screenshot with visible transaction/reference number.',
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'default-mobile-banking',
    name: 'Mobile Banking',
    type: 'mobile_banking',
    accountNumber: '',
    accountName: 'Shop2Bhutan',
    bankName: '',
    branch: '',
    qrImage: '',
    instructions: 'Transfer using mobile banking and upload the payment screenshot with visible transaction/reference number.',
    isActive: true,
    sortOrder: 2,
  },
]


const DEFAULT_PICKUP_HUBS = [
  {
    id: 'jaigaon_pickup_point',
    name: 'Collect from Jaigaon',
    instructions:
      'Choose this only if the customer can personally collect the parcel from the Jaigaon pickup point. Shop2Bhutan coordinates the order, but Bhutan delivery is not included.',
  },
  {
    id: 'shop2bhutan_handover',
    name: 'Collect from Shop2Bhutan',
    instructions:
      'Shop2Bhutan receives the item and shares the pickup location and timing after it arrives. Delivery to the customer address is not included.',
  },
]

function normalizeFulfillmentModeValue(value: unknown): FulfillmentMode {
  return cleanText(value).toLowerCase() === 'self_pickup' ? 'self_pickup' : 'delivery'
}

function defaultPickupHub() {
  return DEFAULT_PICKUP_HUBS[0]
}

function resolvePickupHub(input: Pick<SubmitPasteLinkOrderInput, 'pickupHubId' | 'pickupHubName' | 'pickupInstructions'>) {
  const id = cleanText(input.pickupHubId).toLowerCase() || defaultPickupHub().id
  const fallback = DEFAULT_PICKUP_HUBS.find((hub) => hub.id === id) || defaultPickupHub()

  return {
    id,
    name: cleanText(input.pickupHubName) || fallback.name,
    instructions: cleanText(input.pickupInstructions) || fallback.instructions,
  }
}

function makeFulfillmentAddress(input: Pick<SubmitPasteLinkOrderInput, 'deliveryAddress' | 'fulfillmentMode' | 'pickupHubId' | 'pickupHubName' | 'pickupInstructions'>) {
  const mode = normalizeFulfillmentModeValue(input.fulfillmentMode)
  if (mode !== 'self_pickup') return cleanText(input.deliveryAddress)

  const hub = resolvePickupHub(input)
  return `Self Pickup — ${hub.name}`
}

function makeFulfillmentNote(input: Pick<SubmitPasteLinkOrderInput, 'fulfillmentMode' | 'pickupHubId' | 'pickupHubName' | 'pickupInstructions'>) {
  const mode = normalizeFulfillmentModeValue(input.fulfillmentMode)
  if (mode !== 'self_pickup') return 'Fulfillment: Delivery to customer address.'

  const hub = resolvePickupHub(input)
  return `Fulfillment: Self Pickup. ${hub.instructions}`
}

function fulfillmentSource(row: AnyRow) {
  const nested = firstJsonObject(row, ['shipping_address', 'delivery_address_json', 'address'])
  return { ...row, ...nested }
}

function orderFulfillmentMode(row: AnyRow): FulfillmentMode {
  const source = fulfillmentSource(row)
  return normalizeFulfillmentModeValue(firstValue(source, ['fulfillment_mode', 'fulfillmentMode']))
}

function orderPickupHubId(row: AnyRow) {
  const source = fulfillmentSource(row)
  return firstString(source, ['pickup_hub_id', 'pickupHubId', 'delivery_hub_id', 'hub_id'], '')
}

function orderPickupHubName(row: AnyRow) {
  const source = fulfillmentSource(row)
  const hubId = orderPickupHubId(row)
  const fallback = DEFAULT_PICKUP_HUBS.find((hub) => hub.id === hubId) || defaultPickupHub()
  return firstString(source, ['pickup_hub_name', 'pickupHubName', 'delivery_hub_name', 'hub_name', 'delivery_hub'], fallback.name)
}

function orderPickupInstructions(row: AnyRow) {
  const source = fulfillmentSource(row)
  const hubId = orderPickupHubId(row)
  const fallback = DEFAULT_PICKUP_HUBS.find((hub) => hub.id === hubId) || defaultPickupHub()
  return firstString(source, ['pickup_instructions', 'pickupInstructions'], fallback.instructions)
}

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

function isJaigaonSelfPickupOrder(order: Order) {
  if (normalizeFulfillmentModeValue(order.fulfillmentMode) !== 'self_pickup') return false

  const pickupText = normalizeKey(
    [
      order.pickupHubId,
      order.pickupHubName,
      order.deliveryHub?.id,
      order.deliveryHub?.name,
      order.deliveryHub?.address,
    ].join(' ')
  )

  return pickupText.includes('jaigaon')
}

function isShop2BhutanHandoverPickup(order: Order) {
  if (normalizeFulfillmentModeValue(order.fulfillmentMode) !== 'self_pickup') return false

  const pickupText = normalizeKey(
    [
      order.pickupHubId,
      order.pickupHubName,
      order.deliveryHub?.id,
      order.deliveryHub?.name,
      order.deliveryHub?.address,
    ].join(' ')
  )

  return pickupText.includes('shop2bhutan') || pickupText.includes('handover')
}

export function resolveDeliveryDestinationKeyForOrder(order: Order) {
  if (isJaigaonSelfPickupOrder(order)) return 'jaigaon-pickup'

  // Shop2Bhutan handover means S2B still brings the item to the Bhutan-side
  // handover point, so keep a delivery/pickup handling fee. Until this hub is
  // made fully configurable, use the Thimphu delivery tier as the MVP default.
  if (isShop2BhutanHandoverPickup(order)) return 'thimphu'

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
  if (isJaigaonSelfPickupOrder(order)) {
    return {
      amount: 0,
      rule: undefined,
      needsManualQuote: false,
    }
  }

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

function orderEstimatedDeliveryFields(row: AnyRow) {
  return {
    estimatedDeliveryFrom: firstString(row, ['estimated_delivery_from', 'estimatedDeliveryFrom', 'eta_from', 'etaFrom'], ''),
    estimatedDeliveryTo: firstString(row, ['estimated_delivery_to', 'estimatedDeliveryTo', 'eta_to', 'etaTo'], ''),
    estimatedDeliveryNote: firstString(row, ['estimated_delivery_note', 'estimatedDeliveryNote', 'eta_note', 'etaNote'], ''),
    estimatedDeliveryUpdatedAt: firstString(row, ['estimated_delivery_updated_at', 'estimatedDeliveryUpdatedAt', 'eta_updated_at', 'etaUpdatedAt'], ''),
  }
}

function withOrderEstimatedDelivery(order: Order, row: AnyRow): Order {
  Object.assign(order as Order & Record<string, unknown>, orderEstimatedDeliveryFields(row))
  return order
}

function formatEstimatedDeliveryDateForNotification(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Thimphu',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function estimatedDeliverySummaryText(input: {
  estimatedDeliveryFrom?: string
  estimatedDeliveryTo?: string
  estimatedDeliveryNote?: string
}) {
  const from = formatEstimatedDeliveryDateForNotification(cleanText(input.estimatedDeliveryFrom))
  const to = formatEstimatedDeliveryDateForNotification(cleanText(input.estimatedDeliveryTo))
  const note = cleanText(input.estimatedDeliveryNote)

  let range = ''
  if (from && to && from !== to) range = `${from} – ${to}`
  else range = from || to

  if (range && note) return `Estimated delivery: ${range}. ${note}`
  if (range) return `Estimated delivery: ${range}.`
  if (note) return `Delivery note: ${note}`
  return ''
}

async function updateOrderEstimatedDelivery(input: {
  orderId: string
  estimatedDeliveryFrom?: string
  estimatedDeliveryTo?: string
  estimatedDeliveryNote?: string
}) {
  const orderId = cleanText(input.orderId)
  if (!orderId) return

  const from = cleanText(input.estimatedDeliveryFrom) || null
  const to = cleanText(input.estimatedDeliveryTo) || null
  const note = cleanText(input.estimatedDeliveryNote) || null
  const now = new Date().toISOString()

  const candidates: AnyRow[] = [
    {
      estimated_delivery_from: from,
      estimated_delivery_to: to,
      estimated_delivery_note: note,
      estimated_delivery_updated_at: now,
      updated_at: now,
    },
    {
      estimated_delivery_from: from,
      estimated_delivery_to: to,
      estimated_delivery_note: note,
      estimated_delivery_updated_at: now,
    },
    {
      eta_from: from,
      eta_to: to,
      eta_note: note,
      eta_updated_at: now,
      updated_at: now,
    },
  ]

  let lastError: unknown = null

  for (const payload of candidates) {
    const result = await supabase.from('orders').update(payload).eq('id', orderId)
    if (!result.error) return
    lastError = result.error
    if (!shouldTryFallbackPayload(result.error)) break
  }

  throw lastError instanceof Error ? lastError : new Error(errorMessage(lastError, 'Unable to update estimated delivery.'))
}


const PHONE_ONLY_EMAIL_SUFFIX = '@phone.shop2bhutan.com'

function isPhoneOnlyAuthEmail(value: unknown) {
  return cleanText(value).toLowerCase().endsWith(PHONE_ONLY_EMAIL_SUFFIX)
}

function getPublicCustomerEmail(profile: AnyRow) {
  const email = firstString(profile, ['email'], '')
  return isPhoneOnlyAuthEmail(email) ? '' : email
}

function getCustomerAccountType(profile: AnyRow): AdminCustomerRecord['accountType'] {
  const email = firstString(profile, ['email'], '')
  const hasRealEmail = firstValue(profile, ['has_real_email', 'hasRealEmail'])

  if (hasRealEmail === true) return 'email'
  if (hasRealEmail === false) return 'phone_only'

  return email && !isPhoneOnlyAuthEmail(email) ? 'email' : 'phone_only'
}

function normalizeVerificationBadgeValue(value: unknown): VerificationBadge {
  const raw = cleanText(value).toLowerCase()
  return raw === 'blue' || raw === 'gold' ? raw : 'none'
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
  const fulfillmentMode = normalizeFulfillmentModeValue(input.fulfillmentMode)
  const pickupHub = resolvePickupHub(input)
  const fullAddress = makeFulfillmentAddress(input)

  return {
    recipient_name: cleanText(input.customerName),
    phone: cleanText(input.customerPhone),
    customer_phone: cleanText(input.customerPhone),
    delivery_address: fullAddress,
    full_address: fullAddress,
    formatted_address: fullAddress,
    village: fullAddress,
    fulfillment_mode: fulfillmentMode,
    pickup_hub_id: fulfillmentMode === 'self_pickup' ? pickupHub.id : null,
    pickup_hub_name: fulfillmentMode === 'self_pickup' ? pickupHub.name : null,
    pickup_instructions: fulfillmentMode === 'self_pickup' ? pickupHub.instructions : null,
    delivery_hub_id: fulfillmentMode === 'self_pickup' ? pickupHub.id : undefined,
    delivery_hub_name: fulfillmentMode === 'self_pickup' ? pickupHub.name : undefined,
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


function makeFastDisplayImage(primary: unknown, fallbackPath?: unknown) {
  const primaryValue = cleanText(primary)
  if (primaryValue && isExternalOrDataUrl(primaryValue)) return primaryValue

  const fallbackValue = cleanText(fallbackPath)
  if (fallbackValue && isExternalOrDataUrl(fallbackValue)) return fallbackValue

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

export function normalizePaymentType(value: unknown): PaymentType {
  const raw = cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, '_')

  if (['full', 'full_payment', 'full_balance', 'paid_full'].includes(raw)) return 'full'
  if (['advance', 'advance_payment', 'partial', 'partial_payment', 'deposit'].includes(raw)) return 'advance'
  if (['balance', 'remaining', 'remaining_balance', 'remaining_payment', 'final', 'final_payment'].includes(raw)) return 'balance'

  return 'unknown'
}

function inferPaymentTypeFromAmounts(params: {
  explicitType?: unknown
  amount: number
  totalPayable?: number
  verifiedBefore?: number
}) {
  const explicit = normalizePaymentType(params.explicitType)
  const amount = numericAmount(params.amount)
  const totalPayable = numericAmount(params.totalPayable ?? 0)
  const verifiedBefore = numericAmount(params.verifiedBefore ?? 0)
  const remainingBefore = Math.max(totalPayable - verifiedBefore, 0)

  if (totalPayable > 0) {
    if (verifiedBefore > 0 && amount >= remainingBefore) return 'balance' as PaymentType
    if (verifiedBefore <= 0 && amount >= totalPayable) return 'full' as PaymentType
    if (amount > 0 && amount < totalPayable) return 'advance' as PaymentType
  }

  return explicit === 'unknown' ? 'full' : explicit
}


function normalizeTrackingEvent(row: AnyRow): TrackingEvent {
  const createdAt = firstString(
    row,
    ['event_time', 'event_at', 'status_at', 'created_at', 'updated_at'],
    new Date().toISOString()
  )

  return {
    id: firstString(row, ['id'], `${firstString(row, ['order_id'], 'order')}-${createdAt}`),
    orderId: firstString(row, ['order_id'], ''),
    status: normalizeOrderStatus(firstValue(row, ['status', 'order_status'])),
    title: firstString(row, ['title'], 'Order update'),
    message: firstString(row, ['message', 'description', 'notes'], ''),
    location: firstString(row, ['location'], ''),
    visibleToCustomer: Boolean(firstValue(row, ['visible_to_customer', 'is_customer_visible', 'visibleToCustomer']) ?? true),
    createdBy: firstString(row, ['created_by', 'admin_id', 'user_id'], ''),
    sellerReference: firstString(row, ['seller_reference', 'seller_order_reference', 'seller_order_ref', 'external_reference'], ''),
    adminNote: firstString(row, ['admin_note', 'admin_notes', 'notes'], ''),
    createdAt,
  }
}

function sortTrackingEvents(events: TrackingEvent[]) {
  return [...events].sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime() || 0
    const bTime = new Date(b.createdAt || 0).getTime() || 0
    return aTime - bTime
  })
}

function trackingEventBelongsToOrder(event: AnyRow, row: AnyRow) {
  return String(event.order_id ?? '') === String(row.id ?? '')
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
    readAt: firstString(row, ['read_at', 'readAt'], ''),
    dedupeKey: firstString(row, ['dedupe_key', 'dedupeKey'], ''),
    createdAt: firstString(row, ['created_at'], new Date().toISOString()),
  }
}

function emitNotificationUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('shop2bhutan:notifications-updated'))
  }
}


function makeEmptyCustomerPaymentHistory(): CustomerPaymentHistoryResult {
  return {
    payments: [],
    summary: {
      totalPayments: 0,
      verifiedCount: 0,
      pendingCount: 0,
      rejectedCount: 0,
      verifiedPaid: 0,
      pendingAmount: 0,
      rejectedAmount: 0,
    },
  }
}

function orderNumberFromPaymentHistoryOrder(row: AnyRow | undefined, fallbackOrderId: string) {
  if (!row) return fallbackOrderId ? fallbackOrderId.slice(0, 8).toUpperCase() : 'Order'
  return (
    firstString(row, ['order_no', 'order_number', 'order_id', 'public_id'], '') ||
    (fallbackOrderId ? fallbackOrderId.slice(0, 8).toUpperCase() : 'Order')
  )
}

function paymentHistoryEventTime(row: AnyRow) {
  const value = firstString(row, ['verified_at', 'submitted_at', 'created_at', 'updated_at'], '')
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isFinite(timestamp) ? timestamp : 0
}

function paymentHistoryQuotationRow(payment: AnyRow, quotationRows: AnyRow[]) {
  const quotationId = firstString(payment, ['quotation_id'], '')
  if (quotationId) {
    const exact = quotationRows.find((row) => firstString(row, ['id'], '') === quotationId)
    if (exact) return exact
  }

  const orderId = firstString(payment, ['order_id'], '')
  return quotationRows
    .filter((row) => firstString(row, ['order_id'], '') === orderId)
    .sort((a, b) => {
      const bTime = new Date(firstString(b, ['updated_at', 'created_at'], '') || 0).getTime() || 0
      const aTime = new Date(firstString(a, ['updated_at', 'created_at'], '') || 0).getTime() || 0
      return bTime - aTime
    })[0]
}

function verifiedAmountBeforePayment(payment: AnyRow, allPayments: AnyRow[]) {
  const paymentId = firstString(payment, ['id'], '')
  const orderId = firstString(payment, ['order_id'], '')
  const currentTime = paymentHistoryEventTime(payment)

  return allPayments
    .filter((row) => firstString(row, ['order_id'], '') === orderId)
    .filter((row) => firstString(row, ['id'], '') !== paymentId)
    .filter((row) => normalizePaymentStatus(firstValue(row, ['status'])) === 'verified')
    .filter((row) => {
      const rowTime = paymentHistoryEventTime(row)
      return currentTime <= 0 || rowTime <= currentTime
    })
    .reduce((sum, row) => sum + firstNumber(row, ['amount', 'total_amount', 'advance_paid'], 0), 0)
}

async function mapCustomerPaymentHistoryRow(
  payment: AnyRow,
  orderById: Map<string, AnyRow>,
  quotationRows: AnyRow[],
  allPayments: AnyRow[],
  profile: AnyRow | null,
): Promise<CustomerPaymentHistoryRecord> {
  const orderId = firstString(payment, ['order_id'], '')
  const orderRow = orderById.get(orderId)
  const quotationRow = paymentHistoryQuotationRow(payment, quotationRows)
  const proofPath = firstString(payment, ['proof_file_path', 'screenshot_url', 'payment_proof_url', 'proof_url'], '')
  const proofUrl = proofPath ? (await makeSignedScreenshotUrl(proofPath)) || proofPath : ''
  const status = normalizePaymentStatus(firstValue(payment, ['status']))
  const submittedAt = firstString(payment, ['submitted_at', 'created_at'], '')
  const createdAt = firstString(payment, ['created_at', 'submitted_at'], submittedAt)
  const amount = firstNumber(payment, ['amount', 'total_amount', 'advance_paid'], 0)
  const orderTotal = firstNumber(quotationRow, ['total_amount', 'total'], 0)
  const previouslyVerified = verifiedAmountBeforePayment(payment, allPayments)
  const verifiedThroughThisPayment = previouslyVerified + (status === 'verified' ? amount : 0)
  const customerName =
    firstString(orderRow, ['customer_name', 'recipient_name', 'delivery_name', 'full_name', 'name'], '') ||
    firstString(profile, ['full_name', 'name', 'display_name'], 'Customer')
  const customerPhone =
    firstString(orderRow, ['customer_phone', 'recipient_phone', 'delivery_phone', 'phone', 'whatsapp'], '') ||
    firstString(profile, ['phone', 'mobile', 'whatsapp'], '')

  return {
    id: firstString(payment, ['id'], ''),
    orderId,
    orderNumber: orderNumberFromPaymentHistoryOrder(orderRow, orderId),
    quotationId: firstString(payment, ['quotation_id'], ''),
    transactionId: firstString(payment, ['transaction_id', 'reference_id', 'txn_id'], ''),
    normalizedTransactionId:
      firstString(
        payment,
        ['normalized_transaction_id', 'normalizedTransactionId'],
        '',
      ) ||
      normalizePaymentReference(
        firstValue(payment, ['transaction_id', 'reference_id', 'txn_id']),
      ),
    sourceBank: normalizePaymentSourceBank(
      firstValue(payment, ['source_bank', 'sourceBank']),
    ),
    receiptVerificationToken: firstString(
      payment,
      ['receipt_verification_token', 'receiptVerificationToken'],
      '',
    ),
    amount,
    currency: firstString(payment, ['currency'], 'BTN'),
    orderTotal,
    previouslyVerified,
    balanceDue: orderTotal > 0 ? Math.max(orderTotal - verifiedThroughThisPayment, 0) : 0,
    paymentType: normalizePaymentType(firstValue(payment, ['payment_type', 'payment_kind', 'coverage_type'])),
    paymentMethod: firstString(payment, ['payment_method_name', 'method_name', 'method', 'payment_method'], ''),
    status,
    proofUrl,
    customerName,
    customerPhone,
    submittedAt,
    verifiedAt: firstString(payment, ['verified_at'], ''),
    rejectionReason: firstString(payment, ['rejection_reason'], ''),
    adminNotes: firstString(payment, ['admin_notes', 'notes'], ''),
    createdAt,
  }
}

function summarizeCustomerPaymentHistory(payments: CustomerPaymentHistoryRecord[]): CustomerPaymentHistorySummary {
  return payments.reduce<CustomerPaymentHistorySummary>(
    (summary, payment) => {
      const amount = numericAmount(payment.amount)

      summary.totalPayments += 1

      if (payment.status === 'verified') {
        summary.verifiedCount += 1
        summary.verifiedPaid += amount
      } else if (payment.status === 'rejected') {
        summary.rejectedCount += 1
        summary.rejectedAmount += amount
      } else {
        summary.pendingCount += 1
        summary.pendingAmount += amount
      }

      return summary
    },
    {
      totalPayments: 0,
      verifiedCount: 0,
      pendingCount: 0,
      rejectedCount: 0,
      verifiedPaid: 0,
      pendingAmount: 0,
      rejectedAmount: 0,
    }
  )
}

export async function fetchCustomerPaymentHistory(userId: string): Promise<CustomerPaymentHistoryResult> {
  const cleanUserId = cleanText(userId)
  if (!cleanUserId) return makeEmptyCustomerPaymentHistory()

  const primarySelect =
    'id, order_id, quotation_id, user_id, payment_type, payment_method, payment_method_name, source_bank, transaction_id, normalized_transaction_id, receipt_verification_token, amount, currency, proof_file_path, status, submitted_at, verified_at, rejection_reason, admin_notes, created_at, updated_at'

  let paymentData: AnyRow[] = []
  let lastPaymentError: unknown = null

  const primary = await supabase
    .from('payments')
    .select(primarySelect)
    .eq('user_id', cleanUserId)
    .order('submitted_at', { ascending: false })
    .limit(100)

  if (!primary.error) {
    paymentData = (primary.data ?? []) as AnyRow[]
  } else {
    lastPaymentError = primary.error
    const fallback = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', cleanUserId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (!fallback.error) {
      paymentData = (fallback.data ?? []) as AnyRow[]
    } else if (isMissingColumnOrRelationError(primary.error) || isMissingColumnOrRelationError(fallback.error)) {
      return makeEmptyCustomerPaymentHistory()
    } else {
      throw fallback.error || primary.error
    }
  }

  const orderIds = Array.from(
    new Set(
      paymentData
        .map((payment) => firstString(payment, ['order_id'], ''))
        .filter(Boolean)
    )
  )

  const orderById = new Map<string, AnyRow>()
  let quotationRows: AnyRow[] = []
  let customerProfile: AnyRow | null = null

  if (orderIds.length > 0) {
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .in('id', orderIds)

    if (!orderError) {
      for (const row of (orderData ?? []) as AnyRow[]) {
        const id = firstString(row, ['id'], '')
        if (id) orderById.set(id, row)
      }
    } else if (!isMissingColumnOrRelationError(orderError)) {
      console.warn('[customerOrders] payment history order lookup skipped:', errorMessage(orderError, 'Unable to load related orders.'))
    }

    const { data: quotationData, error: quotationError } = await supabase
      .from('quotations')
      .select('*')
      .in('order_id', orderIds)

    if (!quotationError) {
      quotationRows = (quotationData ?? []) as AnyRow[]
    } else if (!isMissingColumnOrRelationError(quotationError)) {
      console.warn('[customerOrders] payment history quotation lookup skipped:', errorMessage(quotationError, 'Unable to load quotation totals.'))
    }
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', cleanUserId)
    .maybeSingle()

  if (!profileError) {
    customerProfile = (profileData ?? null) as AnyRow | null
  } else if (!isMissingColumnOrRelationError(profileError)) {
    console.warn('[customerOrders] payment history profile lookup skipped:', errorMessage(profileError, 'Unable to load customer profile.'))
  }

  try {
    const payments = await Promise.all(
      paymentData.map((payment) =>
        mapCustomerPaymentHistoryRow(
          payment,
          orderById,
          quotationRows,
          paymentData,
          customerProfile,
        )
      )
    )

    const sortedPayments = payments.sort((a, b) => {
      const bTime = new Date(b.submittedAt || b.createdAt || 0).getTime() || 0
      const aTime = new Date(a.submittedAt || a.createdAt || 0).getTime() || 0
      return bTime - aTime
    })

    return {
      payments: sortedPayments,
      summary: summarizeCustomerPaymentHistory(sortedPayments),
    }
  } catch (error) {
    if (lastPaymentError && !paymentData.length) {
      throw lastPaymentError instanceof Error ? lastPaymentError : new Error(errorMessage(lastPaymentError, 'Unable to load payment history.'))
    }
    throw error
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


export async function fetchAdminNotifications(adminId: string): Promise<AppNotification[]> {
  return fetchCustomerNotifications(adminId)
}

export async function getUnreadAdminNotificationCount(adminId: string): Promise<number> {
  return getUnreadNotificationCount(adminId)
}

export async function markAdminNotificationRead(notificationId: string, adminId: string) {
  return markCustomerNotificationRead(notificationId, adminId)
}

export async function markAllAdminNotificationsRead(adminId: string) {
  return markAllCustomerNotificationsRead(adminId)
}

export async function deleteAllCustomerNotifications(userId: string) {
  if (!userId) return

  const result = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId)

  if (result.error && !isMissingColumnOrRelationError(result.error)) {
    throw result.error
  }

  emitNotificationUpdated()
}

export async function deleteAllAdminNotifications(adminId: string) {
  return deleteAllCustomerNotifications(adminId)
}

async function fetchAdminNotificationTargetUserIds() {
  const { data, error } = await supabase
    .from('user_roles')
    .select('user_id, role')
    .in('role', ['admin', 'super_admin'])

  if (error) {
    console.warn('[customerOrders] admin notification targets skipped:', error.message)
    return [] as string[]
  }

  return Array.from(
    new Set(
      ((data ?? []) as AnyRow[])
        .map((row) => firstString(row, ['user_id', 'profile_id', 'id'], ''))
        .filter(Boolean)
    )
  )
}

async function createAdminNotificationForAdmins(input: {
  type: AppNotification['type']
  title: string
  message: string
  link?: string
  dedupeKey?: string
}) {
  try {
    const adminIds = await fetchAdminNotificationTargetUserIds()
    if (adminIds.length === 0) return

    const results = await Promise.allSettled(
      adminIds.map((adminId) =>
        createCustomerNotification({
          userId: adminId,
          type: input.type,
          title: input.title,
          message: input.message,
          link: input.link,
          dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${adminId}` : undefined,
        })
      )
    )

    const rejected = results.find((result) => result.status === 'rejected')
    if (rejected && rejected.status === 'rejected') {
      console.warn('[customerOrders] one or more admin notifications were skipped:', rejected.reason)
    }
  } catch (error) {
    console.warn('[customerOrders] admin notification skipped:', error)
  }
}



async function fetchCustomerNotificationTargetUserIds() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[customerOrders] customer notification targets skipped:', error.message)
    return [] as string[]
  }

  let adminIds = new Set<string>()

  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('user_id, role')
    .in('role', ['admin', 'super_admin'])

  if (!roleError) {
    adminIds = new Set(
      ((roleData ?? []) as AnyRow[])
        .map((row) => firstString(row, ['user_id', 'profile_id', 'id'], ''))
        .filter(Boolean)
    )
  } else {
    console.warn('[customerOrders] customer notification role filter skipped:', roleError.message)
  }

  return Array.from(
    new Set(
      ((data ?? []) as AnyRow[])
        .filter((row) => {
          const id = firstString(row, ['id', 'user_id', 'profile_id'], '')
          if (!id || adminIds.has(id)) return false

          const isGuestProfile = Boolean(
            firstValue(row, [
              'is_guest',
              'is_anonymous',
              'anonymous',
              'isGuest',
              'isAnonymous',
            ])
          )

          return !isGuestProfile
        })
        .map((row) => firstString(row, ['id', 'user_id', 'profile_id'], ''))
        .filter(Boolean)
    )
  )
}

function formatParcelTripNotificationDate(value?: string | null) {
  if (!value) return 'the selected date'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'the selected date'

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Thimphu',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function formatParcelTripNotificationCutoff(value?: string | null) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const dateText = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Thimphu',
    day: 'numeric',
    month: 'short',
  }).format(date)

  const timeText = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Thimphu',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)

  return `${dateText}, ${timeText}`
}

export async function createCustomerParcelTripOpenNotifications(input: {
  tripId: string
  title?: string | null
  origin?: string | null
  destination?: string | null
  goingDate?: string | null
  bookingCutoffAt?: string | null
  eventKey?: string | null
}) {
  try {
    const tripId = cleanText(input.tripId)
    if (!tripId) return

    const origin = cleanText(input.origin) || 'Thimphu'
    const destination = cleanText(input.destination) || 'Phuentsholing'
    const route = `${origin} ↔ ${destination}`
    const dateText = formatParcelTripNotificationDate(input.goingDate)
    const cutoffText = formatParcelTripNotificationCutoff(input.bookingCutoffAt)
    const eventKey = cleanText(input.eventKey) || new Date().toISOString()

    const customerIds = await fetchCustomerNotificationTargetUserIds()
    if (customerIds.length === 0) return

    const message = cutoffText
      ? `${route} trip is open for ${dateText}. Book before ${cutoffText} BTT.`
      : `${route} trip is open for ${dateText}. Book your parcel now.`

    const results = await Promise.allSettled(
      customerIds.map((userId) =>
        createCustomerNotification({
          userId,
          type: 'system',
          title: 'New Parcel Trip Open',
          message,
          link: '/parcel',
          dedupeKey: `parcel-trip-open:${tripId}:${eventKey}:${userId}`,
        })
      )
    )

    const rejected = results.find((result) => result.status === 'rejected')
    if (rejected && rejected.status === 'rejected') {
      console.warn(
        '[customerOrders] one or more parcel trip notifications were skipped:',
        rejected.reason,
      )
    }
  } catch (error) {
    console.warn('[customerOrders] customer parcel trip notification skipped:', error)
  }
}


export async function createAdminPasswordResetRequestedNotification(input: {
  identifier?: string | null
  loginEmail?: string | null
  phone?: string | null
}) {
  try {
    const identifier = cleanText(input.identifier)
    const loginEmail = cleanText(input.loginEmail)
    const phone = cleanText(input.phone)
    const display = phone || (isPhoneOnlyAuthEmail(loginEmail) ? '' : loginEmail) || identifier || 'a customer account'

    await createAdminNotificationForAdmins({
      type: 'system',
      title: 'Password Reset Requested',
      message: `A customer requested help resetting the password for ${display}. Please verify the customer before issuing a temporary password.`,
      link: '/admin/customers',
      dedupeKey: `admin:password-reset-request:${normalizeKey(display || identifier || Date.now())}:${new Date().toISOString().slice(0, 13)}`,
    })
  } catch (error) {
    console.warn('[customerOrders] password reset request admin notification skipped:', error)
  }
}

async function createAdminOrderSubmittedNotification(input: {
  orderId: string
  orderNo: string
  customerName?: string | null
  customerPhone?: string | null
  itemCount?: number
}) {
  const orderId = cleanText(input.orderId)
  if (!orderId) return

  const orderNo = cleanText(input.orderNo) || orderId.slice(0, 8).toUpperCase()
  const customerName = cleanText(input.customerName) || 'Customer'
  const customerPhone = cleanText(input.customerPhone)
  const itemCount = Number(input.itemCount || 0)
  const itemText = itemCount > 0 ? `${itemCount} item${itemCount === 1 ? '' : 's'}` : 'an order request'

  await createAdminNotificationForAdmins({
    type: 'order_update',
    title: 'New Shopping Request',
    message: `${customerName}${customerPhone ? ` (${customerPhone})` : ''} submitted ${itemText} for shopping request #${orderNo}.`,
    link: `/admin/orders/${orderId}`,
    dedupeKey: `admin:new-order:${orderId}`,
  })
}

async function createAdminPaymentUploadedNotification(input: {
  order: Order
  amount: number
  paymentType?: PaymentType | string
  transactionId?: string
}) {
  const order = input.order
  const orderNo = cleanText(order.orderNumber) || order.id.slice(0, 8).toUpperCase()
  const customerName = cleanText(order.user?.name) || cleanText(order.shippingAddress?.recipientName) || 'Customer'
  const amount = numericAmount(input.amount)
  const transactionId = cleanText(input.transactionId)
  const paymentType = normalizePaymentType(input.paymentType)
  const paymentTypeText =
    paymentType === 'advance' ? 'advance payment'
    : paymentType === 'balance' ? 'remaining balance payment'
    : 'full payment'
  const eventKey = transactionId || new Date().toISOString()

  await createAdminNotificationForAdmins({
    type: 'payment',
    title: 'Payment Proof Uploaded',
    message: `${customerName} uploaded ${amount > 0 ? `Nu. ${amount.toLocaleString()}` : 'a payment proof'} as ${paymentTypeText} for order #${orderNo}.`,
    link: `/admin/orders/${order.id}`,
    dedupeKey: `admin:payment-uploaded:${order.id}:${eventKey}`,
  })
}

async function createCustomerPaymentSubmittedNotification(input: {
  order: Order
  userId: string
  amount: number
  paymentType?: PaymentType | string
  transactionId?: string
}) {
  const userId = cleanText(input.userId)
  if (!userId) return

  const order = input.order
  const orderNo = cleanText(order.orderNumber) || order.id.slice(0, 8).toUpperCase()
  const amount = numericAmount(input.amount)
  const transactionId = cleanText(input.transactionId)
  const paymentType = normalizePaymentType(input.paymentType)
  const paymentTypeText =
    paymentType === 'advance' ? 'advance payment'
    : paymentType === 'balance' ? 'remaining balance payment'
    : 'payment proof'
  const eventKey = transactionId || new Date().toISOString()

  await createCustomerNotification({
    userId,
    type: 'payment',
    title: 'Payment Proof Submitted',
    message: `Your ${paymentTypeText} of ${amount > 0 ? `Nu. ${amount.toLocaleString()}` : 'the selected amount'} for order #${orderNo} has been submitted and is pending verification.`,
    link: `/order/${order.id}`,
    dedupeKey: `customer:payment-submitted:${order.id}:${eventKey}`,
  })
}

async function createAdminQuotationResponseNotification(input: {
  orderId: string
  quotationId?: string
  response: 'accepted' | 'rejected'
}) {
  const orderId = cleanText(input.orderId)
  if (!orderId) return

  let orderNo = orderId.slice(0, 8).toUpperCase()
  let customerName = 'Customer'

  try {
    const orderRow = await querySingleAdminOrderRow(orderId)
    if (orderRow) {
      orderNo = firstString(orderRow, ['order_no', 'order_number', 'public_id'], orderNo)
      customerName = firstString(orderRow, ['customer_name', 'recipient_name', 'delivery_name', 'full_name', 'name'], customerName)
    }
  } catch (error) {
    console.warn('[customerOrders] quotation response order lookup skipped:', error)
  }

  const accepted = input.response === 'accepted'

  await createAdminNotificationForAdmins({
    type: 'quotation',
    title: accepted ? 'Final Price Confirmed' : 'Final Price Changes Requested',
    message: accepted
      ? `${customerName} confirmed the final price for order #${orderNo}.`
      : `${customerName} requested changes to the final price for order #${orderNo}.`,
    link: `/admin/orders/${orderId}`,
    dedupeKey: `admin:quotation-response:${cleanText(input.quotationId) || orderId}:${input.response}`,
  })
}


async function createAdminQuotationRejectedNotificationFromQuotationId(quotationId: string) {
  const cleanQuotationId = cleanText(quotationId)
  if (!cleanQuotationId) return

  try {
    const { data, error } = await supabase
      .from('quotations')
      .select('id, order_id')
      .eq('id', cleanQuotationId)
      .maybeSingle()

    if (error) throw error

    const orderId = firstString(data as AnyRow | null, ['order_id'], '')
    if (!orderId) return

    await createAdminQuotationResponseNotification({
      orderId,
      quotationId: cleanQuotationId,
      response: 'rejected',
    })
  } catch (error) {
    console.warn('[customerOrders] quotation rejected admin notification skipped:', error)
  }
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
  const title = cleanText(input.title) || 'Shop2Bhutan update'
  const message = cleanText(input.message)
  const link = cleanText(input.link)
  const dedupeKey = cleanText(input.dedupeKey)

  const richPayload: AnyRow = {
    user_id: userId,
    type: input.type,
    title,
    message,
    link: link || null,
    is_read: false,
    created_at: now,
    updated_at: now,
    dedupe_key: dedupeKey || undefined,
  }

  const notificationTypePayload: AnyRow = {
    user_id: userId,
    notification_type: input.type,
    title,
    message,
    action_url: link || null,
    is_read: false,
    created_at: now,
    updated_at: now,
    dedupe_key: dedupeKey || undefined,
  }

  const candidates: AnyRow[] = [
    richPayload,
    {
      ...richPayload,
      action_url: link || null,
    },
    notificationTypePayload,
    {
      user_id: userId,
      type: input.type,
      title,
      message,
      link: link || null,
      is_read: false,
      created_at: now,
      dedupe_key: dedupeKey || undefined,
    },
    {
      user_id: userId,
      type: input.type,
      title,
      message,
      is_read: false,
      created_at: now,
      dedupe_key: dedupeKey || undefined,
    },
    {
      user_id: userId,
      notification_type: input.type,
      title,
      message,
      is_read: false,
      created_at: now,
      dedupe_key: dedupeKey || undefined,
    },
    {
      user_id: userId,
      title,
      message,
      is_read: false,
      created_at: now,
    },
  ]

  let lastError: unknown = null

  for (const candidate of candidates) {
    Object.keys(candidate).forEach((key) => candidate[key] === undefined && delete candidate[key])

    let result = dedupeKey && candidate.dedupe_key
      ? await supabase.from('notifications').upsert(candidate, { onConflict: 'dedupe_key' })
      : await supabase.from('notifications').insert(candidate)

    let message = errorMessage(result.error, '').toLowerCase()
    if (
      result.error &&
      dedupeKey &&
      candidate.dedupe_key &&
      (message.includes('unique') || message.includes('constraint') || message.includes('on conflict'))
    ) {
      result = await supabase.from('notifications').insert(candidate)
      message = errorMessage(result.error, '').toLowerCase()
    }

    if (!result.error) {
      emitNotificationUpdated()
      return
    }

    lastError = result.error
    if (message.includes('duplicate')) return

    if (message.includes('row-level security') || message.includes('permission denied')) {
      throw result.error
    }

    if (!shouldTryFallbackPayload(result.error) && !message.includes('unique') && !message.includes('constraint')) {
      break
    }
  }

  if (lastError && isMissingColumnOrRelationError(lastError)) {
    console.warn('[customerOrders] notifications table missing or not upgraded:', errorMessage(lastError, 'notification insert skipped'))
    return
  }

  if (lastError) throw lastError
}

type ParcelNotificationStatus =
  | 'pending'
  | 'accepted'
  | 'picked_up'
  | 'collected'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'rejected'
  | string

function parcelDisplayNo(parcelNo: unknown, requestId: unknown) {
  const cleanParcelNo = cleanText(parcelNo)
  if (cleanParcelNo) return cleanParcelNo

  const cleanRequestId = cleanText(requestId)
  return cleanRequestId ? cleanRequestId.slice(0, 8).toUpperCase() : 'parcel'
}

function parcelPackageLabel(packageDescription: unknown) {
  const description = cleanText(packageDescription)
  return description ? ` (${description})` : ''
}

function parcelStatusNotificationCopy(params: {
  status: ParcelNotificationStatus
  parcelNo: string
  adminNotes?: string | null
  packageDescription?: string | null
}) {
  const status = cleanText(params.status).toLowerCase()
  const parcelNo = params.parcelNo
  const note = cleanText(params.adminNotes)
  const packageLabel = parcelPackageLabel(params.packageDescription)
  const noteText = note ? ` Note: ${note}` : ''

  const copy: Record<
    string,
    { type: AppNotification['type']; title: string; message: string }
  > = {
    pending: {
      type: 'order_update',
      title: 'Parcel Request Submitted',
      message: `Your parcel request #${parcelNo}${packageLabel} has been submitted.`,
    },
    accepted: {
      type: 'order_update',
      title: 'Parcel Request Accepted',
      message: `Your parcel request #${parcelNo}${packageLabel} has been accepted.`,
    },
    picked_up: {
      type: 'order_update',
      title: 'Parcel Picked Up',
      message: `Your parcel #${parcelNo}${packageLabel} has been picked up.`,
    },
    collected: {
      type: 'order_update',
      title: 'Parcel Picked Up',
      message: `Your parcel #${parcelNo}${packageLabel} has been picked up.`,
    },
    in_transit: {
      type: 'order_update',
      title: 'Parcel In Transit',
      message: `Your parcel #${parcelNo}${packageLabel} is on the way.`,
    },
    delivered: {
      type: 'order_update',
      title: 'Parcel Delivered',
      message: `Your parcel #${parcelNo}${packageLabel} has been delivered.`,
    },
    rejected: {
      type: 'order_update',
      title: 'Parcel Request Rejected',
      message: `Your parcel request #${parcelNo}${packageLabel} was rejected.`,
    },
    cancelled: {
      type: 'order_update',
      title: 'Parcel Request Cancelled',
      message: `Your parcel request #${parcelNo}${packageLabel} was cancelled.`,
    },
  }

  const selected = copy[status] ?? {
    type: 'order_update' as AppNotification['type'],
    title: 'Parcel Updated',
    message: `Your parcel request #${parcelNo}${packageLabel} has been updated.`,
  }

  return {
    ...selected,
    message: `${selected.message}${noteText}`,
  }
}

export async function createAdminParcelSubmittedNotification(input: {
  requestId: string
  parcelNo?: string | null
  customerName?: string | null
  customerPhone?: string | null
  packageDescription?: string | null
}) {
  try {
    const requestId = cleanText(input.requestId)
    if (!requestId) return

    const parcelNo = parcelDisplayNo(input.parcelNo, requestId)
    const customerName = cleanText(input.customerName) || 'Customer'
    const customerPhone = cleanText(input.customerPhone)
    const packageLabel = parcelPackageLabel(input.packageDescription)

    await createAdminNotificationForAdmins({
      type: 'order_update',
      title: 'New Parcel Request',
      message: `${customerName}${customerPhone ? ` (${customerPhone})` : ''} submitted parcel request #${parcelNo}${packageLabel}.`,
      link: '/admin/parcel-requests',
      dedupeKey: `admin:new-parcel:${requestId}`,
    })
  } catch (error) {
    console.warn('[customerOrders] admin parcel notification skipped:', error)
  }
}

export async function createCustomerParcelStatusNotification(input: {
  userId: string
  parcelRequestId: string
  parcelNo?: string | null
  status: ParcelNotificationStatus
  adminNotes?: string | null
  packageDescription?: string | null
}) {
  try {
    const userId = cleanText(input.userId)
    const parcelRequestId = cleanText(input.parcelRequestId)
    if (!userId || !parcelRequestId) return

    const status = cleanText(input.status).toLowerCase()
    const parcelNo = parcelDisplayNo(input.parcelNo, parcelRequestId)
    const copy = parcelStatusNotificationCopy({
      status,
      parcelNo,
      adminNotes: input.adminNotes,
      packageDescription: input.packageDescription,
    })

    const historyStatuses = new Set(['delivered', 'cancelled', 'rejected'])

    await createCustomerNotification({
      userId,
      type: copy.type,
      title: copy.title,
      message: copy.message,
      link: historyStatuses.has(status)
        ? '/my-parcels?view=history'
        : '/my-parcels?view=active',
      dedupeKey: `parcel-status:${parcelRequestId}:${status}`,
    })
  } catch (error) {
    console.warn('[customerOrders] customer parcel notification skipped:', error)
  }
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
      title: 'Final Price Ready',
      message: `Availability has been confirmed and the final price for order #${orderNo} is ready. Review it to continue to payment.`,
      link: `/quotation/${orderId}`,
      dedupeKey: `quotation-ready:${quotationId || orderId}`,
    })
  } catch (error) {
    console.warn('[customerOrders] quotation notification skipped:', error)
  }
}

function orderStatusNotificationCopy(status: OrderStatus, orderNo: string, sellerReference?: string, adminNote?: string, selfPickup = false) {
  const reference = cleanText(sellerReference)
  const note = cleanText(adminNote)

  const copy: Record<OrderStatus, { title: string; message: string; type: AppNotification['type'] }> = {
    pending_confirmation: {
      type: 'order_update',
      title: 'Request Submitted',
      message: `Your shopping request #${orderNo} has been received.`,
    },
    quotation_pending: {
      type: 'quotation',
      title: 'Checking Availability & Price',
      message: `We are checking product availability, selected options, current prices, and delivery charges for order #${orderNo}.`,
    },
    quoted: {
      type: 'quotation',
      title: 'Final Price Ready',
      message: `Availability is confirmed and the final price for order #${orderNo} is ready. Review it to continue to payment.`,
    },
    payment_pending: {
      type: 'payment',
      title: 'Payment Under Review',
      message: `Your payment proof for order #${orderNo} is under review.`,
    },
    payment_verified: {
      type: 'payment',
      title: 'Payment Verified',
      message: `Your payment for order #${orderNo} has been verified. We will place the seller order next.`,
    },
    order_placed: {
      type: 'order_update',
      title: 'Order Placed',
      message: reference
        ? `Your order #${orderNo} has been placed with the seller. Seller reference: ${reference}.`
        : `Your order #${orderNo} has been placed with the seller.`,
    },
    in_transit: {
      type: 'order_update',
      title: 'In Transit',
      message: `Your order #${orderNo} is on the way to Bhutan.`,
    },
    arrived_at_hub: {
      type: 'order_update',
      title: selfPickup ? 'Arrived at Pickup Hub' : 'Arrived at Hub',
      message: selfPickup
        ? `Your order #${orderNo} has arrived at the pickup hub.`
        : `Your order #${orderNo} has arrived at the delivery hub.`,
    },
    out_for_delivery: {
      type: 'order_update',
      title: selfPickup ? 'Ready for Pickup' : 'Out for Delivery',
      message: selfPickup
        ? `Your order #${orderNo} is ready for pickup.`
        : `Your order #${orderNo} is out for delivery.`,
    },
    delivered: {
      type: 'order_update',
      title: selfPickup ? 'Picked Up' : 'Delivered',
      message: selfPickup
        ? `Your order #${orderNo} has been picked up successfully.`
        : `Your order #${orderNo} has been delivered successfully.`,
    },
    cancelled: {
      type: 'order_update',
      title: 'Order Cancelled',
      message: `Your order #${orderNo} has been cancelled.`,
    },
  }

  const selected = copy[status] ?? {
    type: 'order_update' as AppNotification['type'],
    title: 'Order Updated',
    message: `Your order #${orderNo} has been updated.`,
  }

  return {
    ...selected,
    message: note ? `${selected.message} ${note}` : selected.message,
  }
}

async function createOrderStatusNotificationForOrder(input: {
  orderId: string
  status: OrderStatus
  sellerReference?: string
  adminNote?: string
  dedupeKey?: string
}) {
  try {
    const orderId = cleanText(input.orderId)
    if (!orderId) return

    const orderRow = await querySingleAdminOrderRow(orderId)
    if (!orderRow) return

    const userId = firstString(orderRow, ORDER_OWNER_COLUMNS, '')
    if (!userId) return

    const orderNo = firstString(orderRow, ['order_no', 'order_number', 'public_id'], orderId.slice(0, 8).toUpperCase())
    const copy = orderStatusNotificationCopy(input.status, orderNo, input.sellerReference, input.adminNote, orderFulfillmentMode(orderRow) === 'self_pickup')

    await createCustomerNotification({
      userId,
      type: copy.type,
      title: copy.title,
      message: copy.message,
      link: `/order/${orderId}`,
      dedupeKey: cleanText(input.dedupeKey) || `order-status:${orderId}:${input.status}`,
    })
  } catch (error) {
    console.warn('[customerOrders] order status notification skipped:', error)
  }
}

async function createPaymentReviewNotificationForOrder(input: {
  order: Order
  status: PaymentStatus
  paymentId: string
  adminNote?: string
}) {
  const order = input.order
  const userId = cleanText(order.userId)
  if (!userId) return

  const orderNo = cleanText(order.orderNumber) || order.id.slice(0, 8).toUpperCase()
  const adminNote = cleanText(input.adminNote)

  const isVerified = input.status === 'verified'
  const title = isVerified ? 'Payment Verified' : 'Payment Proof Rejected'
  const baseMessage = isVerified
    ? `Your payment for order #${orderNo} has been verified. We will place the seller order next.`
    : `Your payment proof for order #${orderNo} was rejected. Please upload a corrected screenshot.`

  await createCustomerNotification({
    userId,
    type: 'payment',
    title,
    message: adminNote ? `${baseMessage} ${adminNote}` : baseMessage,
    link: isVerified ? `/order/${order.id}` : `/payment/${order.id}`,
    dedupeKey: `payment-review:${input.paymentId}:${input.status}`,
  })
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
    paymentType: normalizePaymentType(firstValue(payment, ['payment_type', 'payment_kind', 'coverage_type'])),
    method: firstString(payment, ['payment_method_name', 'method_name', 'method', 'payment_method'], ''),
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


function normalizePaymentMethodType(value: unknown): PaymentMethod['type'] {
  const raw = cleanText(value).toLowerCase()

  if (raw === 'bank_transfer' || raw.includes('bank') || raw.includes('transfer')) return 'bank_transfer'
  if (
    raw === 'mobile_banking' ||
    raw === 'mobile_wallet' ||
    raw === 'wallet' ||
    raw.includes('mobile') ||
    raw.includes('wallet') ||
    raw.includes('mbob') ||
    raw.includes('mbo') ||
    raw.includes('bpay') ||
    raw.includes('mpay')
  ) {
    return 'mobile_banking'
  }

  return 'other'
}

function paymentMethodDbCandidates(typeOrName?: unknown, fallbackName?: unknown) {
  const raw = [typeOrName, fallbackName].map((item) => cleanText(item).toLowerCase()).join(' ')
  const values: string[] = []

  if (raw.includes('bank') || raw.includes('transfer') || raw.includes('bob') || raw.includes('bnb') || raw.includes('tbank')) {
    values.push('bank_transfer', 'bank', 'other')
  } else if (
    raw.includes('mobile') ||
    raw.includes('wallet') ||
    raw.includes('mbob') ||
    raw.includes('mbo') ||
    raw.includes('bpay') ||
    raw.includes('mpay')
  ) {
    values.push('mobile_banking', 'mobile_wallet', 'wallet', 'mbob', 'bpay', 'other')
  } else {
    values.push('other', 'mobile_banking', 'bank_transfer')
  }

  return Array.from(new Set(values.filter(Boolean)))
}

function makePaymentMethod(row: AnyRow): PaymentMethod {
  const name = firstString(row, ['name', 'method_name', 'label'], 'Payment Method')
  const type = normalizePaymentMethodType(firstValue(row, ['method_type', 'type', 'payment_method_type', 'payment_method', 'kind']) ?? name)

  return {
    id: firstString(row, ['id'], normalizeKey(name)),
    name,
    type,
    accountNumber: firstString(row, ['account_number', 'accountNumber', 'account_no', 'account_code', 'code', 'merchant_code'], ''),
    accountName: firstString(row, ['account_name', 'accountName', 'holder_name'], 'Shop2Bhutan'),
    bankName: firstString(row, ['bank_name', 'bankName', 'bank'], ''),
    branch: firstString(row, ['branch'], ''),
    qrImage: firstString(row, ['qr_image', 'qrImage', 'qr_url', 'qr_code_url'], ''),
    instructions: firstString(row, ['instructions', 'note', 'notes'], ''),
    isActive: Boolean(firstValue(row, ['is_active', 'isActive', 'active']) ?? true),
    sortOrder: firstNumber(row, ['sort_order', 'sortOrder'], 0),
  }
}

function sortPaymentMethods(methods: PaymentMethod[]) {
  return [...methods].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
}

export async function fetchPaymentMethods(options: { includeInactive?: boolean } = {}): Promise<PaymentMethod[]> {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    if (isMissingColumnOrRelationError(error)) {
      const fallback = sortPaymentMethods(DEFAULT_PAYMENT_METHODS)
      return options.includeInactive ? fallback : fallback.filter((method) => method.isActive)
    }
    throw error
  }

  const methods = sortPaymentMethods(((data ?? []) as AnyRow[]).map((row: AnyRow) => makePaymentMethod(row)))
  const filtered = options.includeInactive ? methods : methods.filter((method) => method.isActive)

  return filtered.length ? filtered : []
}

function paymentMethodPayloadCandidates(method: PaymentMethod, methodType: string, sortOrder: number, now: string): AnyRow[] {
  const base = {
    name: cleanText(method.name) || 'Payment Method',
    method_type: methodType,
    account_number: cleanText(method.accountNumber) || null,
    account_name: cleanText(method.accountName) || 'Shop2Bhutan',
    bank_name: cleanText(method.bankName) || null,
    branch: cleanText(method.branch) || null,
    qr_image: cleanText(method.qrImage) || null,
    instructions: cleanText(method.instructions) || null,
    is_active: Boolean(method.isActive),
    sort_order: sortOrder,
    updated_at: now,
  }

  const withoutUpdated = { ...base }
  delete (withoutUpdated as AnyRow).updated_at

  const typePayload = { ...base, type: methodType }
  delete (typePayload as AnyRow).method_type

  const typeWithoutUpdated = { ...typePayload }
  delete (typeWithoutUpdated as AnyRow).updated_at

  return [base, withoutUpdated, typePayload, typeWithoutUpdated]
}

function paymentMethodRpcType(method: PaymentMethod) {
  return paymentMethodDbCandidates(method.type, method.name)[0] || 'other'
}

async function upsertPaymentMethodViaRpc(method: PaymentMethod, index: number) {
  const id = cleanText(method.id)
  const sortOrder = Math.max(1, Math.floor(Number(method.sortOrder) || index + 1))
  const result = await supabase.rpc('upsert_payment_method_admin', {
    p_method_id: isUuidLike(id) ? id : null,
    p_name: cleanText(method.name) || 'Payment Method',
    p_method_type: paymentMethodRpcType(method),
    p_account_number: cleanText(method.accountNumber),
    p_account_name: cleanText(method.accountName) || 'Shop2Bhutan',
    p_bank_name: cleanText(method.bankName),
    p_branch: cleanText(method.branch),
    p_qr_image: cleanText(method.qrImage),
    p_instructions: cleanText(method.instructions),
    p_is_active: Boolean(method.isActive),
    p_sort_order: sortOrder,
  })

  if (!result.error) return true

  if (isMissingColumnOrRelationError(result.error)) {
    const message = errorMessage(result.error, '').toLowerCase()
    if (message.includes('upsert_payment_method_admin') || message.includes('function')) return false
  }

  throw result.error
}

async function saveSinglePaymentMethod(method: PaymentMethod, index: number) {
  const savedViaRpc = await upsertPaymentMethodViaRpc(method, index)
  if (savedViaRpc) return

  const now = new Date().toISOString()
  const sortOrder = Math.max(1, Math.floor(Number(method.sortOrder) || index + 1))
  const methodTypeCandidates = paymentMethodDbCandidates(method.type, method.name)
  const isExistingUuid = isUuidLike(cleanText(method.id))
  let lastError: unknown = null

  for (const methodType of methodTypeCandidates) {
    for (const payload of paymentMethodPayloadCandidates(method, methodType, sortOrder, now)) {
      const result = isExistingUuid
        ? await supabase.from('payment_methods').update(payload, { count: 'exact' }).eq('id', method.id)
        : await supabase.from('payment_methods').insert(payload, { count: 'exact' })

      if (!result.error && (result.count === null || result.count > 0)) return

      if (!result.error && result.count === 0) {
        lastError = new Error('No payment method row was saved. Please check admin RLS policies for payment_methods.')
        continue
      }

      lastError = result.error
      if (isMissingColumnOrRelationError(result.error)) {
        const message = errorMessage(result.error, '').toLowerCase()
        if (message.includes('relation') || message.includes('payment_methods')) {
          throw new Error('Payment methods table is missing. Please run the Step 04D.1D SQL patch first.')
        }
      }

      if (!shouldTryFallbackPayload(result.error)) throw result.error
    }
  }

  throw new Error(errorMessage(lastError, 'Unable to save payment method.'))
}

export async function savePaymentMethods(methods: PaymentMethod[]): Promise<PaymentMethod[]> {
  for (let index = 0; index < methods.length; index += 1) {
    const method = methods[index]

    if (!cleanText(method.name)) throw new Error('Payment method name is required.')
    if (!cleanText(method.accountName)) throw new Error(`Account name is required for ${method.name}.`)
    if (!cleanText(method.instructions)) throw new Error(`Instructions are required for ${method.name}.`)

    await saveSinglePaymentMethod(method, index)
  }

  return fetchPaymentMethods({ includeInactive: true })
}

async function deletePaymentMethodViaRpc(id: string) {
  const result = await supabase.rpc('delete_payment_method_admin', {
    p_method_id: id,
    p_hard_delete: true,
  })

  if (!result.error) return true

  if (isMissingColumnOrRelationError(result.error)) {
    const message = errorMessage(result.error, '').toLowerCase()
    if (message.includes('delete_payment_method_admin') || message.includes('function')) return false
  }

  throw result.error
}

export async function deletePaymentMethod(method: PaymentMethod): Promise<PaymentMethod[]> {
  const id = cleanText(method.id)

  if (!isUuidLike(id)) return fetchPaymentMethods({ includeInactive: true })

  const deletedViaRpc = await deletePaymentMethodViaRpc(id)
  if (deletedViaRpc) return fetchPaymentMethods({ includeInactive: true })

  const hardDelete = await supabase.from('payment_methods').delete({ count: 'exact' }).eq('id', id)

  if (!hardDelete.error && (hardDelete.count === null || hardDelete.count > 0)) {
    return fetchPaymentMethods({ includeInactive: true })
  }

  const softDelete = await supabase
    .from('payment_methods')
    .update({ is_active: false, updated_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', id)

  if (!softDelete.error && (softDelete.count === null || softDelete.count > 0)) {
    return fetchPaymentMethods({ includeInactive: true })
  }

  const lastError = softDelete.error ?? hardDelete.error
  if (lastError) {
    if (isMissingColumnOrRelationError(lastError)) {
      throw new Error('Payment methods table is missing. Please run the Step 04D.1D SQL patch first.')
    }
    throw lastError
  }

  throw new Error('Payment method was not changed. Please confirm your logged-in admin user exists in public.user_roles as admin or super_admin.')
}

export async function verifyAdminPaymentById(paymentId: string, adminId?: string) {
  await updatePaymentReviewStatus({
    paymentId,
    status: 'verified',
    adminId,
    adminNote: 'Verified from admin payments panel.',
  })
}

export async function rejectAdminPaymentById(paymentId: string, adminId?: string, adminNote?: string) {
  await updatePaymentReviewStatus({
    paymentId,
    status: 'rejected',
    adminId,
    adminNote: adminNote || 'Rejected from admin payments panel.',
  })
}

function paymentRowOrderId(row: AnyRow) {
  return firstString(row, ['order_id'], '')
}

function paymentProofPath(row: AnyRow) {
  return firstString(row, ['proof_file_path', 'screenshot_url', 'payment_proof_url', 'proof_url'], '')
}

async function makeAdminPaymentRecord(row: AnyRow, orders: AnyRow[], profiles: AnyRow[], quotations: AnyRow[], allPaymentRows: AnyRow[]): Promise<AdminPaymentRecord> {
  const payment = await makePayment(row)
  const orderRow = orders.find((order) => String(order.id ?? '') === paymentRowOrderId(row))
  const profile = orderRow ? findProfileForOrder(orderRow, profiles) : profiles.find((item) => String(item.id ?? '') === firstString(row, ['user_id'], ''))
  const fallbackUser = makeFallbackUser(orderRow ?? row, firstString(row, ['customer_email', 'email'], ''), profiles)
  const quotationRow = quotations.find((quotation) => String(quotation.order_id ?? '') === paymentRowOrderId(row))
  const totalPayable = firstNumber(quotationRow, ['total_amount', 'total'], 0)
  const createdAt = firstString(row, ['submitted_at', 'created_at'], '')
  const createdTime = new Date(createdAt || 0).getTime() || 0
  const verifiedBefore = allPaymentRows
    .filter((paymentRow) => paymentRowOrderId(paymentRow) === paymentRowOrderId(row))
    .filter((paymentRow) => String(paymentRow.id ?? '') !== String(row.id ?? ''))
    .filter((paymentRow) => normalizePaymentStatus(firstValue(paymentRow, ['status'])) === 'verified')
    .filter((paymentRow) => {
      const time = new Date(firstString(paymentRow, ['submitted_at', 'created_at'], '') || 0).getTime() || 0
      return !createdTime || !time || time < createdTime
    })
    .reduce((sum, paymentRow) => sum + firstNumber(paymentRow, ['amount', 'total_amount', 'advance_paid'], 0), 0)
  const amountValue = payment?.amount ?? firstNumber(row, ['amount', 'total_amount', 'advance_paid'], 0)
  const paymentType = inferPaymentTypeFromAmounts({
    explicitType: firstValue(row, ['payment_type', 'payment_kind', 'coverage_type']),
    amount: amountValue,
    totalPayable,
    verifiedBefore,
  })

  return {
    id: payment?.id || firstString(row, ['id'], ''),
    orderId: payment?.orderId || paymentRowOrderId(row),
    orderNumber: firstString(orderRow, ['order_no', 'order_number', 'public_id'], paymentRowOrderId(row).slice(0, 8).toUpperCase()),
    customerName:
      firstString(orderRow, ['customer_name', 'recipient_name', 'delivery_name', 'full_name', 'name'], '') ||
      firstString(profile, ['full_name', 'name'], '') ||
      fallbackUser.name,
    customerEmail: firstString(orderRow, ['customer_email', 'email'], firstString(profile, ['email'], fallbackUser.email)),
    customerPhone:
      firstString(orderRow, ['customer_phone', 'recipient_phone', 'delivery_phone', 'phone', 'whatsapp'], '') ||
      firstString(profile, ['phone'], fallbackUser.phone),
    amount: amountValue,
    paymentType,
    sourceBank: normalizePaymentSourceBank(
      firstValue(row, ['source_bank', 'sourceBank']),
    ),
    normalizedTransactionId:
      firstString(
        row,
        ['normalized_transaction_id', 'normalizedTransactionId'],
        '',
      ) ||
      normalizePaymentReference(
        payment?.transactionId ||
          firstString(row, ['transaction_id', 'reference_id', 'txn_id'], ''),
      ),
    duplicateReferenceCount: allPaymentRows.filter((paymentRow) => {
      if (String(paymentRow.id ?? '') === String(row.id ?? '')) return false
      const bank = normalizePaymentSourceBank(
        firstValue(paymentRow, ['source_bank', 'sourceBank']),
      )
      const reference =
        firstString(
          paymentRow,
          ['normalized_transaction_id', 'normalizedTransactionId'],
          '',
        ) ||
        normalizePaymentReference(
          firstValue(paymentRow, ['transaction_id', 'reference_id', 'txn_id']),
        )
      const currentBank = normalizePaymentSourceBank(
        firstValue(row, ['source_bank', 'sourceBank']),
      )
      const currentReference =
        firstString(
          row,
          ['normalized_transaction_id', 'normalizedTransactionId'],
          '',
        ) ||
        normalizePaymentReference(
          firstValue(row, ['transaction_id', 'reference_id', 'txn_id']),
        )

      return Boolean(
        bank &&
          currentBank &&
          reference &&
          currentReference &&
          bank === currentBank &&
          reference === currentReference,
      )
    }).length,
    method: payment?.method || firstString(row, ['payment_method_name', 'method_name', 'payment_method', 'method'], ''),
    transactionId: payment?.transactionId || firstString(row, ['transaction_id', 'reference_id', 'txn_id'], ''),
    screenshotUrl: payment?.screenshotUrl,
    status: payment?.status ?? normalizePaymentStatus(firstValue(row, ['status'])),
    verifiedBy: payment?.verifiedBy,
    verifiedAt: payment?.verifiedAt,
    notes: payment?.notes ?? firstString(row, ['admin_notes', 'notes'], ''),
    createdAt: payment?.createdAt || firstString(row, ['submitted_at', 'created_at'], ''),
    orderStatus: normalizeOrderStatus(firstValue(orderRow, ['status', 'order_status'])),
    proofPath: paymentProofPath(row),
  }
}

export async function fetchAdminPayments(): Promise<AdminPaymentRecord[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingColumnOrRelationError(error)) return []
    throw error
  }

  const paymentRows = (data ?? []) as AnyRow[]
  const orderIds = Array.from(new Set(paymentRows.map((row) => paymentRowOrderId(row)).filter(Boolean)))
  const userIds = Array.from(new Set(paymentRows.map((row) => firstString(row, ['user_id'], '')).filter(Boolean)))
  const orderRows = await safeSelectIn('orders', 'id', orderIds)
  const quotationRows = await safeSelectIn('quotations', 'order_id', orderIds)
  const ownerIds = Array.from(
    new Set([
      ...userIds,
      ...orderRows.flatMap((row) => ORDER_OWNER_COLUMNS.map((column) => firstString(row, [column], ''))),
    ].filter(Boolean))
  )
  const profiles = await safeSelectIn('profiles', 'id', ownerIds)
  const mapped = await Promise.all(paymentRows.map((row) => makeAdminPaymentRecord(row, orderRows, profiles, quotationRows, paymentRows)))

  return mapped.sort((a, b) => {
    const bTime = new Date(b.createdAt || 0).getTime() || 0
    const aTime = new Date(a.createdAt || 0).getTime() || 0
    return bTime - aTime
  })
}

export async function fetchAdminCustomers(): Promise<AdminCustomerRecord[]> {
  const { data: profileData, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingColumnOrRelationError(error)) return []
    throw error
  }

  const profiles = (profileData ?? []) as AnyRow[]

  const dzongkhagIds = Array.from(
    new Set(
      profiles
        .map((profile) => firstString(profile, ['default_dzongkhag_id', 'dzongkhag_id'], ''))
        .filter(Boolean)
    )
  )

  let dzongkhagNameById = new Map<string, string>()

  if (dzongkhagIds.length > 0) {
    const { data: dzongkhagData, error: dzongkhagError } = await supabase
      .from('dzongkhags')
      .select('id, name')
      .in('id', dzongkhagIds)

    if (dzongkhagError && !isMissingColumnOrRelationError(dzongkhagError)) {
      throw dzongkhagError
    }

    dzongkhagNameById = new Map(
      ((dzongkhagData ?? []) as AnyRow[])
        .map((row) => [firstString(row, ['id'], ''), firstString(row, ['name'], '')] as const)
        .filter(([id, name]) => Boolean(id && name))
    )
  }

  let roleByUserId = new Map<string, string>()

  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('*')

  if (!roleError) {
    roleByUserId = new Map(
      ((roleData ?? []) as AnyRow[])
        .map((row) => [firstString(row, ['user_id', 'profile_id', 'id'], ''), firstString(row, ['role'], '').toLowerCase()] as const)
        .filter(([id, role]) => Boolean(id && role))
    )
  } else {
    console.warn('[customerOrders] user role lookup skipped:', errorMessage(roleError, 'Unable to load user roles.'))
  }

  const { data: orderData, error: orderError } = await supabase.from('orders').select('*')
  if (orderError && !isMissingColumnOrRelationError(orderError)) throw orderError

  const { data: paymentData, error: paymentError } = await supabase.from('payments').select('*')
  if (paymentError && !isMissingColumnOrRelationError(paymentError)) throw paymentError

  const orders = (orderData ?? []) as AnyRow[]
  const payments = (paymentData ?? []) as AnyRow[]
  const verifiedPayments = payments.filter((payment) => normalizePaymentStatus(firstValue(payment, ['status'])) === 'verified')
  const customers: AdminCustomerRecord[] = []

  for (const profile of profiles) {
    const id = firstString(profile, ['id'], '')
    if (!id) continue

    const role = roleByUserId.get(id) || firstString(profile, ['role'], '').toLowerCase()
    if (role === 'admin' || role === 'super_admin') continue

    const customerOrders = orders.filter((order) => ORDER_OWNER_COLUMNS.some((column) => firstString(order, [column], '') === id))
    const customerOrderIds = new Set(customerOrders.map((order) => firstString(order, ['id'], '')).filter(Boolean))

    const totalSpent = verifiedPayments
      .filter((payment) => customerOrderIds.has(firstString(payment, ['order_id'], '')) || firstString(payment, ['user_id'], '') === id)
      .reduce((sum, payment) => sum + firstNumber(payment, ['amount', 'total_amount', 'advance_paid'], 0), 0)

    const orderDates = customerOrders
      .map((order) => firstString(order, ['created_at', 'updated_at'], ''))
      .filter(Boolean)
      .sort()

    const lastOrderAt = orderDates.length ? orderDates[orderDates.length - 1] : undefined
    const rawEmail = firstString(profile, ['email'], '')
    const publicEmail = getPublicCustomerEmail(profile)
    const dzongkhagId = firstString(profile, ['default_dzongkhag_id', 'dzongkhag_id'], '')
    const dzongkhagFromLookup = dzongkhagId ? dzongkhagNameById.get(dzongkhagId) || '' : ''

    const profileIsActive = Boolean(firstValue(profile, ['is_active', 'active']) ?? true)
    const rawAccountStatus = firstString(
      profile,
      ['account_status', 'accountStatus'],
      profileIsActive ? 'active' : 'deactivated'
    ).toLowerCase()
    const accountStatus: AdminCustomerRecord['accountStatus'] =
      rawAccountStatus === 'deactivated' || !profileIsActive
        ? 'deactivated'
        : rawAccountStatus === 'active'
          ? 'active'
          : 'unknown'

    customers.push({
      id,
      name:
        firstString(profile, ['full_name', 'name', 'display_name'], '') ||
        publicEmail ||
        firstString(profile, ['phone', 'mobile', 'whatsapp'], '') ||
        'Customer',
      email: publicEmail,
      phone: firstString(profile, ['phone', 'mobile', 'whatsapp'], ''),
      dzongkhag: firstString(
        profile,
        ['default_dzongkhag_name', 'dzongkhag_name', 'dzongkhag', 'district'],
        dzongkhagFromLookup
      ),
      orders: customerOrders.length,
      totalSpent,
      joined: firstString(profile, ['created_at'], ''),
      lastOrderAt,
      isActive: accountStatus !== 'deactivated',
      accountStatus,
      deactivatedAt: firstString(profile, ['deactivated_at', 'deactivatedAt'], ''),
      deactivationReason: firstString(profile, ['deactivation_reason', 'deactivationReason'], ''),
      mustChangePassword: Boolean(firstValue(profile, ['must_change_password', 'mustChangePassword']) ?? false),
      passwordResetByAdminAt: firstString(profile, ['password_reset_by_admin_at', 'passwordResetByAdminAt'], ''),
      accountType: getCustomerAccountType({ ...profile, email: rawEmail }),
      verificationBadge: normalizeVerificationBadgeValue(firstValue(profile, ['verification_badge', 'verificationBadge'])),
      verifiedAt: firstString(profile, ['verified_at', 'verifiedAt'], ''),
      verifiedBy: firstString(profile, ['verified_by', 'verifiedBy'], ''),
      verificationNote: firstString(profile, ['verification_note', 'verificationNote'], ''),
    })
  }

  return customers
}

export async function reactivateCustomerAccount(customerId: string) {
  const id = cleanText(customerId)
  if (!id) throw new Error('Customer ID is required.')

  const { error } = await supabase.rpc('reactivate_customer_account', {
    p_user_id: id,
  })

  if (!error) return

  const message = errorMessage(error, '')

  if (isMissingColumnOrRelationError(error) || message.toLowerCase().includes('reactivate_customer_account')) {
    throw new Error('Admin reactivation is not ready. Please run the Step 10B reactivation SQL in Supabase first.')
  }

  throw error
}

export async function deactivateCustomerAccount(customerId: string, reason?: string) {
  const id = cleanText(customerId)
  if (!id) throw new Error('Customer ID is required.')

  const { error } = await supabase.rpc('deactivate_customer_account', {
    p_user_id: id,
    p_reason: cleanText(reason) || 'Deactivated by admin',
  })

  if (!error) return

  const message = errorMessage(error, '')

  if (isMissingColumnOrRelationError(error) || message.toLowerCase().includes('deactivate_customer_account')) {
    throw new Error('Admin deactivation is not ready. Please run the deactivate_customer_account SQL in Supabase first.')
  }

  throw error
}

export async function updateCustomerVerificationBadge(
  customerId: string,
  badge: VerificationBadge,
  note?: string,
) {
  const id = cleanText(customerId)
  if (!id) throw new Error('Customer ID is required.')

  const nextBadge = normalizeVerificationBadgeValue(badge)

  const { error } = await supabase.rpc('set_customer_verification_badge', {
    p_user_id: id,
    p_badge: nextBadge,
    p_note: cleanText(note) || null,
  })

  if (!error) return

  const message = errorMessage(error, '')

  if (isMissingColumnOrRelationError(error) || message.toLowerCase().includes('set_customer_verification_badge')) {
    throw new Error('Customer verification badges are not ready. Please run the verified_badge_system SQL in Supabase first.')
  }

  throw error
}


export async function resetCustomerTemporaryPassword(
  customerId: string,
): Promise<AdminTemporaryPasswordResetResult> {
  const id = cleanText(customerId)
  if (!id) throw new Error('Customer ID is required.')

  const { data, error } = await supabase.functions.invoke(
    'admin-reset-customer-password',
    {
      body: { userId: id },
    },
  )

  if (error) {
    const message = errorMessage(error, '')
    if (
      message.toLowerCase().includes('not found') ||
      message.toLowerCase().includes('failed to fetch') ||
      message.toLowerCase().includes('functions')
    ) {
      throw new Error(
        'Admin password reset function is not deployed yet. Please deploy the admin-reset-customer-password Edge Function.',
      )
    }
    throw new Error(message || 'Unable to reset customer password.')
  }

  const row = (data ?? {}) as AnyRow
  const temporaryPassword = firstString(
    row,
    ['temporaryPassword', 'temporary_password'],
    '',
  )

  if (!temporaryPassword) {
    throw new Error('Password was reset but no temporary password was returned.')
  }

  return {
    userId: firstString(row, ['userId', 'user_id'], id),
    temporaryPassword,
    mustChangePassword: Boolean(
      firstValue(row, ['mustChangePassword', 'must_change_password']) ?? true,
    ),
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
    fulfillment_mode: firstString(row, ['fulfillment_mode', 'fulfillmentMode']) || firstString(bag, ['fulfillment_mode', 'fulfillmentMode']),
    pickup_hub_id: firstString(row, ['pickup_hub_id', 'pickupHubId']) || firstString(bag, ['pickup_hub_id', 'pickupHubId']),
    pickup_hub_name: firstString(row, ['pickup_hub_name', 'pickupHubName']) || firstString(bag, ['pickup_hub_name', 'pickupHubName']),
    pickup_instructions: firstString(row, ['pickup_instructions', 'pickupInstructions']) || firstString(bag, ['pickup_instructions', 'pickupInstructions']),
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
  const trackingEvents = sortTrackingEvents(
    related.trackingEvents
      .filter((event) => trackingEventBelongsToOrder(event, row))
      .map((event) => normalizeTrackingEvent(event))
  )
  const customerId = firstString(displayRow, ORDER_OWNER_COLUMNS, authUserId)

  return withOrderEstimatedDelivery({
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
    deliveryHubId: firstString(row, ['delivery_hub_id', 'hub_id'], orderPickupHubId(displayRow) || 'hub1'),
    deliveryHub: makeDeliveryHub(displayRow),
    fulfillmentMode: orderFulfillmentMode(displayRow),
    pickupHubId: orderPickupHubId(displayRow),
    pickupHubName: orderPickupHubName(displayRow),
    pickupInstructions: orderPickupInstructions(displayRow),
    shippingAddress: makeShippingAddress(displayRow, customerId, related.profiles),
    quotation,
    payment,
    payments,
    paymentSummary: calculatePaymentSummary({
      quotationTotal: quotation?.totalAmount ?? 0,
      payments,
    }),
    trackingEvents,
    notes: firstString(displayRow, ['notes', 'customer_notes', 'admin_notes'], ''),
    createdAt: firstString(row, ['created_at'], ''),
    updatedAt: firstString(row, ['updated_at'], firstString(row, ['created_at'], '')),
  }, row)
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
  const trackingEvents = await safeSelectIn('tracking_events', 'order_id', dbIds)

  const quotationIds = quotations.map((quote) => String(quote.id ?? '')).filter(Boolean)
  const quotationItems = await safeSelectIn('quotation_items', 'quotation_id', quotationIds)

  return {
    items,
    quotations,
    quotationItems,
    payments,
    profiles,
    requestBags,
    trackingEvents,
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


function makeOrderItemsFast(row: AnyRow, relatedItems: AnyRow[]): OrderItem[] {
  const mappedItems = relatedItems.map((item, index) => {
    const attachmentPath = firstString(item, ['attachment_path', 'screenshot_path', 'proof_file_path'], '')
    const productImage = makeFastDisplayImage(
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
      screenshotUrl: '',
      attachmentPath,
    }
  })

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

  return [
    {
      id: `item-${row.id}-fallback`,
      sourceUrl: firstString(row, ['product_url', 'source_url'], ''),
      sourcePlatform: 'internal',
      productName: firstString(row, ['product_name', 'item_name', 'title'], 'Order item'),
      productImage: makeFastDisplayImage(firstString(row, ['product_image', 'image_url', 'screenshot_url'], '')),
      quantity: firstNumber(row, ['quantity', 'qty'], 1),
      unitPrice: firstNumber(row, ['unit_price', 'product_price', 'amount'], 0),
      attributes: {},
      notes: firstString(row, ['notes', 'customer_notes'], ''),
      screenshotUrl: '',
      attachmentPath: '',
    },
  ]
}

function makeQuotationSummary(quotation: AnyRow | undefined, orderItems: OrderItem[]): Quotation | undefined {
  if (!quotation) return undefined

  const productTotal = firstNumber(
    quotation,
    ['product_subtotal', 'product_total', 'product_price', 'subtotal'],
    orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
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
    items: [],
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

function makePaymentFast(payment: AnyRow | undefined): Payment | undefined {
  if (!payment) return undefined

  const proofPath = firstString(payment, ['proof_file_path', 'screenshot_url', 'payment_proof_url', 'proof_url'], '')

  return {
    id: firstString(payment, ['id'], ''),
    orderId: firstString(payment, ['order_id'], ''),
    amount: firstNumber(payment, ['amount', 'total_amount', 'advance_paid'], 0),
    paymentType: normalizePaymentType(firstValue(payment, ['payment_type', 'payment_kind', 'coverage_type'])),
    method: firstString(payment, ['payment_method_name', 'method_name', 'method', 'payment_method'], ''),
    transactionId: firstString(payment, ['transaction_id', 'reference_id', 'txn_id'], ''),
    screenshotUrl: isExternalOrDataUrl(proofPath) ? proofPath : '',
    status: normalizePaymentStatus(firstValue(payment, ['status'])),
    verifiedBy: firstString(payment, ['verified_by'], ''),
    verifiedAt: firstString(payment, ['verified_at'], ''),
    notes: firstString(payment, ['notes', 'admin_notes'], ''),
    createdAt: firstString(payment, ['created_at'], ''),
  }
}

function makePaymentsFast(payments: AnyRow[]): Payment[] {
  return sortPayments(payments.map((payment) => makePaymentFast(payment)).filter(Boolean) as Payment[])
}

function mapOrderRowSummary(row: AnyRow, related: RelatedRows, authUserId: string, authEmail = ''): Order {
  const displayRow = mergeSubmittedRequestBagAddress(row, related)
  const items = makeOrderItemsFast(row, related.items.filter((item) => itemBelongsToOrder(item, row)))
  const quotationRow = findQuotationForOrder(row, related.quotations)
  const quotation = makeQuotationSummary(quotationRow, items)
  const relatedPaymentRows = related.payments.filter((payment) => paymentBelongsToOrder(payment, row))
  const payments = makePaymentsFast(relatedPaymentRows)
  const payment = getPrimaryPayment(payments)
  const customerId = firstString(displayRow, ORDER_OWNER_COLUMNS, authUserId)

  return withOrderEstimatedDelivery({
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
    deliveryHubId: firstString(row, ['delivery_hub_id', 'hub_id'], orderPickupHubId(displayRow) || 'hub1'),
    deliveryHub: makeDeliveryHub(displayRow),
    fulfillmentMode: orderFulfillmentMode(displayRow),
    pickupHubId: orderPickupHubId(displayRow),
    pickupHubName: orderPickupHubName(displayRow),
    pickupInstructions: orderPickupInstructions(displayRow),
    shippingAddress: makeShippingAddress(displayRow, customerId, related.profiles),
    quotation,
    payment,
    payments,
    paymentSummary: calculatePaymentSummary({
      quotationTotal: quotation?.totalAmount ?? 0,
      payments,
    }),
    trackingEvents: [],
    notes: firstString(displayRow, ['notes', 'customer_notes', 'admin_notes'], ''),
    createdAt: firstString(row, ['created_at'], ''),
    updatedAt: firstString(row, ['updated_at'], firstString(row, ['created_at'], '')),
  }, row)
}

export async function fetchCustomerOrdersSummary(userId: string, email = '') {
  if (!userId) return [] as Order[]

  const rows = await queryCustomerOrderRows(userId)
  const dbIds = rows.map((row) => String(row.id ?? '')).filter(Boolean)
  const ownerIds = rows
    .flatMap((row) => ORDER_OWNER_COLUMNS.map((column) => String(row[column] ?? '')))
    .filter(Boolean)

  const [items, quotations, payments, profiles, requestBags] = await Promise.all([
    safeSelectIn('order_items', 'order_id', dbIds),
    safeSelectIn('quotations', 'order_id', dbIds),
    safeSelectIn('payments', 'order_id', dbIds),
    safeSelectIn('profiles', 'id', Array.from(new Set(ownerIds))),
    safeSelectIn('customer_request_bags', 'submitted_order_id', dbIds),
  ])

  const related: RelatedRows = {
    items,
    quotations,
    quotationItems: [],
    payments,
    profiles,
    requestBags,
    trackingEvents: [],
  }

  return rows.map((row) => mapOrderRowSummary(row, related, userId, email))
}


export async function fetchCustomerOrderByIdFast(orderIdOrNumber: string, userId: string, email = '') {
  if (!orderIdOrNumber || !userId) return null

  const row = await querySingleCustomerOrderRow(orderIdOrNumber, userId)
  if (!row) return null

  const dbIds = [String(row.id ?? '')].filter(Boolean)
  const ownerIds = ORDER_OWNER_COLUMNS.map((column) => String(row[column] ?? '')).filter(Boolean)

  const [items, quotations, payments, profiles, requestBags] = await Promise.all([
    safeSelectIn('order_items', 'order_id', dbIds),
    safeSelectIn('quotations', 'order_id', dbIds),
    safeSelectIn('payments', 'order_id', dbIds),
    safeSelectIn('profiles', 'id', Array.from(new Set(ownerIds))),
    safeSelectIn('customer_request_bags', 'submitted_order_id', dbIds),
  ])

  const related: RelatedRows = {
    items,
    quotations,
    quotationItems: [],
    payments,
    profiles,
    requestBags,
    trackingEvents: [],
  }

  return mapOrderRowSummary(row, related, userId, email)
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
  if (status === 'approved' || status === 'rejected') {
    await assertCustomerAppAvailable()
  }

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

    const withTimestamp = await supabase.from('quotations').update(payload).eq('id', quotationId)
    if (!withTimestamp.error) {
      if (status === 'rejected') await createAdminQuotationRejectedNotificationFromQuotationId(quotationId)
      return
    }

    lastError = withTimestamp.error
    if (!shouldTryFallbackPayload(withTimestamp.error)) throw withTimestamp.error

    const fallbackPayload: AnyRow = { status: dbStatus }
    if (dbStatus === 'accepted') fallbackPayload.accepted_at = now

    const withoutTimestamp = await supabase.from('quotations').update(fallbackPayload).eq('id', quotationId)
    if (!withoutTimestamp.error) {
      if (status === 'rejected') await createAdminQuotationRejectedNotificationFromQuotationId(quotationId)
      return
    }

    lastError = withoutTimestamp.error
    if (!shouldTryFallbackPayload(withoutTimestamp.error)) throw withoutTimestamp.error
  }

  throw new Error(errorMessage(lastError, 'Unable to update quotation status.'))
}

function orderStatusWriteCandidates(status: OrderStatus) {
  const legacyMap: Partial<Record<OrderStatus, string[]>> = {
    pending_confirmation: ['pending_confirmation', 'pending'],
    quotation_pending: ['quotation_pending', 'pending'],
    quoted: ['quoted'],
    payment_pending: ['payment_pending'],
    payment_verified: ['payment_verified'],
    order_placed: ['order_placed', 'ordered', 'confirmed'],
    in_transit: ['in_transit', 'reached_jaigaon'],
    arrived_at_hub: ['arrived_at_hub', 'reached_phuntsholing'],
    out_for_delivery: ['out_for_delivery', 'shipped'],
    delivered: ['delivered'],
    cancelled: ['cancelled', 'canceled'],
  }

  return Array.from(new Set([status, ...(legacyMap[status] ?? [])].filter(Boolean)))
}

export async function updateCustomerOrderStatus(orderId: string, status: OrderStatus) {
  const cleanOrderId = cleanText(orderId)
  if (!cleanOrderId) throw new Error('Order UUID is required.')

  const now = new Date().toISOString()
  let lastError: unknown = null
  let zeroRowUpdateSeen = false

  for (const dbStatus of orderStatusWriteCandidates(status)) {
    const payloads: AnyRow[] = [
      { status: dbStatus, updated_at: now },
      { status: dbStatus },
      { order_status: dbStatus, updated_at: now },
      { order_status: dbStatus },
    ]

    for (const payload of payloads) {
      const { data, error } = await supabase
        .from('orders')
        .update(payload, { count: 'exact' })
        .eq('id', cleanOrderId)
        .select('id')
        .maybeSingle()

      if (!error && data?.id) return

      if (!error && !data) {
        zeroRowUpdateSeen = true
        lastError = new Error('Order status update affected 0 rows. Check admin RLS update policy for public.orders.')
        continue
      }

      lastError = error
      if (!shouldTryFallbackPayload(error)) throw error
    }
  }

  if (zeroRowUpdateSeen) {
    throw new Error('Order status was not updated. The logged-in admin may not have permission to update public.orders, or the order UUID was not visible under RLS.')
  }

  throw new Error(errorMessage(lastError, 'Unable to update order status.'))
}

const FULFILLMENT_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_confirmation: 'Order Received',
  quotation_pending: 'Quotation Pending',
  quoted: 'Quotation Sent',
  payment_pending: 'Payment Pending',
  payment_verified: 'Payment Verified',
  order_placed: 'Order Placed',
  in_transit: 'In Transit',
  arrived_at_hub: 'Arrived at Hub',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const ADMIN_FULFILLMENT_STATUSES: OrderStatus[] = [
  'order_placed',
  'in_transit',
  'arrived_at_hub',
  'out_for_delivery',
  'delivered',
  'cancelled',
]

function fulfillmentMessage(status: OrderStatus, sellerReference?: string, adminNote?: string) {
  const reference = cleanText(sellerReference)
  const note = cleanText(adminNote)
  const baseMessages: Record<OrderStatus, string> = {
    pending_confirmation: 'Your order request has been received.',
    quotation_pending: 'Your quotation is being prepared.',
    quoted: 'Your quotation is ready for review.',
    payment_pending: 'Your payment proof is under review.',
    payment_verified: 'Your payment has been verified.',
    order_placed: reference
      ? `Your order has been placed with the seller. Seller reference: ${reference}.`
      : 'Your order has been placed with the seller.',
    in_transit: 'Your order is in transit to Bhutan.',
    arrived_at_hub: 'Your order has arrived at the delivery hub.',
    out_for_delivery: 'Your order is out for delivery.',
    delivered: 'Your order has been delivered successfully.',
    cancelled: 'This order has been cancelled.',
  }

  return note ? `${baseMessages[status]} ${note}` : baseMessages[status]
}

function trackingStatusCandidates(status: OrderStatus) {
  const legacyMap: Partial<Record<OrderStatus, string[]>> = {
    pending_confirmation: ['pending_confirmation', 'pending'],
    order_placed: ['order_placed', 'ordered', 'confirmed'],
    in_transit: ['in_transit', 'reached_jaigaon'],
    arrived_at_hub: ['arrived_at_hub', 'reached_phuntsholing'],
    out_for_delivery: ['out_for_delivery', 'shipped'],
    cancelled: ['cancelled', 'canceled'],
  }

  return legacyMap[status] ?? [status]
}

async function insertOrderTrackingEvent(input: {
  orderId: string
  status: OrderStatus
  title?: string
  message?: string
  location?: string
  createdBy?: string
  sellerReference?: string
  adminNote?: string
  visibleToCustomer?: boolean
}) {
  const orderId = cleanText(input.orderId)
  if (!orderId) return

  const now = new Date().toISOString()
  const title = cleanText(input.title) || FULFILLMENT_STATUS_LABELS[input.status] || 'Order update'
  const message = cleanText(input.message) || fulfillmentMessage(input.status, input.sellerReference, input.adminNote)
  const createdBy = cleanText(input.createdBy)
  const sellerReference = cleanText(input.sellerReference)
  const adminNote = cleanText(input.adminNote)

  for (const dbStatus of trackingStatusCandidates(input.status)) {
    const richPayload: AnyRow = {
      order_id: orderId,
      status: dbStatus,
      title,
      message,
      location: cleanText(input.location) || null,
      visible_to_customer: input.visibleToCustomer ?? true,
      created_by: createdBy || null,
      seller_reference: sellerReference || null,
      admin_note: adminNote || null,
      event_time: now,
      created_at: now,
    }

    const candidates: AnyRow[] = [
      richPayload,
      { ...richPayload, event_time: undefined },
      {
        order_id: orderId,
        status: dbStatus,
        title,
        message,
        location: cleanText(input.location) || null,
        visible_to_customer: input.visibleToCustomer ?? true,
        created_by: createdBy || null,
        created_at: now,
      },
      {
        order_id: orderId,
        status: dbStatus,
        title,
        message,
        location: cleanText(input.location) || null,
        visible_to_customer: input.visibleToCustomer ?? true,
      },
      {
        order_id: orderId,
        status: dbStatus,
        title,
        message,
      },
    ]

    for (const candidate of candidates) {
      Object.keys(candidate).forEach((key) => candidate[key] === undefined && delete candidate[key])
      const { error } = await supabase.from('tracking_events').insert(candidate)
      if (!error) return

      if (!shouldTryFallbackPayload(error)) {
        console.warn('[customerOrders] tracking event insert skipped:', error)
        return
      }
    }
  }
}

export async function updateAdminFulfillmentStatus(input: {
  orderId: string
  status: OrderStatus
  adminId?: string
  sellerReference?: string
  adminNote?: string
  estimatedDeliveryFrom?: string
  estimatedDeliveryTo?: string
  estimatedDeliveryNote?: string
}) {
  const orderId = cleanText(input.orderId)
  if (!orderId) throw new Error('Order UUID is required.')
  if (!ADMIN_FULFILLMENT_STATUSES.includes(input.status)) {
    throw new Error('Unsupported fulfillment status.')
  }

  await updateCustomerOrderStatus(orderId, input.status)

  const etaSummary = estimatedDeliverySummaryText({
    estimatedDeliveryFrom: input.estimatedDeliveryFrom,
    estimatedDeliveryTo: input.estimatedDeliveryTo,
    estimatedDeliveryNote: input.estimatedDeliveryNote,
  })
  const timelineNote = [cleanText(input.adminNote), etaSummary].filter(Boolean).join(' ')

  if (input.estimatedDeliveryFrom || input.estimatedDeliveryTo || input.estimatedDeliveryNote) {
    try {
      await updateOrderEstimatedDelivery({
        orderId,
        estimatedDeliveryFrom: input.estimatedDeliveryFrom,
        estimatedDeliveryTo: input.estimatedDeliveryTo,
        estimatedDeliveryNote: input.estimatedDeliveryNote,
      })
    } catch (error) {
      console.warn('[customerOrders] estimated delivery update skipped:', error)
    }
  }

  try {
    await insertOrderTrackingEvent({
      orderId,
      status: input.status,
      title: FULFILLMENT_STATUS_LABELS[input.status],
      message: fulfillmentMessage(input.status, input.sellerReference, timelineNote),
      location: input.status === 'arrived_at_hub' || input.status === 'out_for_delivery' ? 'Bhutan Hub' : undefined,
      createdBy: input.adminId,
      sellerReference: input.sellerReference,
      adminNote: timelineNote,
      visibleToCustomer: true,
    })
  } catch (error) {
    console.warn('[customerOrders] fulfillment tracking event skipped:', error)
  }

  await createOrderStatusNotificationForOrder({
    orderId,
    status: input.status,
    sellerReference: input.sellerReference,
    adminNote: timelineNote,
  })
}


export async function acceptCustomerQuotation(input: { orderId: string; quotationId?: string }) {
  await assertCustomerAppAvailable()

  const orderId = cleanText(input.orderId)
  const quotationId = cleanText(input.quotationId)

  if (!orderId) throw new Error('Order UUID is required.')

  const { data, error } = await supabase.rpc('accept_customer_quotation', {
    p_order_id: orderId,
    p_quotation_id: quotationId || null,
  })

  if (error) {
    const message = errorMessage(error, '').toLowerCase()

    if (message.includes('function') && message.includes('accept_customer_quotation')) {
      throw new Error('Quotation accept RPC is not installed. Please run the Step 04D.1C SQL patch in Supabase first.')
    }

    throw error
  }

  const ok = typeof data === 'object' && data !== null ? Boolean((data as AnyRow).ok) : true
  if (!ok) {
    const message = typeof data === 'object' && data !== null ? cleanText((data as AnyRow).message) : ''
    throw new Error(message || 'Unable to accept quotation.')
  }

  await createAdminQuotationResponseNotification({
    orderId,
    quotationId,
    response: 'accepted',
  })

  return data
}


function numericAmount(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0
}

function quotationSubtotal(items: AdminQuotationItemInput[]) {
  return items.reduce((sum, item) => sum + numericAmount(item.unitPrice) * Math.max(1, Math.floor(Number(item.quantity) || 1)), 0)
}

function nonNegativeAmount(value: unknown, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0
}

function makeQuotationPayloadCandidates(input: CreateAdminQuotationInput, status: string): AnyRow[] {
  const productTotal = quotationSubtotal(input.items)
  const payableProductTotal = nonNegativeAmount(input.payableProductTotal, productTotal)
  const serviceCharge = numericAmount(input.serviceCharge)
  const deliveryFee = numericAmount(input.deliveryFee)
  const taxAmount = numericAmount(input.taxAmount)
  const additionalChargeAmount = numericAmount(input.additionalChargeAmount ?? 0)
  const additionalChargeLabel = cleanText(input.additionalChargeLabel) || null
  const totalAmount = payableProductTotal + serviceCharge + deliveryFee + taxAmount + additionalChargeAmount
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


function paymentAdminNotes(payload: {
  transactionId: string
  sourceBank: PaymentSourceBank
  paymentMethodName: string
  paymentMethodId?: string
  paymentMethodType?: PaymentMethod['type'] | string
  paymentType?: PaymentType | string
  path: string
  note?: string
}) {
  return [
    `Paid from bank: ${paymentSourceBankLabel(payload.sourceBank)}`,
    `Customer reference: ${payload.transactionId || 'Not provided'}`,
    `Normalized reference: ${normalizePaymentReference(payload.transactionId) || 'Not provided'}`,
    `Customer selected method: ${payload.paymentMethodName}`,
    payload.paymentMethodId ? `Customer selected method ID: ${payload.paymentMethodId}` : '',
    payload.paymentMethodType ? `Customer selected method type: ${payload.paymentMethodType}` : '',
    payload.paymentType ? `Customer selected payment type: ${normalizePaymentType(payload.paymentType)}` : '',
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
  paymentMethodId?: string
  paymentMethodType?: PaymentMethod['type'] | string
  paymentType?: PaymentType | string
  sourceBank: PaymentSourceBank
  transactionId: string
  path: string
  note?: string
}) {
  const requestedPaymentType = normalizePaymentType(payload.paymentType)
  const preferredPaymentType = requestedPaymentType === 'unknown' ? 'full' : requestedPaymentType
  const paymentTypeCandidates = Array.from(new Set([preferredPaymentType, 'full', 'advance', 'partial', 'balance', 'deposit', 'confirm_later']))
  const paymentMethodCandidates = paymentMethodDbCandidates(payload.paymentMethodType, payload.paymentMethodName)
  const sourceBank = normalizePaymentSourceBank(payload.sourceBank)
  const normalizedTransactionId = normalizePaymentReference(payload.transactionId)
  let lastError: unknown = null
  const adminNotes = paymentAdminNotes(payload)

  for (const paymentType of paymentTypeCandidates) {
    for (const paymentMethod of paymentMethodCandidates) {
      const basePayload: AnyRow = {
        order_id: payload.orderId,
        quotation_id: payload.quotationId || null,
        user_id: payload.userId,
        payment_type: paymentType,
        payment_method: paymentMethod,
        payment_method_id: cleanText(payload.paymentMethodId) || null,
        payment_method_name: cleanText(payload.paymentMethodName) || null,
        amount: payload.amount,
        currency: 'BTN',
        proof_file_path: payload.path,
        source_bank: sourceBank,
        transaction_id: payload.transactionId || null,
        normalized_transaction_id: normalizedTransactionId,
        admin_notes: adminNotes,
      }

      const withoutMethodSnapshot = { ...basePayload }
      delete withoutMethodSnapshot.payment_method_id
      delete withoutMethodSnapshot.payment_method_name

      const candidates = [
        { ...basePayload, status: 'pending' },
        basePayload,
        { ...withoutMethodSnapshot, status: 'pending' },
        withoutMethodSnapshot,
      ]

      for (const candidate of candidates) {
        const result = await supabase.from('payments').insert(candidate)
        if (!result.error) return

        lastError = result.error

        const message = errorMessage(result.error, '').toLowerCase()
        if (
          message.includes('source_bank') ||
          message.includes('transaction_id') ||
          message.includes('normalized_transaction_id')
        ) {
          throw new Error(
            'Smart payment verification is not installed in Supabase yet. Run the provided SQL patch, then try again.',
          )
        }

        if ((result.error as { code?: string })?.code === '23505') {
          throw new Error(
            `This ${paymentSourceBankLabel(sourceBank)} transaction reference has already been submitted. Please check the reference or contact Shop2Bhutan support.`,
          )
        }

        if (!shouldTryFallbackPayload(result.error)) throw result.error
      }
    }
  }

  throw new Error(errorMessage(lastError, 'Unable to create payment row. Check payment method/payment type enum values.'))
}


export type CustomerSavedAddress = {
  id: string
  user_id: string
  label: string
  recipient_name: string
  phone: string
  dzongkhag: string
  town: string | null
  gewog: string | null
  village: string | null
  landmark: string | null
  address_line: string | null
  is_default: boolean
  created_at?: string | null
}

export async function fetchCustomerSavedAddresses(userId: string): Promise<CustomerSavedAddress[]> {
  const ownerId = cleanText(userId)
  if (!ownerId) return []

  const { data, error } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('user_id', ownerId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingColumnOrRelationError(error)) return []
    throw error
  }

  return ((data ?? []) as AnyRow[]).map((row) => ({
    id: firstString(row, ['id'], ''),
    user_id: firstString(row, ['user_id'], ownerId),
    label: firstString(row, ['label'], 'Home'),
    recipient_name: firstString(row, ['recipient_name', 'recipientName', 'name'], ''),
    phone: firstString(row, ['phone', 'customer_phone', 'recipient_phone'], ''),
    dzongkhag: firstString(row, ['dzongkhag'], ''),
    town: firstString(row, ['town', 'town_area'], '') || null,
    gewog: firstString(row, ['gewog'], '') || null,
    village: firstString(row, ['village', 'building'], '') || null,
    landmark: firstString(row, ['landmark'], '') || null,
    address_line: firstString(row, ['address_line', 'addressLine', 'address_details'], '') || null,
    is_default: Boolean(firstValue(row, ['is_default', 'isDefault'])),
    created_at: firstString(row, ['created_at'], '') || null,
  }))
}

export type ConfirmCustomerDeliveryAddressInput = {
  orderId: string
  userId: string
  addressId?: string
  label?: string
  recipientName: string
  phone: string
  deliveryArea: string
  town?: string | null
  gewog?: string | null
  village?: string | null
  landmark?: string | null
  addressLine?: string | null
}

function makeConfirmedDeliveryAddressSnapshot(input: ConfirmCustomerDeliveryAddressInput) {
  const recipientName = cleanText(input.recipientName)
  const phone = cleanText(input.phone)
  const deliveryArea = cleanText(input.deliveryArea)
  const town = cleanText(input.town)
  const gewog = cleanText(input.gewog)
  const village = cleanText(input.village)
  const landmark = cleanText(input.landmark)
  const addressLine = cleanText(input.addressLine)
  const exactAddress = uniqueAddressParts([village, town, gewog, addressLine]).join(', ')
  const fullAddress = uniqueAddressParts([exactAddress, deliveryArea, landmark]).join(', ')

  return {
    address_id: cleanText(input.addressId) || null,
    label: cleanText(input.label) || 'Saved address',
    recipient_name: recipientName,
    phone,
    customer_phone: phone,
    delivery_address: fullAddress,
    full_address: fullAddress,
    formatted_address: fullAddress,
    address_line: addressLine || null,
    address_line1: exactAddress,
    town: town || null,
    gewog: gewog || null,
    village: village || exactAddress,
    dzongkhag: deliveryArea,
    landmark: landmark || null,
    fulfillment_mode: 'delivery',
    confirmed_at: new Date().toISOString(),
  }
}

export async function updateCustomerOrderDeliveryAddress(input: ConfirmCustomerDeliveryAddressInput) {
  await assertCustomerAppAvailable()

  const orderId = cleanText(input.orderId)
  if (!orderId) throw new Error('Order ID is required.')

  const recipientName = cleanText(input.recipientName)
  const phone = cleanText(input.phone)
  const deliveryArea = cleanText(input.deliveryArea)
  const town = cleanText(input.town)
  const gewog = cleanText(input.gewog)
  const village = cleanText(input.village)
  const addressLine = cleanText(input.addressLine)
  const exactAddress = uniqueAddressParts([village, town, gewog, addressLine]).join(', ')

  if (!recipientName) throw new Error('Please select a delivery address with recipient name.')
  if (!phone) throw new Error('Please select a delivery address with phone number.')
  if (!deliveryArea) throw new Error('Delivery area is required.')
  if (!exactAddress) throw new Error('Please select or add a complete delivery address.')

  const snapshot = makeConfirmedDeliveryAddressSnapshot({
    ...input,
    recipientName,
    phone,
    deliveryArea,
    town,
    gewog,
    village,
    addressLine,
  })
  const now = new Date().toISOString()
  const fullAddress = snapshot.full_address

  const candidates: AnyRow[] = [
    {
      shipping_address: snapshot,
      delivery_address_json: snapshot,
      address: snapshot,
      delivery_address: fullAddress,
      customer_name: recipientName,
      customer_phone: phone,
      recipient_name: recipientName,
      recipient_phone: phone,
      updated_at: now,
    },
    {
      shipping_address: snapshot,
      delivery_address: fullAddress,
      customer_name: recipientName,
      customer_phone: phone,
      updated_at: now,
    },
    {
      shipping_address: snapshot,
      customer_name: recipientName,
      customer_phone: phone,
      updated_at: now,
    },
    {
      delivery_address_json: snapshot,
      customer_name: recipientName,
      customer_phone: phone,
      updated_at: now,
    },
    {
      delivery_address: fullAddress,
      customer_name: recipientName,
      customer_phone: phone,
      updated_at: now,
    },
    {
      shipping_address: snapshot,
    },
  ]

  let lastError: unknown = null

  for (const payload of candidates) {
    const result = await supabase.from('orders').update(payload).eq('id', orderId)
    if (!result.error) return
    lastError = result.error
    if (!shouldTryFallbackPayload(result.error)) break
  }

  throw lastError instanceof Error ? lastError : new Error(errorMessage(lastError, 'Unable to save delivery address.'))
}


async function assertPaymentReferenceAvailable(input: {
  sourceBank: PaymentSourceBank
  normalizedTransactionId: string
}) {
  const { data, error } = await supabase
    .from('payments')
    .select('id, status')
    .eq('source_bank', input.sourceBank)
    .eq('normalized_transaction_id', input.normalizedTransactionId)

  if (error) {
    const message = errorMessage(error, '').toLowerCase()

    if (
      message.includes('source_bank') ||
      message.includes('transaction_id') ||
      message.includes('normalized_transaction_id') ||
      isMissingColumnOrRelationError(error)
    ) {
      throw new Error(
        'Smart payment verification is not installed in Supabase yet. Run the provided SQL patch, then try again.',
      )
    }

    throw error
  }

  const hasActiveDuplicate = ((data ?? []) as AnyRow[]).some(
    (row) => normalizePaymentStatus(firstValue(row, ['status'])) !== 'rejected',
  )

  if (hasActiveDuplicate) {
    throw new Error(
      `This ${paymentSourceBankLabel(input.sourceBank)} transaction reference has already been submitted. Please check the reference or contact Shop2Bhutan support.`,
    )
  }
}


export async function submitCustomerPaymentProof(input: PaymentProofInput) {
  await assertCustomerAppAvailable()

  const {
    order,
    userId,
    file,
    paymentMethodName,
    paymentMethodId,
    paymentMethodType,
    sourceBank,
    transactionId,
    amount,
    paymentType,
    note,
  } = input
  const paymentAmount = numericAmount(amount)
  const cleanSourceBank = normalizePaymentSourceBank(sourceBank)
  const normalizedTransactionId = normalizePaymentReference(transactionId)
  const payments = order.payments ?? (order.payment ? [order.payment] : [])
  const paymentSummary = calculatePaymentSummary({
    quotationTotal: order.paymentSummary?.totalPayable ?? order.quotation?.totalAmount ?? 0,
    payments,
  })
  const firstVerifiedPayment = paymentSummary.verifiedPaid <= 0
  const jaigaonPickup = isJaigaonSelfPickupOrder(order)
  const minimumInitialPayment = paymentSummary.totalPayable > 0
    ? Math.ceil(paymentSummary.totalPayable * (jaigaonPickup ? 1 : 0.5))
    : 0

  if (!cleanSourceBank) {
    throw new Error('Please select the bank you paid from.')
  }

  if (!normalizedTransactionId) {
    throw new Error(
      `Please enter the ${cleanSourceBank === 'bob' ? 'journal number' : 'RRNO'} shown in your payment receipt.`,
    )
  }

  if (normalizedTransactionId.length < 6 || normalizedTransactionId.length > 40) {
    throw new Error('Please enter a valid transaction reference number.')
  }

  await assertPaymentReferenceAvailable({
    sourceBank: cleanSourceBank,
    normalizedTransactionId,
  })

  if (paymentAmount <= 0) {
    throw new Error('Payment amount must be greater than 0.')
  }

  if (paymentSummary.balanceDue > 0 && paymentAmount > paymentSummary.balanceDue) {
    throw new Error(`Payment amount cannot be more than the remaining balance of Nu. ${paymentSummary.balanceDue.toLocaleString()}.`)
  }

  if (firstVerifiedPayment && minimumInitialPayment > 0 && paymentAmount < minimumInitialPayment) {
    if (jaigaonPickup) {
      throw new Error(`Jaigaon pickup requires full Shop2Bhutan charges: Nu. ${minimumInitialPayment.toLocaleString()}.`)
    }
    throw new Error(`Minimum first payment is 50% of the quotation: Nu. ${minimumInitialPayment.toLocaleString()}.`)
  }

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
      amount: paymentAmount,
      paymentMethodName,
      paymentMethodId,
      paymentMethodType,
      paymentType,
      sourceBank: cleanSourceBank,
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
    const context = await getOrderPaymentReviewContext(order.id)
    if (!isPastPaymentStage(context.orderStatus)) {
      await updateCustomerOrderStatus(order.id, 'payment_pending')
    }
  } catch (error) {
    console.warn('[customerOrders] order status update skipped:', error)
  }

  try {
    await createAdminPaymentUploadedNotification({
      order,
      amount: paymentAmount,
      paymentType,
      transactionId,
    })
  } catch (error) {
    console.warn('[customerOrders] admin payment upload notification skipped:', error)
  }

  try {
    await createCustomerPaymentSubmittedNotification({
      order,
      userId,
      amount: paymentAmount,
      paymentType,
      transactionId,
    })
  } catch (error) {
    console.warn('[customerOrders] customer payment submitted notification skipped:', error)
  }

  return { path }
}


const ORDER_PROGRESS_SEQUENCE: OrderStatus[] = [
  'pending_confirmation',
  'quotation_pending',
  'quoted',
  'payment_pending',
  'payment_verified',
  'order_placed',
  'in_transit',
  'arrived_at_hub',
  'out_for_delivery',
  'delivered',
]

function orderProgressIndex(status: OrderStatus) {
  const index = ORDER_PROGRESS_SEQUENCE.indexOf(status)
  return index >= 0 ? index : 0
}

function isPastPaymentStage(status: OrderStatus) {
  return orderProgressIndex(status) > orderProgressIndex('payment_verified')
}

async function getOrderPaymentReviewContext(orderId: string) {
  const orderResult = await supabase.from('orders').select('status, order_status').eq('id', orderId).maybeSingle()
  const rawOrderStatus = orderResult.error
    ? 'payment_pending'
    : firstValue(orderResult.data as AnyRow | null, ['status', 'order_status'])
  const orderStatus = normalizeOrderStatus(rawOrderStatus)

  const paymentsResult = await supabase.from('payments').select('status, amount').eq('order_id', orderId)
  const rows = paymentsResult.error ? [] : ((paymentsResult.data ?? []) as AnyRow[])
  const hasVerifiedPayment = rows.some((row) => normalizePaymentStatus(firstValue(row, ['status'])) === 'verified')

  return {
    orderStatus,
    hasVerifiedPayment,
  }
}

async function updateOrderStatusAfterPaymentReview(paymentId: string, status: PaymentStatus) {
  const { data, error } = await supabase
    .from('payments')
    .select('order_id')
    .eq('id', paymentId)
    .maybeSingle()

  if (error) {
    console.warn('[customerOrders] payment order lookup skipped:', error)
    return
  }

  const orderId = firstString(data as AnyRow | null, ['order_id'], '')
  if (!orderId) return

  const context = await getOrderPaymentReviewContext(orderId)

  // Never move an order backwards once fulfillment has started. This is important
  // when the customer uploads the remaining balance after admin already marked
  // the order as ordered / in transit / out for delivery.
  if (isPastPaymentStage(context.orderStatus)) return

  const nextOrderStatus: OrderStatus =
    status === 'verified' || context.hasVerifiedPayment ? 'payment_verified' : 'payment_pending'

  if (nextOrderStatus === context.orderStatus) return

  await updateCustomerOrderStatus(orderId, nextOrderStatus)

  try {
    await insertOrderTrackingEvent({
      orderId,
      status: nextOrderStatus,
      title: nextOrderStatus === 'payment_verified' ? 'Payment Verified' : 'Payment Update',
      message:
        nextOrderStatus === 'payment_verified'
          ? 'Your payment has been verified by Shop2Bhutan.'
          : 'Your payment proof needs attention. Please check the payment section.',
      visibleToCustomer: true,
    })
  } catch (trackingError) {
    console.warn('[customerOrders] payment review tracking event skipped:', trackingError)
  }
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
    if (!result.error) {
      await updateOrderStatusAfterPaymentReview(params.paymentId, params.status)
      return
    }

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
      await updateCustomerOrderStatus(input.order.id, 'payment_verified')
    } catch (error) {
      console.warn('[customerOrders] order status after payment verification skipped:', error)
    }
  }

  try {
    await createPaymentReviewNotificationForOrder({
      order: input.order,
      status: 'verified',
      paymentId: input.paymentId,
      adminNote: input.adminNote,
    })
  } catch (error) {
    console.warn('[customerOrders] payment verified notification skipped:', error)
  }
}

export async function rejectCustomerPayment(input: {
  order: Order
  paymentId: string
  adminId?: string
  adminNote?: string
}) {
  const adminNote = input.adminNote || 'Rejected by admin.'

  await updatePaymentReviewStatus({
    paymentId: input.paymentId,
    status: 'rejected',
    adminId: input.adminId,
    adminNote,
  })

  if (input.order.status === 'quoted' || input.order.status === 'payment_pending') {
    try {
      await updateCustomerOrderStatus(input.order.id, 'payment_pending')
    } catch (error) {
      console.warn('[customerOrders] order status after payment rejection skipped:', error)
    }
  }

  try {
    await createPaymentReviewNotificationForOrder({
      order: input.order,
      status: 'rejected',
      paymentId: input.paymentId,
      adminNote,
    })
  } catch (error) {
    console.warn('[customerOrders] payment rejection notification skipped:', error)
  }
}

function firstProductUrlCandidate(value: string) {
  const raw = cleanText(value)
  if (!raw) return ''

  const matchedUrl = raw.match(
    /https?:\/\/[^\s<>"']+/i
  )?.[0]

  return (matchedUrl || raw).replace(
    /[\])},.;!?]+$/g,
    ''
  )
}

export function normalizeProductUrl(value: string) {
  const candidate = firstProductUrlCandidate(value)
  if (!candidate) return ''

  const withProtocol = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`

  try {
    const url = new URL(withProtocol)
    url.hash = ''
    return url.toString()
  } catch {
    return ''
  }
}

export function detectSourcePlatformFromUrl(url: string) {
  const raw = String(url ?? '').toLowerCase()

  if (raw.includes('amazon.') || raw.includes('amzn.')) return 'amazon'
  if (raw.includes('flipkart.') || raw.includes('fkrt.')) return 'flipkart'
  if (raw.includes('myntra.')) return 'myntra'
  if (raw.includes('meesho.')) return 'meesho'

  return 'other'
}

function platformToDbValue(platformOrUrl: string | undefined) {
  const raw = String(platformOrUrl ?? '').toLowerCase()

  if (raw === 'amazon' || raw.includes('amazon.') || raw.includes('amzn.')) return 'amazon'
  if (raw === 'flipkart' || raw.includes('flipkart.') || raw.includes('fkrt.')) return 'flipkart'
  if (raw === 'myntra' || raw.includes('myntra.')) return 'myntra'
  if (raw === 'meesho' || raw.includes('meesho.')) return 'meesho'

  return 'other'
}

function productNameFromPlatform(platform: string) {
  if (!platform || platform === 'other') return 'Pasted product link'
  return `Product from ${platform.charAt(0).toUpperCase()}${platform.slice(1)}`
}

function safeDecodeUrlPart(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function prettifyProductSlug(value: string) {
  const clean = safeDecodeUrlPart(value)
    .replace(/\.(html?|aspx?)$/i, '')
    .replace(/[-_+]+/g, ' ')
    .replace(/\bmen women\b/gi, 'men and women')
    .replace(/\boil free\b/gi, 'oil-free')
    .replace(/\s+/g, ' ')
    .trim()

  if (!clean || clean.length < 4) return ''

  return clean
    .split(' ')
    .map((word) => {
      if (!word) return word
      if (/^[A-Z0-9]{2,}$/.test(word)) return word
      if (/^\d+(?:\.\d+)?$/.test(word)) return word
      if (/^[a-z]\d+$/i.test(word)) return word.toUpperCase()
      if (['and', 'for', 'with', 'of', 'to', 'in', 'on'].includes(word.toLowerCase())) {
        return word.toLowerCase()
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
    .replace(/^./, (letter) => letter.toUpperCase())
}

function productSlugCandidateScore(value: string) {
  const decoded = safeDecodeUrlPart(value).toLowerCase()
  if (!decoded || decoded.length < 5) return -1
  if (/^(p|dp|gp|product|products|buy|dl|item|s|share|mobile|www)$/.test(decoded)) return -1
  if (/^[a-z0-9]{8,}$/i.test(decoded) && !decoded.includes('-')) return -1

  let score = decoded.length
  if (decoded.includes('-') || decoded.includes('_')) score += 30
  if (/\d/.test(decoded)) score += 4
  if (decoded.split(/[-_+]/).length >= 3) score += 25
  return score
}

export function inferProductNameFromUrl(value: string, platformHint?: string) {
  const normalizedUrl = normalizeProductUrl(value)
  const platform = platformHint || detectSourcePlatformFromUrl(normalizedUrl || value)
  const genericTitle = productNameFromPlatform(platform)

  if (!normalizedUrl) return genericTitle

  try {
    const parsed = new URL(normalizedUrl)
    const segments = parsed.pathname
      .split('/')
      .map((segment) => safeDecodeUrlPart(segment).trim())
      .filter(Boolean)

    const candidates: string[] = []

    const addBeforeMarker = (marker: string) => {
      const index = segments.findIndex((segment) => segment.toLowerCase() === marker)
      if (index > 0) candidates.push(segments[index - 1])
    }

    if (platform === 'flipkart' || platform === 'meesho') {
      addBeforeMarker('p')
    }

    if (platform === 'amazon') {
      addBeforeMarker('dp')
      const productIndex = segments.findIndex(
        (segment, index) =>
          segment.toLowerCase() === 'product' &&
          index > 0 &&
          segments[index - 1]?.toLowerCase() === 'gp'
      )
      if (productIndex > 0) candidates.push(segments[productIndex - 2] || '')
    }

    if (platform === 'myntra') {
      const buyIndex = segments.findIndex((segment) => segment.toLowerCase() === 'buy')
      if (buyIndex > 1) candidates.push(segments[buyIndex - 2])

      const numericIndex = segments.findIndex((segment) => /^\d{5,}$/.test(segment))
      if (numericIndex > 0) candidates.push(segments[numericIndex - 1])
    }

    candidates.push(...segments)

    const best = candidates
      .filter(Boolean)
      .map((candidate) => ({
        candidate,
        score: productSlugCandidateScore(candidate),
      }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)[0]?.candidate

    const inferred = best ? prettifyProductSlug(best) : ''
    return inferred || genericTitle
  } catch {
    return genericTitle
  }
}

function fallbackProductPreview(url: string, message?: string): ProductLinkPreview {
  const normalizedUrl = normalizeProductUrl(url) || cleanText(url)
  const platform = detectSourcePlatformFromUrl(normalizedUrl)
  const title = inferProductNameFromUrl(normalizedUrl, platform)
  const genericTitle = productNameFromPlatform(platform)

  return {
    url: normalizedUrl,
    platform,
    title,
    fetched: title !== genericTitle,
    message:
      message ||
      (title !== genericTitle
        ? 'Product name detected from the link. Shop2Bhutan will verify the photo and price before quotation.'
        : 'Shop2Bhutan will verify this product manually before quotation.'),
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

function isJunkPreviewTitle(value: unknown) {
  const title = cleanText(value).toLowerCase()

  if (!title || title.length < 3) return true

  return [
    'site maintenance',
    'under maintenance',
    'service unavailable',
    'temporarily unavailable',
    'something went wrong',
    'access denied',
    'request blocked',
    'robot check',
    'captcha',
    'page not found',
    'please try again later',
    'online shopping site for mobiles',
  ].some((phrase) => title.includes(phrase))
}

function normalizePreviewPayload(payload: unknown, requestedUrl: string): ProductLinkPreview {
  const raw = (payload && typeof payload === 'object' ? payload : {}) as AnyRow
  const preview = pickPreviewObject(raw)
  const rawUrl = preview.url || preview.sourceUrl || preview.productUrl || raw.url
  const normalizedUrl = normalizeProductUrl(String(rawUrl ?? requestedUrl)) || requestedUrl
  const platform =
    cleanText(preview.platform || preview.sourcePlatform || raw.platform) ||
    detectSourcePlatformFromUrl(normalizedUrl)

  const genericTitle = productNameFromPlatform(platform)
  const urlTitle = inferProductNameFromUrl(normalizedUrl, platform)
  const responseTitle = cleanText(
    preview.title ||
      preview.name ||
      preview.productName ||
      preview.product_title ||
      preview.item_name ||
      raw.title ||
      raw.name
  )

  const title =
    responseTitle &&
    responseTitle !== genericTitle &&
    !isJunkPreviewTitle(responseTitle)
      ? responseTitle
      : urlTitle || genericTitle

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

  const detectedDetails =
    Boolean(title && title !== genericTitle) ||
    Boolean(image) ||
    Boolean(price)

  const fetchedFlag = preview.fetched ?? raw.fetched ?? raw.ok ?? raw.success
  const fetched =
    typeof fetchedFlag === 'boolean'
      ? fetchedFlag || detectedDetails
      : detectedDetails

  return {
    url: normalizedUrl,
    platform,
    title,
    image: image || undefined,
    price,
    currency:
      cleanText(preview.currency || preview.priceCurrency || raw.currency) ||
      undefined,
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
      }, 15000)
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
  const fulfillmentMode = normalizeFulfillmentModeValue(input.fulfillmentMode)
  const pickupHub = resolvePickupHub(input)
  const deliveryAddress = makeFulfillmentAddress(input)
  const fulfillmentNote = makeFulfillmentNote(input)
  const customerNotes =
    cleanText(input.customerNotes) ||
    `Paste-link order submitted by customer. Name: ${cleanText(input.customerName)}. Phone: ${cleanText(input.customerPhone)}.`
  const notesWithAddress = `${customerNotes}

${fulfillmentNote}${
    deliveryAddress && !customerNotes.toLowerCase().includes('delivery address') && fulfillmentMode === 'delivery'
      ? `

Delivery address: ${deliveryAddress}`
      : ''
  }`
  const shippingSnapshot = makeSubmittedAddressSnapshot(input)

  const base: AnyRow = {
    user_id: input.userId,
    order_type: 'paste_link',
    customer_name: cleanText(input.customerName),
    customer_phone: cleanText(input.customerPhone),
    customer_email: cleanText(input.email),
    delivery_address: deliveryAddress || null,
    customer_notes: notesWithAddress,
    fulfillment_mode: fulfillmentMode,
    pickup_hub_id: fulfillmentMode === 'self_pickup' ? pickupHub.id : null,
    pickup_hub_name: fulfillmentMode === 'self_pickup' ? pickupHub.name : null,
    pickup_instructions: fulfillmentMode === 'self_pickup' ? pickupHub.instructions : null,
  }

  const compactBase: AnyRow = {
    user_id: input.userId,
    order_type: 'paste_link',
    status: 'pending',
    customer_name: cleanText(input.customerName) || 'Customer',
    customer_phone: cleanText(input.customerPhone) || 'Not provided',
    customer_email: cleanText(input.email) || null,
    delivery_address: deliveryAddress || null,
    customer_notes: notesWithAddress,
    fulfillment_mode: fulfillmentMode,
    pickup_hub_id: fulfillmentMode === 'self_pickup' ? pickupHub.id : null,
    pickup_hub_name: fulfillmentMode === 'self_pickup' ? pickupHub.name : null,
    pickup_instructions: fulfillmentMode === 'self_pickup' ? pickupHub.instructions : null,
    notes: notesWithAddress,
  }

  return [
    // Current production orders table shape. Keep this first to avoid falling through
    // to older payloads that may be missing NOT NULL columns.
    compactBase,
    { ...base, order_type: 'paste_link' },
    { ...base, order_type: 'paste_link', type: 'paste_link' },
    { ...base, shipping_address: shippingSnapshot, order_type: 'paste_link' },
    { ...base, delivery_address_json: shippingSnapshot, order_type: 'paste_link' },
    { ...compactBase, order_type: 'external_link' },
    { ...compactBase, type: 'paste_link' },
  ]
}

async function insertPasteLinkOrderRow(input: SubmitPasteLinkOrderInput) {
  let lastError: unknown = null

  for (const rawPayload of makeOrderPayloadCandidates(input)) {
    const fulfillmentMode = normalizeFulfillmentModeValue(input.fulfillmentMode)
    const pickupHub = resolvePickupHub(input)
    const deliveryAddress = makeFulfillmentAddress(input)
    const fallbackNotes =
      cleanText(input.customerNotes) ||
      `Paste-link order submitted by customer. Name: ${cleanText(input.customerName) || 'Customer'}. Phone: ${cleanText(input.customerPhone) || 'Not provided'}.`

    const payload: AnyRow = {
      ...rawPayload,

      // Final safety guard for the real orders table:
      // these columns are NOT NULL in production and must be present even if
      // an older fallback payload is used.
      user_id: cleanText(rawPayload.user_id) || input.userId,
      order_type: cleanText(rawPayload.order_type) || 'paste_link',
      customer_name: cleanText(rawPayload.customer_name) || cleanText(input.customerName) || 'Customer',
      customer_phone: cleanText(rawPayload.customer_phone) || cleanText(input.customerPhone) || 'Not provided',
      customer_email: cleanText(rawPayload.customer_email) || cleanText(input.email) || null,
      delivery_address: cleanText(rawPayload.delivery_address) || deliveryAddress || null,
      customer_notes: cleanText(rawPayload.customer_notes || rawPayload.notes) || fallbackNotes,
      fulfillment_mode: fulfillmentMode,
      pickup_hub_id: fulfillmentMode === 'self_pickup' ? pickupHub.id : null,
      pickup_hub_name: fulfillmentMode === 'self_pickup' ? pickupHub.name : null,
      pickup_instructions: fulfillmentMode === 'self_pickup' ? pickupHub.instructions : null,
    }

    // These are legacy / optional fields. Remove them when they do not match
    // the current Supabase table shape to avoid unnecessary 400 fallback inserts.
    if (payload.delivery_hub_id && !isUuidLike(cleanText(payload.delivery_hub_id))) {
      delete payload.delivery_hub_id
    }
    delete payload.delivery_hub_name

    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) delete payload[key]
    })

    const { data, error } = await supabase
      .from('orders')
      .insert(payload as any)
      .select('id, order_no')
      .single()

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
  await assertNewShoppingRequestsAllowed()
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

  const result = {
    orderId: orderRow.id,
    orderNo: orderRow.order_no || orderRow.id,
  }

  await createAdminOrderSubmittedNotification({
    orderId: result.orderId,
    orderNo: result.orderNo,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    itemCount: cleanItems.length,
  })

  return result
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
  fulfillmentMode?: FulfillmentMode | string
  pickupHubId?: string | null
  pickupHubName?: string | null
  pickupInstructions?: string | null
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


function makeRequestBagItemDisplayFast(row: AnyRow): RequestBagItem {
  const screenshotPath = firstString(row, ['screenshot_path', 'attachment_path'], '')
  const productImage = makeFastDisplayImage(
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
    screenshotUrl: '',
    createdAt: firstString(row, ['created_at'], ''),
    updatedAt: firstString(row, ['updated_at'], firstString(row, ['created_at'], '')),
  }
}

async function fetchRequestBagItemsFast(bagId: string) {
  const { data, error } = await supabase
    .from('customer_request_bag_items')
    .select('*')
    .eq('bag_id', bagId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return ((data ?? []) as AnyRow[]).map(makeRequestBagItemDisplayFast)
}

function makeRequestBagDisplayFromItems(row: AnyRow, items: RequestBagItem[]): RequestBag {
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
  return makeRequestBagDisplayFromItems(row, items)
}

async function makeRequestBagDisplayFast(row: AnyRow): Promise<RequestBag> {
  const items = await fetchRequestBagItemsFast(firstString(row, ['id'], ''))
  return makeRequestBagDisplayFromItems(row, items)
}

export async function fetchActiveRequestBagFast(userId: string) {
  if (!userId) throw new Error('Please sign in to view your Request Bag.')
  const row = await ensureActiveRequestBagRow(userId)
  return makeRequestBagDisplayFast(row)
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
  await assertNewShoppingRequestsAllowed()

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
  await assertCustomerAppAvailable()

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
  await assertCustomerAppAvailable()

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

function isMissingRequestBagSubmissionRpc(error: unknown) {
  const message = errorMessage(error, '').toLowerCase()

  return (
    message.includes('submit_request_bag_transactional') &&
    (
      message.includes('could not find') ||
      message.includes('schema cache') ||
      message.includes('does not exist') ||
      message.includes('function')
    )
  )
}

export async function submitRequestBagAsOrder(input: SubmitRequestBagInput): Promise<SubmitPasteLinkOrderResult> {
  if (!input.userId) throw new Error('Please sign in before requesting a quotation.')
  await assertNewShoppingRequestsAllowed()
  if (!input.bagId) throw new Error('Request Bag not found.')
  if (!cleanText(input.customerName)) throw new Error('Customer name is required.')
  if (!cleanText(input.customerPhone)) throw new Error('Phone number is required.')

  const fulfillmentMode = normalizeFulfillmentModeValue(input.fulfillmentMode)
  const pickupHub = resolvePickupHub(input)
  const customerNotes =
    cleanText(input.customerNotes) ||
    `Request Bag submitted by customer. Name: ${cleanText(input.customerName)}. Phone: ${cleanText(input.customerPhone)}.`

  const { data, error } = await supabase.rpc(
    'submit_request_bag_transactional',
    {
      p_bag_id: input.bagId,
      p_customer_name: cleanText(input.customerName),
      p_customer_phone: cleanText(input.customerPhone),
      p_customer_email: cleanText(input.email) || null,
      p_delivery_address: makeFulfillmentAddress(input) || null,
      p_customer_notes: customerNotes,
      p_fulfillment_mode: fulfillmentMode,
      p_pickup_hub_id:
        fulfillmentMode === 'self_pickup'
          ? pickupHub.id
          : null,
      p_pickup_hub_name:
        fulfillmentMode === 'self_pickup'
          ? pickupHub.name
          : null,
      p_pickup_instructions:
        fulfillmentMode === 'self_pickup'
          ? pickupHub.instructions
          : null,
    },
  )

  if (error) {
    if (isMissingRequestBagSubmissionRpc(error)) {
      throw new Error(
        'Secure Request Bag submission is not installed yet. Run Request_Bag_Transactional_Submission.sql in Supabase, then try again.',
      )
    }

    throw new Error(
      errorMessage(
        error,
        'Unable to submit your shopping request securely.',
      ),
    )
  }

  const resultRow = (
    Array.isArray(data)
      ? data[0]
      : data
  ) as AnyRow | null

  const orderId = firstString(
    resultRow,
    ['order_id', 'orderId', 'id'],
    '',
  )

  if (!orderId) {
    throw new Error(
      'The shopping request was processed, but no order reference was returned.',
    )
  }

  const orderNo = firstString(
    resultRow,
    ['order_no', 'orderNo', 'order_number'],
    orderId,
  )
  const itemCount = firstNumber(
    resultRow,
    ['item_count', 'itemCount'],
    0,
  )

  // Notifications are deliberately outside the database transaction.
  // The dedupe key uses the order UUID, so a safe retry cannot create
  // duplicate admin notifications.
  try {
    await createAdminOrderSubmittedNotification({
      orderId,
      orderNo,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      itemCount,
    })
  } catch (notificationError) {
    console.warn(
      '[customerOrders] Request Bag submitted; admin notification deferred:',
      notificationError,
    )
  }

  return {
    orderId,
    orderNo,
  }
}

export async function sendAdminCustomerUpdate(input: {
  order: Order
  title?: string
  message: string
}) {
  const order = input.order
  const userId = cleanText(order.userId || order.user?.id)
  const message = cleanText(input.message)

  if (!userId) {
    throw new Error('This order does not have a valid customer account.')
  }

  if (!message) {
    throw new Error('Customer update message cannot be empty.')
  }

  const orderNo =
    cleanText(order.orderNumber) || order.id.slice(0, 8).toUpperCase()
  const title =
    cleanText(input.title) || `Order #${orderNo}: Shop2Bhutan Update`

  await createCustomerNotification({
    userId,
    type: 'order_update',
    title,
    message,
    link: `/order/${order.id}`,
    dedupeKey: `admin:manual-order-update:${order.id}:${Date.now()}`,
  })
}

