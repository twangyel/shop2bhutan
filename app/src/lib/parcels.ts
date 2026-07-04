import { supabase } from '@/lib/supabase'
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

function fallbackTrip(): ParcelTrip {
  return {
    id: '',
    title: 'Thimphu to Phuentsholing',
    name: 'Thimphu to Phuentsholing',
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

  const title = text(row.title) || 'Thimphu to Phuentsholing'
  const origin = text(row.origin) || 'Thimphu'
  const destination = text(row.destination) || 'Phuentsholing'

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

async function getUserId() {
  const { data, error } = await supabase.auth.getUser()

  if (error) throw error
  if (!data.user?.id) throw new Error('Please login to continue.')

  return data.user.id
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

async function mapRequest(row: Row): Promise<ParcelRequest> {
  const trip = mapTrip(row.parcel_trips)

  const photoPath = row.parcel_photo_path ?? null
  const photoUrl = await getSignedPhotoUrl(photoPath)

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

    trackingEvents: [],

    contactNumber: text(row.sender_phone),
    weightKg: 0,
    instructions: row.customer_notes ?? '',
  }
}

export async function fetchOpenParcelTrips() {
  const { data, error } = await supabase
    .from('parcel_trips')
    .select('*')
    .eq('status', 'open')
    .gte('going_date', todayDate())
    .order('going_date', { ascending: true })

  if (error) throw error

  return (data ?? []).map(mapTrip)
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

export async function createParcelRequest(input: CreateParcelRequestInput) {
  const userId = await getUserId()
  const photoPath = await uploadParcelPhoto(userId, input.parcelPhotoFile)

  const { data, error } = await supabase
    .from('parcel_requests')
    .insert({
      user_id: userId,
      trip_id: input.tripId,
      status: 'pending',

      sender_name: text(input.senderName),
      sender_phone: text(input.senderPhone),
      pickup_address: text(input.pickupAddress),

      receiver_name: text(input.receiverName),
      receiver_phone: text(input.receiverPhone),
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

  return mapRequest({
    ...data,
    parcel_trips: null,
  })
}

export async function fetchMyParcelRequests() {
  const userId = await getUserId()

  const { data, error } = await supabase
    .from('parcel_requests')
    .select('*, parcel_trips(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return Promise.all((data ?? []).map(mapRequest))
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

  const title =
    text(input.title) || `Thimphu to Phuentsholing - ${input.goingDate}`

  const { data, error } = await supabase
    .from('parcel_trips')
    .insert({
      title,
      origin: 'Thimphu',
      destination: 'Phuentsholing',
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

  return Promise.all((data ?? []).map(mapRequest))
}

export async function updateParcelRequestStatus(
  requestId: string,
  status: ParcelRequestStatus,
) {
  const { data, error } = await supabase
    .from('parcel_requests')
    .update({ status })
    .eq('id', requestId)
    .select('*, parcel_trips(*)')
    .single()

  if (error) throw error

  return mapRequest(data)
}