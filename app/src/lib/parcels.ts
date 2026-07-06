import { supabase } from '@/lib/supabase'
import {
  createAdminParcelSubmittedNotification,
  createCustomerParcelStatusNotification,
} from '@/lib/customerOrders'
import type {
  ParcelRequest,
  ParcelRequestStatus,
  ParcelSize,
  ParcelTrip,
  ParcelTripStatus,
  ParcelType,
} from '@/types/parcel'

type Row = Record<string, any>

export type CreateParcelRequestInput = {
  tripId: string
  senderName: string
  senderPhone: string
  pickupAddress: string
  receiverName: string
  receiverPhone: string
  dropoffAddress: string
  packageDescription: string
  parcelType: ParcelType
  parcelSize: ParcelSize
  parcelPhotoFile: File
  customerNotes?: string
}

export type CreateParcelTripInput = {
  title?: string
  origin?: string
  destination?: string
  goingDate: string
  bookingCutoffAt?: string | null
  status?: ParcelTripStatus
}

function text(value: unknown) {
  return String(value ?? '').trim()
}

function nullableText(value: unknown) {
  const cleaned = text(value)
  return cleaned || null
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

const DUPLICATE_PARCEL_WINDOW_MINUTES = 30

const duplicateParcelStatuses: ParcelRequestStatus[] = [
  'pending',
  'accepted',
  'picked_up',
  'in_transit',
  'delivered',
]

function normalizeParcelPhone(value: unknown) {
  const digits = text(value).replace(/\D/g, '')

  if (digits.startsWith('975') && digits.length > 8) {
    return digits.slice(3)
  }

  return digits || text(value).toLowerCase()
}

function normalizeParcelDescription(value: unknown) {
  return text(value).toLowerCase().replace(/\s+/g, ' ')
}

function duplicateParcelMessage(parcelNo?: string | null) {
  return parcelNo
    ? `This parcel request looks already submitted (${parcelNo}). Please check My Parcels before submitting again.`
    : 'This parcel request looks already submitted. Please check My Parcels before submitting again.'
}

export function isParcelTripBookable(trip?: ParcelTrip | null) {
  if (!trip) return false
  if (trip.status !== 'open') return false

  if (trip.goingDate && trip.goingDate < todayDate()) return false

  if (trip.bookingCutoffAt) {
    const cutoffTime = new Date(trip.bookingCutoffAt).getTime()
    if (Number.isFinite(cutoffTime) && cutoffTime <= Date.now()) {
      return false
    }
  }

  return true
}

export function getParcelTripBookingClosedMessage(trip?: ParcelTrip | null) {
  if (!trip) return 'This parcel trip is not available for booking.'
  if (trip.status !== 'open') return 'Booking is closed for this parcel trip.'
  if (trip.goingDate && trip.goingDate < todayDate()) {
    return 'This parcel trip date has already passed.'
  }

  if (trip.bookingCutoffAt) {
    const cutoffTime = new Date(trip.bookingCutoffAt).getTime()
    if (Number.isFinite(cutoffTime) && cutoffTime <= Date.now()) {
      return 'Booking cutoff has passed for this parcel trip.'
    }
  }

  return 'Booking is not available for this parcel trip.'
}

function fallbackTrip(): ParcelTrip {
  return {
    id: '',
    title: 'Thimphu → Phuentsholing',
    name: 'Thimphu → Phuentsholing',
    origin: 'Thimphu',
    destination: 'Phuentsholing',
    fromLocation: 'Thimphu',
    toLocation: 'Phuentsholing',
    goingDate: '',
    returnDate: '',
    bookingCutoffAt: null,
    pickupAreas: [],
    status: 'open',
    createdBy: null,
    createdAt: '',
    updatedAt: '',
    requestCount: 0,
    description: 'Lightweight parcel pickup and delivery',
    isActive: true,
  }
}

function mapTrip(row: Row | null | undefined): ParcelTrip {
  if (!row) return fallbackTrip()

  const origin = text(row.origin) || 'Thimphu'
  const destination = text(row.destination) || 'Phuentsholing'
  const title = text(row.title) || `${origin} → ${destination}`

  return {
    id: String(row.id ?? ''),
    title,
    name: title,
    origin,
    destination,
    fromLocation: origin,
    toLocation: destination,
    goingDate: row.going_date ?? '',
    returnDate: row.return_date ?? '',
    bookingCutoffAt: row.booking_cutoff_at ?? null,
    pickupAreas: Array.isArray(row.pickup_areas) ? row.pickup_areas : [],
    status: (row.status ?? 'draft') as ParcelTripStatus,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
    requestCount: Array.isArray(row.parcel_requests)
      ? row.parcel_requests.length
      : Number(row.request_count ?? 0),
    description: `${origin} to ${destination}`,
    isActive: row.status === 'open',
  }
}

async function getCurrentUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session?.user?.id ?? null
}

async function getUserId() {
  const userId = await getCurrentUserId()

  if (!userId) throw new Error('Please login to continue.')

  return userId
}

export async function ensureParcelGuestSession() {
  const {
    data: { session: existingSession },
  } = await supabase.auth.getSession()

  if (existingSession?.user?.id) return existingSession.user

  const { data, error } = await supabase.auth.signInAnonymously()

  if (error) {
    throw new Error(
      'Guest booking is not enabled yet. Please enable Anonymous Sign-Ins in Supabase Authentication settings.',
    )
  }

  if (!data.user?.id) {
    throw new Error('Unable to start guest booking session. Please try again.')
  }

  return data.user
}

async function getParcelBookingUserId() {
  const user = await ensureParcelGuestSession()
  return user.id
}

function makePhotoName(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeName = file.name
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)

  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  return `${safeName || 'parcel'}-${random}.${extension}`
}

async function uploadParcelPhoto(userId: string, file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload a valid image.')
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Parcel photo must be below 5 MB.')
  }

  const path = `${userId}/${makePhotoName(file)}`

  const { error } = await supabase.storage
    .from('parcel-photos')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) throw error

  return path
}

async function getSignedPhotoUrl(path?: string | null) {
  if (!path) return null

  const { data, error } = await supabase.storage
    .from('parcel-photos')
    .createSignedUrl(path, 60 * 60)

  if (error) return null

  return data?.signedUrl ?? null
}

function mapTrackingEvents(row: Row) {
  const rawEvents = Array.isArray(row.parcel_tracking_events)
    ? row.parcel_tracking_events
    : []

  return rawEvents
    .map((event: Row) => ({
      id: String(event.id ?? ''),
      parcelRequestId: String(event.parcel_request_id ?? row.id ?? ''),
      status: (event.status ?? 'pending') as ParcelRequestStatus,
      title: text(event.title),
      message: event.message ?? null,
      location: event.location ?? null,
      visibleToCustomer: event.visible_to_customer !== false,
      createdBy: event.created_by ?? null,
      createdAt: event.created_at ?? '',
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

function parcelStatusTitle(status: ParcelRequestStatus) {
  if (status === 'accepted') return 'Request Accepted'
  if (status === 'picked_up' || status === 'collected') return 'Picked Up'
  if (status === 'in_transit') return 'In Transit'
  if (status === 'delivered') return 'Delivered'
  if (status === 'rejected') return 'Request Rejected'
  if (status === 'cancelled') return 'Request Cancelled'

  return 'Request Submitted'
}

function parcelStatusMessage(status: ParcelRequestStatus, adminNotes?: string) {
  if (adminNotes?.trim()) return adminNotes.trim()

  if (status === 'accepted') return 'Your parcel request has been accepted.'
  if (status === 'picked_up' || status === 'collected')
    return 'Your parcel has been picked up.'
  if (status === 'in_transit') return 'Your parcel is on the way.'
  if (status === 'delivered') return 'Your parcel has been delivered.'
  if (status === 'rejected') return 'Your parcel request was rejected.'
  if (status === 'cancelled') return 'This parcel request was cancelled.'

  return 'Your parcel request has been submitted.'
}

type MapRequestOptions = {
  includePhotoUrl?: boolean
}

async function mapRequest(
  row: Row,
  options: MapRequestOptions = {},
): Promise<ParcelRequest> {
  const trip = mapTrip(row.parcel_trips)

  const photoPath = row.parcel_photo_path ?? null
  const shouldLoadPhotoUrl = options.includePhotoUrl ?? true
  const photoUrl = shouldLoadPhotoUrl ? await getSignedPhotoUrl(photoPath) : null

  return {
    id: String(row.id),
    parcelNo: row.parcel_no ?? null,
    userId: String(row.user_id ?? ''),
    tripId: row.trip_id ?? null,
    trip,
    status: row.status as ParcelRequestStatus,

    senderName: text(row.sender_name),
    senderPhone: text(row.sender_phone),
    pickupAddress: row.pickup_address ?? null,

    receiverName: text(row.receiver_name),
    receiverPhone: text(row.receiver_phone),
    dropoffAddress: row.dropoff_address ?? null,

    packageDescription: text(row.package_description),
    description: text(row.package_description),

    parcelType: row.parcel_type ?? null,
    parcelSize: row.parcel_size ?? 'small_packet',

    parcelPhotoPath: photoPath,
    parcelPhotoUrl: photoUrl,

    estimatedFee:
      row.estimated_fee === null || row.estimated_fee === undefined
        ? null
        : Number(row.estimated_fee),
    finalFee:
      row.final_fee === null || row.final_fee === undefined
        ? null
        : Number(row.final_fee),

    customerNotes: row.customer_notes ?? null,
    adminNotes: row.admin_notes ?? null,
    declarationConfirmed: Boolean(row.declaration_confirmed),

    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',

    trackingEvents: mapTrackingEvents(row),

    contactNumber: text(row.sender_phone),
    weightKg: 0,
    instructions: row.customer_notes ?? '',
  }
}

async function fetchTrackingEventsByRequestIds(requestIds: string[]) {
  if (requestIds.length === 0) return new Map<string, Row[]>()

  const { data, error } = await supabase
    .from('parcel_tracking_events')
    .select('*')
    .in('parcel_request_id', requestIds)
    .eq('visible_to_customer', true)
    .order('created_at', { ascending: true })

  if (error) {
    console.warn(
      '[fetchTrackingEventsByRequestIds] Tracking events skipped:',
      error,
    )
    return new Map<string, Row[]>()
  }

  return (data ?? []).reduce((acc, event) => {
    const requestId = String(event.parcel_request_id ?? '')
    if (!requestId) return acc

    const events = acc.get(requestId) ?? []
    events.push(event)
    acc.set(requestId, events)

    return acc
  }, new Map<string, Row[]>())
}

export async function fetchOpenParcelTrips() {
  const { data, error } = await supabase
    .from('parcel_trips')
    .select('*')
    .eq('status', 'open')
    .gte('going_date', todayDate())
    .order('going_date', { ascending: true })

  if (error) throw error

  return (data ?? []).map(mapTrip).filter(isParcelTripBookable)
}

export async function fetchParcelTripById(tripId: string) {
  const { data, error } = await supabase
    .from('parcel_trips')
    .select('*')
    .eq('id', tripId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return mapTrip(data)
}

async function findRecentDuplicateParcelRequest(input: CreateParcelRequestInput) {
  const since = new Date(
    Date.now() - DUPLICATE_PARCEL_WINDOW_MINUTES * 60 * 1000,
  ).toISOString()

  const senderPhone = normalizeParcelPhone(input.senderPhone)
  const receiverPhone = normalizeParcelPhone(input.receiverPhone)
  const description = normalizeParcelDescription(input.packageDescription)

  if (!senderPhone || !receiverPhone || !description) return null

  const { data, error } = await supabase
    .from('parcel_requests')
    .select('id, parcel_no, sender_phone, receiver_phone, package_description, status, created_at')
    .eq('trip_id', input.tripId)
    .in('status', duplicateParcelStatuses)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.warn('[findRecentDuplicateParcelRequest] Duplicate check skipped:', error)
    return null
  }

  return (data ?? []).find((row) => {
    return (
      normalizeParcelPhone(row.sender_phone) === senderPhone &&
      normalizeParcelPhone(row.receiver_phone) === receiverPhone &&
      normalizeParcelDescription(row.package_description) === description
    )
  }) ?? null
}

export async function createParcelRequest(input: CreateParcelRequestInput) {
  const userId = await getParcelBookingUserId()
  const trip = await fetchParcelTripById(input.tripId)

  if (!isParcelTripBookable(trip)) {
    throw new Error(getParcelTripBookingClosedMessage(trip))
  }

  const duplicate = await findRecentDuplicateParcelRequest(input)

  if (duplicate) {
    throw new Error(duplicateParcelMessage(duplicate.parcel_no ?? null))
  }

  const senderPhone = normalizeParcelPhone(input.senderPhone) || text(input.senderPhone)
  const receiverPhone =
    normalizeParcelPhone(input.receiverPhone) || text(input.receiverPhone)

  const photoPath = await uploadParcelPhoto(userId, input.parcelPhotoFile)

  const { data, error } = await supabase
    .from('parcel_requests')
    .insert({
      user_id: userId,
      trip_id: input.tripId,
      status: 'pending',

      sender_name: text(input.senderName),
      sender_phone: senderPhone,
      pickup_address: text(input.pickupAddress),

      receiver_name: text(input.receiverName),
      receiver_phone: receiverPhone,
      dropoff_address: text(input.dropoffAddress),

      package_description: text(input.packageDescription),
      parcel_type: input.parcelType,
      parcel_size: input.parcelSize,
      parcel_photo_path: photoPath,

      customer_notes: nullableText(input.customerNotes),
      declaration_confirmed: true,
    })
    .select('*')
    .single()

  if (error) {
    console.error('[createParcelRequest] Supabase error:', error)
    throw new Error(error.message || 'Failed to submit parcel request.')
  }

  const createdRequest = await mapRequest({
    ...data,
    parcel_trips: null,
  })

  try {
    await createAdminParcelSubmittedNotification({
      requestId: String(data.id),
      parcelNo: data.parcel_no ?? null,
      customerName: input.senderName,
      customerPhone: input.senderPhone,
      packageDescription: input.packageDescription,
    })

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('shop2bhutan:admin-parcels-updated'))
      window.dispatchEvent(new CustomEvent('shop2bhutan:parcels-updated'))
    }
  } catch (notificationError) {
    console.warn(
      '[createParcelRequest] Admin parcel notification skipped:',
      notificationError,
    )
  }

  return createdRequest
}

export async function fetchMyActiveParcelRequestsPreview(limit = 2) {
  const userId = await getCurrentUserId()

  if (!userId) return []

  const { data, error } = await supabase
    .from('parcel_requests')
    .select(`
      id,
      parcel_no,
      user_id,
      trip_id,
      status,
      sender_name,
      sender_phone,
      pickup_address,
      receiver_name,
      receiver_phone,
      dropoff_address,
      package_description,
      parcel_type,
      parcel_size,
      customer_notes,
      admin_notes,
      declaration_confirmed,
      created_at,
      updated_at,
      parcel_trips(
        id,
        title,
        origin,
        destination,
        going_date,
        booking_cutoff_at,
        pickup_areas,
        status
      )
    `)
    .eq('user_id', userId)
    .in('status', ['pending', 'accepted', 'picked_up', 'in_transit'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  return Promise.all(
    (data ?? []).map((row) =>
      mapRequest(
        {
          ...row,
          parcel_photo_path: null,
          parcel_tracking_events: [],
        },
        { includePhotoUrl: false },
      ),
    ),
  )
}

export async function fetchMyParcelRequests() {
  const userId = await getCurrentUserId()

  if (!userId) return []

  const { data, error } = await supabase
    .from('parcel_requests')
    .select('*, parcel_trips(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  const rows = data ?? []
  const eventsByRequestId = await fetchTrackingEventsByRequestIds(
    rows.map((row) => String(row.id)),
  )

  return Promise.all(
    rows.map((row) =>
      mapRequest({
        ...row,
        parcel_tracking_events: eventsByRequestId.get(String(row.id)) ?? [],
      }),
    ),
  )
}

export async function fetchAdminParcelTrips() {
  const { data, error } = await supabase
    .from('parcel_trips')
    .select('*, parcel_requests(id)')
    .order('going_date', { ascending: false })

  if (error) throw error

  return (data ?? []).map(mapTrip)
}

export async function createParcelTrip(input: CreateParcelTripInput) {
  const userId = await getUserId()

  const origin = text(input.origin) || 'Thimphu'
  const destination = text(input.destination) || 'Phuentsholing'
  const title = text(input.title) || `${origin} → ${destination}`

  const { data, error } = await supabase
    .from('parcel_trips')
    .insert({
      title,
      origin,
      destination,
      going_date: input.goingDate,
      return_date: null,
      booking_cutoff_at: input.bookingCutoffAt
        ? new Date(input.bookingCutoffAt).toISOString()
        : null,
      pickup_areas: [],
      status: input.status ?? 'open',
      created_by: userId,
    })
    .select('*')
    .single()

  if (error) throw error

  return mapTrip(data)
}

export async function updateParcelTripStatus(
  tripId: string,
  status: ParcelTripStatus,
) {
  const { data, error } = await supabase
    .from('parcel_trips')
    .update({ status })
    .eq('id', tripId)
    .select('*')
    .single()

  if (error) throw error

  return mapTrip(data)
}

export async function fetchAdminParcelRequests() {
  const { data, error } = await supabase
    .from('parcel_requests')
    .select('*, parcel_trips(*)')
    .order('created_at', { ascending: false })

  if (error) throw error

  return Promise.all((data ?? []).map((row) => mapRequest(row)))
}

export async function updateParcelRequestStatus(
  requestId: string,
  status: ParcelRequestStatus,
  adminNotes?: string,
) {
  const payload: Record<string, unknown> = {
    status,
  }

  if (adminNotes !== undefined) {
    payload.admin_notes = nullableText(adminNotes)
  }

  const { data, error } = await supabase
    .from('parcel_requests')
    .update(payload)
    .eq('id', requestId)
    .select('*, parcel_trips(*)')
    .single()

  if (error) throw error

  try {
    const { data: userData } = await supabase.auth.getUser()

    const { error: trackingError } = await supabase
      .from('parcel_tracking_events')
      .insert({
        parcel_request_id: requestId,
        status,
        title: parcelStatusTitle(status),
        message: parcelStatusMessage(status, adminNotes),
        location: null,
        visible_to_customer: true,
        created_by: userData.user?.id ?? null,
      })

    if (trackingError) {
      console.warn(
        '[updateParcelRequestStatus] Tracking event skipped:',
        trackingError,
      )
    }
  } catch (trackingError) {
    console.warn(
      '[updateParcelRequestStatus] Tracking event skipped:',
      trackingError,
    )
  }

  try {
    await createCustomerParcelStatusNotification({
      userId: String(data.user_id ?? ''),
      parcelRequestId: requestId,
      parcelNo: data.parcel_no ?? null,
      status,
      adminNotes,
      packageDescription: data.package_description ?? null,
    })

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('shop2bhutan:notifications-updated'))
      window.dispatchEvent(new CustomEvent('shop2bhutan:parcels-updated'))
    }
  } catch (notificationError) {
    console.warn(
      '[updateParcelRequestStatus] Customer parcel notification skipped:',
      notificationError,
    )
  }

  return mapRequest(data)
}

export async function fetchCustomerParcelBadgeSummary(userId?: string) {
  let activeCount = 0

  if (userId) {
    const { count, error } = await supabase
      .from('parcel_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['pending', 'accepted', 'picked_up', 'in_transit'])

    if (error) throw error

    activeCount = count ?? 0
  }

  const openTrips = await fetchOpenParcelTrips()
  const hasOpenTrip = openTrips.length > 0

  return {
    activeCount,
    hasOpenTrip,
    label:
      activeCount > 0
        ? activeCount > 99
          ? '99+'
          : String(activeCount)
        : hasOpenTrip
          ? 'New'
          : null,
  }
}

export async function fetchPendingParcelRequestCount() {
  const { count, error } = await supabase
    .from('parcel_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  if (error) throw error

  return count ?? 0
}
