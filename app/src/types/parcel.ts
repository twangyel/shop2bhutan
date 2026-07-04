export type ParcelRequestStatus =
  | 'pending'
  | 'picked_up'
  | 'collected'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'rejected'

export type ParcelTripStatus =
  | 'draft'
  | 'open'
  | 'closed'
  | 'completed'
  | 'cancelled'

export type ParcelType =
  | 'documents'
  | 'document'
  | 'small_electronics'
  | 'electronics'
  | 'medicine'
  | 'clothing'

export type ParcelSize =
  | 'document_envelope'
  | 'small_packet'
  | 'small_box'
  | 'small'
  | 'medium'

export type ParcelTrip = {
  id: string

  // New Supabase fields
  title?: string
  origin?: string | null
  destination?: string | null
  goingDate: string
  returnDate: string
  bookingCutoffAt?: string | null
  pickupAreas?: unknown[]
  status?: ParcelTripStatus
  createdBy?: string | null
  createdAt: string
  updatedAt?: string
  requestCount?: number

  // Old mock fields, kept temporarily until screens are patched
  name?: string
  fromLocation?: string
  toLocation?: string
  description?: string
  isActive?: boolean
}

export type ParcelTrackingEvent = {
  id: string
  parcelRequestId: string
  status: ParcelRequestStatus
  title: string
  message: string | null
  location: string | null
  visibleToCustomer: boolean
  createdBy: string | null
  createdAt: string
}

export type ParcelRequest = {
  id: string

  // New Supabase fields
  parcelNo?: string | null
  userId?: string
  tripId?: string | null
  trip: ParcelTrip
  status: ParcelRequestStatus

  senderName?: string
  senderPhone?: string
  pickupAddress?: string | null

  receiverName?: string
  receiverPhone?: string
  dropoffAddress?: string | null

  packageDescription?: string
  parcelType: ParcelType | null
  parcelSize: ParcelSize

  parcelPhotoPath?: string | null
  parcelPhotoUrl?: string | null

  estimatedFee?: number | null
  finalFee?: number | null

  customerNotes?: string | null
  adminNotes?: string | null

  declarationConfirmed?: boolean

  createdAt: string
  updatedAt?: string

  trackingEvents?: ParcelTrackingEvent[]

  // Old mock fields, kept temporarily until screens are patched
  description?: string
  contactNumber?: string
  weightKg?: number
  instructions?: string
}

export const parcelTypeLabels: Record<string, string> = {
  documents: 'Documents',
  document: 'Documents',
  small_electronics: 'Small Electronics',
  electronics: 'Small Electronics',
  medicine: 'Medicine / Health Items',
  clothing: 'Clothing',
}

export const parcelSizeLabels: Record<string, string> = {
  document_envelope: 'Document Envelope',
  small_packet: 'Small Packet',
  small_box: 'Small Box',
  small: 'Small',
  medium: 'Medium',
}

export const parcelStatusLabels: Record<string, string> = {
  pending: 'Request Submitted',
  picked_up: 'Picked Up',
  collected: 'Picked Up',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
}

export const parcelTripStatusLabels: Record<ParcelTripStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}