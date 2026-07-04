import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Camera,
  CheckCircle2,
  MapPin,
  Package,
  ShieldCheck,
} from 'lucide-react'
import {
  createParcelRequest,
  fetchParcelTripById,
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

function formatDate(value?: string | null) {
  if (!value) return 'Date not fixed'

  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function ParcelBooking() {
  const { tripId } = useParams<{ tripId: string }>()
  const navigate = useNavigate()

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

  function update(field: keyof typeof form, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  function validate() {
    const nextErrors: Record<string, string> = {}

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
              {trip?.title || trip?.name || 'this trip'}
            </span>{' '}
            has been submitted. Admin will update the status once picked up.
          </p>

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
    <div className="min-h-screen bg-white pb-24">
      <div className="sticky top-0 z-10 border-b border-neutral-100 bg-white/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="-ml-1 rounded-full p-1 hover:bg-neutral-100"
          >
            <ArrowLeft size={22} />
          </button>

          <div>
            <h1 className="text-lg font-bold text-neutral-900">
              Book Parcel
            </h1>
            <p className="text-xs text-neutral-500">
              Pickup and drop-off details
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4">
        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {trip && (
          <div className="rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-blue-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500 text-white">
                <Package size={22} />
              </div>

              <div className="flex-1">
                <h2 className="font-bold text-neutral-900">
                  {trip.title || trip.name || 'Thimphu to Phuentsholing'}
                </h2>

                <div className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
                  <Calendar size={14} />
                  <span>{formatDate(trip.goingDate)}</span>
                </div>

                <div className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
                  <MapPin size={14} />
                  <span>
                    {trip.origin || trip.fromLocation || 'Thimphu'} →{' '}
                    {trip.destination || trip.toLocation || 'Phuentsholing'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-neutral-100 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center pt-2">
              <span className="h-4 w-4 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
              <span className="h-28 w-px bg-neutral-200" />
              <span className="h-4 w-4 rounded-full bg-orange-500 ring-4 ring-orange-50" />
            </div>

            <div className="flex-1 space-y-5">
              <section>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                  Pickup in Thimphu
                </p>

                <div className="mt-3 space-y-3">
                  <Field
                    label="Pickup Contact Name"
                    value={form.senderName}
                    error={errors.senderName}
                    onChange={(value) => update('senderName', value)}
                    placeholder="Sender / pickup person"
                  />

                  <Field
                    label="Pickup Contact Phone"
                    value={form.senderPhone}
                    error={errors.senderPhone}
                    onChange={(value) => update('senderPhone', value)}
                    placeholder="+975 XXXXXXXX"
                    type="tel"
                  />

                  <TextAreaField
                    label="Pickup Address"
                    value={form.pickupAddress}
                    error={errors.pickupAddress}
                    onChange={(value) => update('pickupAddress', value)}
                    placeholder="Exact pickup address in Thimphu"
                  />
                </div>
              </section>

              <section>
                <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600">
                  Drop-off in Phuentsholing
                </p>

                <div className="mt-3 space-y-3">
                  <Field
                    label="Receiver Name"
                    value={form.receiverName}
                    error={errors.receiverName}
                    onChange={(value) => update('receiverName', value)}
                    placeholder="Receiver name"
                  />

                  <Field
                    label="Receiver Phone"
                    value={form.receiverPhone}
                    error={errors.receiverPhone}
                    onChange={(value) => update('receiverPhone', value)}
                    placeholder="+975 XXXXXXXX"
                    type="tel"
                  />

                  <TextAreaField
                    label="Drop-off Address"
                    value={form.dropoffAddress}
                    error={errors.dropoffAddress}
                    onChange={(value) => update('dropoffAddress', value)}
                    placeholder="Exact drop-off address in Phuentsholing"
                  />
                </div>
              </section>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-neutral-100 bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-sm font-bold text-neutral-900">
              Parcel Details
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Only lightweight documents, small electronics, and medicine are
              accepted.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              Parcel Type
            </label>

            <div className="mt-2 grid grid-cols-1 gap-2">
              {allowedParcelTypes.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => update('parcelType', item.key)}
                  className={`rounded-2xl border p-3 text-left transition ${
                    form.parcelType === item.key
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-neutral-200 bg-white'
                  }`}
                >
                  <p className="text-sm font-bold text-neutral-900">
                    {item.label}
                  </p>
                </button>
              ))}
            </div>

            {errors.parcelType && (
              <p className="mt-1 text-xs text-red-500">
                {errors.parcelType}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              Parcel Size
            </label>

            <div className="mt-2 grid grid-cols-3 gap-2">
              {allowedParcelSizes.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => update('parcelSize', item.key)}
                  className={`rounded-2xl border p-2 text-center transition ${
                    form.parcelSize === item.key
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-neutral-200 bg-white'
                  }`}
                >
                  <p className="text-xs font-bold text-neutral-900">
                    {item.label}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <TextAreaField
            label="Parcel Description"
            value={form.packageDescription}
            error={errors.packageDescription}
            onChange={(value) => update('packageDescription', value)}
            placeholder="Example: A4 documents in envelope, sealed medicine packet, earbuds box"
          />

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              Parcel Photo
            </label>

            <label
              className={`mt-2 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-4 text-center transition ${
                errors.photoFile
                  ? 'border-red-300 bg-red-50'
                  : 'border-neutral-200 bg-neutral-50 hover:border-orange-300'
              }`}
            >
              <Camera size={24} className="text-neutral-400" />

              <p className="mt-2 text-sm font-semibold text-neutral-700">
                {photoFile ? photoFile.name : 'Upload clear parcel photo'}
              </p>

              <p className="mt-1 text-xs text-neutral-400">
                Required. Image should be below 5 MB.
              </p>

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
              <p className="mt-1 text-xs text-red-500">
                {errors.photoFile}
              </p>
            )}
          </div>

          <TextAreaField
            label="Special Note"
            value={form.customerNotes}
            onChange={(value) => update('customerNotes', value)}
            placeholder="Optional pickup/drop-off note"
          />
        </div>

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
                <p className="text-sm font-bold text-neutral-900">
                  Parcel Declaration
                </p>
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

        <button
          type="submit"
          disabled={submitting}
          className="h-12 w-full rounded-2xl bg-orange-500 font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
        >
          {submitting ? 'Submitting...' : 'Confirm Parcel Request'}
        </button>
      </form>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  error,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
  type?: string
}) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`mt-1.5 h-11 w-full rounded-2xl border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20 ${
          error ? 'border-red-400' : 'border-neutral-200'
        }`}
      />

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
}) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
        {label}
      </label>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`mt-1.5 h-20 w-full resize-none rounded-2xl border bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20 ${
          error ? 'border-red-400' : 'border-neutral-200'
        }`}
      />

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}