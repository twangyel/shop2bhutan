import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Camera,
  Clock,
  CheckCircle2,
  MapPin,
  Package,
  ShieldCheck,
  User,
  Phone,
  Home,
  MapPinned,
  FileText,
  Smartphone,
  Pill,
  Box,
  Upload,
} from 'lucide-react'
import {
  createParcelRequest,
  fetchParcelTripById,
  getParcelTripBookingClosedMessage,
  isParcelTripBookable,
} from '@/lib/parcels'
import type { ParcelSize, ParcelTrip, ParcelType } from '@/types/parcel'

const allowedParcelTypes: { key: ParcelType; label: string }[] = [
  { key: 'documents', label: 'Documents' },
  { key: 'small_electronics', label: 'Small Electronics' },
  { key: 'medicine', label: 'Medicine / Health Items' },
]

const allowedParcelSizes: { key: ParcelSize; label: string }[] = [
  { key: 'document_envelope', label: 'Document Envelope' },
  { key: 'small_packet', label: 'Small Packet' },
  { key: 'small_box', label: 'Small Box' },
]

const parcelTypeIcons: Record<string, React.ElementType> = {
  documents: FileText,
  small_electronics: Smartphone,
  medicine: Pill,
}

const parcelSizeIcons: Record<string, React.ElementType> = {
  document_envelope: FileText,
  small_packet: Package,
  small_box: Box,
}

function formatDate(value?: string | null) {
  if (!value) return 'Date not fixed'

  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value?: string | null) {
  if (!value) return 'No cutoff set'

  return `${new Date(value).toLocaleString('en-GB', {
    timeZone: 'Asia/Thimphu',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })} BTT`
}

function tripDisplayTitle(trip?: ParcelTrip | null) {
  const origin = trip?.origin || trip?.fromLocation || 'Thimphu'
  const destination = trip?.destination || trip?.toLocation || 'Phuentsholing'

  return `${origin} → ${destination}`
}

export default function ParcelBooking() {
  const { tripId } = useParams<{ tripId: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading, isGuest } = useAuth()

  const [trip, setTrip] = useState<ParcelTrip | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  const [form, setForm] = useState({
    senderName: '',
    senderPhone: '',
    pickupAddress: '',
    receiverName: '',
    receiverPhone: '',
    dropoffAddress: '',
    parcelType: '' as ParcelType | '',
    parcelSize: 'small_packet' as ParcelSize,
    packageDescription: '',
    customerNotes: '',
    declarationConfirmed: false,
  })

  useEffect(() => {
    let alive = true

    async function loadTrip() {
      if (!tripId) {
        setError('Trip not found.')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')

        const row = await fetchParcelTripById(tripId)

        if (!alive) return

        if (!row) {
          setError('Trip not found or booking is not available.')
        } else {
          setTrip(row)
        }
      } catch (err) {
        if (!alive) return
        setError(err instanceof Error ? err.message : 'Failed to load trip.')
      } finally {
        if (alive) setLoading(false)
      }
    }

    loadTrip()

    return () => {
      alive = false
    }
  }, [tripId])

  const bookingClosed = trip ? !isParcelTripBookable(trip) : false
  const bookingClosedReason = trip
    ? getParcelTripBookingClosedMessage(trip)
    : 'Booking is not available for this trip.'
  const willBookAsGuest = !authLoading && (!user || isGuest)

  function update(field: keyof typeof form, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  function validate() {
    const nextErrors: Record<string, string> = {}

    if (bookingClosed) {
      setError(bookingClosedReason)
      return false
    }

    if (!form.senderName.trim()) nextErrors.senderName = 'Required'
    if (!form.senderPhone.trim()) nextErrors.senderPhone = 'Required'
    if (!form.pickupAddress.trim()) nextErrors.pickupAddress = 'Required'

    if (!form.receiverName.trim()) nextErrors.receiverName = 'Required'
    if (!form.receiverPhone.trim()) nextErrors.receiverPhone = 'Required'
    if (!form.dropoffAddress.trim()) nextErrors.dropoffAddress = 'Required'

    if (!form.parcelType) nextErrors.parcelType = 'Required'
    if (!form.parcelSize) nextErrors.parcelSize = 'Required'

    if (form.packageDescription.trim().length < 3) {
      nextErrors.packageDescription = 'Add a clear parcel description'
    }

    if (!photoFile) {
      nextErrors.photoFile = 'Parcel photo is required'
    }

    if (!form.declarationConfirmed) {
      nextErrors.declarationConfirmed = 'Please confirm the declaration'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    if (!trip || bookingClosed) {
      setError(bookingClosedReason)
      return
    }

    if (!tripId || !validate() || !photoFile || !form.parcelType) return

    try {
      setSubmitting(true)
      setError('')

      await createParcelRequest({
        tripId,
        senderName: form.senderName,
        senderPhone: form.senderPhone,
        pickupAddress: form.pickupAddress,
        receiverName: form.receiverName,
        receiverPhone: form.receiverPhone,
        dropoffAddress: form.dropoffAddress,
        packageDescription: form.packageDescription,
        parcelType: form.parcelType,
        parcelSize: form.parcelSize,
        parcelPhotoFile: photoFile,
        customerNotes: form.customerNotes,
      })

      setSubmitted(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to submit parcel request.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white px-4 py-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-neutral-100" />
        <div className="mt-5 h-36 animate-pulse rounded-3xl bg-neutral-100" />
        <div className="mt-4 h-96 animate-pulse rounded-3xl bg-neutral-100" />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4 py-8">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={34} />
          </div>

          <h1 className="mt-5 text-xl font-bold text-neutral-900">
            Parcel Request Submitted
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-neutral-500">
            Your parcel request for{' '}
            <span className="font-semibold">
              {tripDisplayTitle(trip)}
            </span>{' '}
            has been submitted. Admin will update the status once picked up.
          </p>

          {willBookAsGuest && (
            <p className="mt-3 rounded-2xl bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-700">
              Guest parcel saved on this device. Do not clear browser/app data if you want to track it later.
            </p>
          )}

          <button
            onClick={() => navigate('/my-parcels')}
            className="mt-6 h-12 w-full rounded-2xl bg-orange-500 font-bold text-white transition active:scale-[0.98]"
          >
            View My Parcels
          </button>

          <button
            onClick={() => navigate('/parcel')}
            className="mt-2 h-11 w-full rounded-2xl text-sm font-semibold text-neutral-500"
          >
            Back to Parcel
          </button>
        </div>
      </div>
    )
  }

  if (error && !trip) {
    return (
      <div className="min-h-screen bg-white px-4 py-6">
        <button
          onClick={() => navigate(-1)}
          className="-ml-1 rounded-full p-1 hover:bg-neutral-100"
        >
          <ArrowLeft size={22} />
        </button>

        <div className="mt-10 rounded-3xl border border-red-100 bg-red-50 p-4 text-center">
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-neutral-100 bg-white">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-100"
          >
            <ArrowLeft size={22} />
          </button>

          <div>
            <h1 className="text-lg font-bold text-neutral-900">Book Parcel</h1>
            <p className="text-xs text-neutral-500">Pickup and drop-off details</p>
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">
            <CheckCircle2 size={14} />
          </div>
          <div className="h-0.5 flex-1 bg-emerald-500" />
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-white text-xs font-bold">
            2
          </div>
          <div className="h-0.5 flex-1 bg-neutral-200" />
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-neutral-400 text-xs font-bold">
            3
          </div>
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] font-medium text-neutral-400">
          <span className="text-emerald-600">Trip</span>
          <span className="text-orange-600">Details</span>
          <span>Confirm</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 px-4 py-4 pb-28">
        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {willBookAsGuest && !submitted && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-700">
            Guest booking is available. We will save this parcel request on this device so you can track it from <b>My Parcels</b>.
          </div>
        )}

        {/* Trip Route Card */}
        {trip && (
          <div className="overflow-hidden rounded-3xl border border-neutral-100 bg-white">
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white">
                  <Package size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-neutral-900">{tripDisplayTitle(trip)}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {formatDate(trip.goingDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatDateTime(trip.bookingCutoffAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Route Visual */}
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-neutral-50 p-3">
                <div className="flex flex-col items-center py-1">
                  <span className="h-3 w-3 rounded-full bg-emerald-500" />
                  <span className="my-1 h-6 w-px bg-neutral-300" />
                  <span className="h-3 w-3 rounded-full bg-orange-500" />
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="text-[11px] font-semibold text-neutral-400">Pickup</p>
                    <p className="text-sm font-bold text-neutral-900">{trip.origin || trip.fromLocation || 'Thimphu'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-neutral-400">Drop-off</p>
                    <p className="text-sm font-bold text-neutral-900">{trip.destination || trip.toLocation || 'Phuentsholing'}</p>
                  </div>
                </div>
              </div>

              {bookingClosed && (
                <div className="mt-3 flex gap-2 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs leading-relaxed text-amber-700">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>{bookingClosedReason}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pickup Section */}
        <div className="rounded-3xl border border-neutral-100 bg-white p-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <MapPin size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-neutral-900">Pickup in Thimphu</p>
              <p className="text-[11px] text-neutral-400">Sender details</p>
            </div>
          </div>

          <div className="space-y-3">
            <IconField
              icon={User}
              label="Pickup Contact Name"
              value={form.senderName}
              error={errors.senderName}
              onChange={(value) => update('senderName', value)}
              placeholder="Sender / pickup person"
            />
            <IconField
              icon={Phone}
              label="Pickup Contact Phone"
              value={form.senderPhone}
              error={errors.senderPhone}
              onChange={(value) => update('senderPhone', value)}
              placeholder="+975 XXXXXXXX"
              type="tel"
            />
            <IconTextArea
              icon={Home}
              label="Pickup Address"
              value={form.pickupAddress}
              error={errors.pickupAddress}
              onChange={(value) => update('pickupAddress', value)}
              placeholder="Exact pickup address in Thimphu"
            />
          </div>
        </div>

        {/* Drop-off Section */}
        <div className="rounded-3xl border border-neutral-100 bg-white p-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <MapPinned size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-neutral-900">Drop-off in Phuentsholing</p>
              <p className="text-[11px] text-neutral-400">Receiver details</p>
            </div>
          </div>

          <div className="space-y-3">
            <IconField
              icon={User}
              label="Receiver Name"
              value={form.receiverName}
              error={errors.receiverName}
              onChange={(value) => update('receiverName', value)}
              placeholder="Receiver name"
            />
            <IconField
              icon={Phone}
              label="Receiver Phone"
              value={form.receiverPhone}
              error={errors.receiverPhone}
              onChange={(value) => update('receiverPhone', value)}
              placeholder="+975 XXXXXXXX"
              type="tel"
            />
            <IconTextArea
              icon={Home}
              label="Drop-off Address"
              value={form.dropoffAddress}
              error={errors.dropoffAddress}
              onChange={(value) => update('dropoffAddress', value)}
              placeholder="Exact drop-off address in Phuentsholing"
            />
          </div>
        </div>

        {/* Parcel Details Section */}
        <div className="rounded-3xl border border-neutral-100 bg-white p-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Package size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-neutral-900">Parcel Details</p>
              <p className="text-[11px] text-neutral-400">Only lightweight items accepted</p>
            </div>
          </div>

          {/* Parcel Type */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-semibold text-neutral-700">
              Parcel Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {allowedParcelTypes.map((item) => {
                const Icon = parcelTypeIcons[item.key] || Package
                const isSelected = form.parcelType === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => update('parcelType', item.key)}
                    className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition ${
                      isSelected
                        ? 'border-orange-400 bg-orange-50'
                        : 'border-neutral-200 bg-white hover:border-neutral-300'
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      isSelected ? 'bg-orange-500 text-white' : 'bg-neutral-100 text-neutral-400'
                    }`}>
                      <Icon size={20} />
                    </div>
                    <p className={`text-xs font-bold leading-tight ${
                      isSelected ? 'text-orange-700' : 'text-neutral-700'
                    }`}>
                      {item.label}
                    </p>
                  </button>
                )
              })}
            </div>
            {errors.parcelType && (
              <p className="mt-1.5 text-xs text-red-500">{errors.parcelType}</p>
            )}
          </div>

          {/* Parcel Size */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-semibold text-neutral-700">
              Parcel Size
            </label>
            <div className="grid grid-cols-3 gap-2">
              {allowedParcelSizes.map((item) => {
                const Icon = parcelSizeIcons[item.key] || Package
                const isSelected = form.parcelSize === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => update('parcelSize', item.key)}
                    className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition ${
                      isSelected
                        ? 'border-orange-400 bg-orange-50'
                        : 'border-neutral-200 bg-white hover:border-neutral-300'
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      isSelected ? 'bg-orange-500 text-white' : 'bg-neutral-100 text-neutral-400'
                    }`}>
                      <Icon size={20} />
                    </div>
                    <p className={`text-xs font-bold leading-tight ${
                      isSelected ? 'text-orange-700' : 'text-neutral-700'
                    }`}>
                      {item.label}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Description */}
          <IconTextArea
            icon={FileText}
            label="Parcel Description"
            value={form.packageDescription}
            error={errors.packageDescription}
            onChange={(value) => update('packageDescription', value)}
            placeholder="Example: A4 documents in envelope, sealed medicine packet, earbuds box"
          />

          {/* Photo Upload */}
          <div className="mt-4">
            <label className="mb-2 block text-sm font-semibold text-neutral-700">
              Parcel Photo
            </label>
            <label
              className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-5 text-center transition ${
                errors.photoFile
                  ? 'border-red-300 bg-red-50'
                  : photoFile
                    ? 'border-orange-300 bg-orange-50'
                    : 'border-neutral-200 bg-neutral-50 hover:border-orange-300'
              }`}
            >
              {photoFile ? (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-white">
                    <Camera size={24} />
                  </div>
                  <p className="mt-2 text-sm font-bold text-neutral-900">{photoFile.name}</p>
                  <p className="mt-1 text-xs text-neutral-400">Tap to change photo</p>
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
                    <Upload size={24} />
                  </div>
                  <p className="mt-2 text-sm font-bold text-neutral-700">Upload clear parcel photo</p>
                  <p className="mt-1 text-xs text-neutral-400">Required. Image should be below 5 MB.</p>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  setPhotoFile(file)
                  setErrors((prev) => ({ ...prev, photoFile: '' }))
                }}
              />
            </label>
            {errors.photoFile && (
              <p className="mt-1.5 text-xs text-red-500">{errors.photoFile}</p>
            )}
          </div>

          {/* Special Note */}
          <div className="mt-4">
            <IconTextArea
              icon={FileText}
              label="Special Note"
              value={form.customerNotes}
              onChange={(value) => update('customerNotes', value)}
              placeholder="Optional pickup/drop-off note"
            />
          </div>
        </div>

        {/* Declaration */}
        <div
          className={`rounded-3xl border p-4 ${
            errors.declarationConfirmed
              ? 'border-red-200 bg-red-50'
              : 'border-blue-100 bg-blue-50'
          }`}
        >
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={form.declarationConfirmed}
              onChange={(event) =>
                update('declarationConfirmed', event.target.checked)
              }
              className="mt-1 h-4 w-4 rounded border-neutral-300 text-orange-500 focus:ring-orange-500"
            />

            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-blue-600" />
                <p className="text-sm font-bold text-neutral-900">Parcel Declaration</p>
              </div>

              <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                I confirm this parcel contains only allowed lightweight items
                and does not contain cash, jewellery, alcohol, tobacco,
                weapons, flammable items, illegal goods, perishable food, or
                heavy parcels.
              </p>
            </div>
          </label>

          {errors.declarationConfirmed && (
            <p className="mt-2 text-xs text-red-500">
              {errors.declarationConfirmed}
            </p>
          )}
        </div>
      </form>

      {/* Sticky Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-neutral-100 bg-white p-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || bookingClosed}
          className="h-12 w-full rounded-2xl bg-orange-500 font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
        >
          {bookingClosed
            ? 'Booking Closed'
            : submitting
              ? 'Submitting...'
              : 'Confirm Parcel Request'}
        </button>
      </div>
    </div>
  )
}

function IconField({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  error,
  type = 'text',
}: {
  icon: React.ElementType
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
  type?: string
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-neutral-700">
        {label}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
          <Icon size={18} />
        </div>
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`h-12 w-full rounded-2xl border bg-white pl-10 pr-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 ${
            error ? 'border-red-400' : 'border-neutral-200'
          }`}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function IconTextArea({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  icon: React.ElementType
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-neutral-700">
        {label}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-3 text-neutral-400">
          <Icon size={18} />
        </div>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`h-24 w-full resize-none rounded-2xl border bg-white pl-10 pr-3 pt-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 ${
            error ? 'border-red-400' : 'border-neutral-200'
          }`}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
