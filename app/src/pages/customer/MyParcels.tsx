import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, CheckCircle2, Package, Truck } from 'lucide-react'
import { fetchMyParcelRequests } from '@/lib/parcels'
import {
  parcelSizeLabels,
  parcelStatusLabels,
  parcelTypeLabels,
} from '@/types/parcel'
import type { ParcelRequest } from '@/types/parcel'

const timeline = [
  'pending',
  'accepted',
  'picked_up',
  'in_transit',
  'delivered',
] as const

function formatDate(value?: string | null) {
  if (!value) return 'Date not fixed'

  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value?: string | null) {
  if (!value) return ''

  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusClass(status: string) {
  if (status === 'pending') {
    return 'bg-amber-50 text-amber-700 border border-amber-100'
  }

  if (status === 'accepted') {
    return 'bg-orange-50 text-orange-700 border border-orange-200'
  }

  if (status === 'picked_up' || status === 'collected') {
    return 'bg-blue-50 text-blue-700 border border-blue-100'
  }

  if (status === 'in_transit') {
    return 'bg-purple-50 text-purple-700 border border-purple-100'
  }

  if (status === 'delivered') {
    return 'bg-emerald-50 text-emerald-700 border border-emerald-100'
  }

  if (status === 'rejected') {
    return 'bg-rose-50 text-rose-700 border border-rose-100'
  }

  if (status === 'cancelled') {
    return 'bg-neutral-100 text-neutral-600 border border-neutral-200'
  }

  return 'bg-neutral-100 text-neutral-600 border border-neutral-200'
}

function normalizeStatus(status: string) {
  if (status === 'collected') return 'picked_up'
  return status
}

const activeParcelStatuses = new Set([
  'pending',
  'accepted',
  'picked_up',
  'collected',
  'in_transit',
])

export default function MyParcels() {
  const navigate = useNavigate()

  const [requests, setRequests] = useState<ParcelRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadParcels() {
    try {
      setLoading(true)
      setError('')

      const rows = await fetchMyParcelRequests()
      setRequests(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load parcels.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadParcels()
  }, [])

  const activeRequests = requests.filter((request) =>
    activeParcelStatuses.has(request.status),
  )

  const historyRequests = requests.filter(
    (request) => !activeParcelStatuses.has(request.status),
  )

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
            <h1 className="text-lg font-bold text-neutral-900">My Parcels</h1>
            <p className="text-xs text-neutral-500">
              Track pickup and delivery status
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {error && (
          <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-56 animate-pulse rounded-3xl bg-neutral-100"
              />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-3xl border border-neutral-100 bg-neutral-50 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-neutral-400">
              <Package size={24} />
            </div>

            <h3 className="mt-3 text-sm font-bold text-neutral-800">
              No parcels yet
            </h3>

            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              Book a parcel once admin opens a Thimphu to Phuentsholing trip
              date.
            </p>

            <button
              onClick={() => navigate('/parcel')}
              className="mt-4 rounded-2xl bg-orange-500 px-4 py-2 text-sm font-bold text-white"
            >
              Book a Parcel
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {activeRequests.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-bold text-neutral-900">
                  Active Parcels
                </h2>

                <div className="space-y-4">
                  {activeRequests.map((request) => (
                    <ParcelCard key={request.id} request={request} />
                  ))}
                </div>
              </section>
            )}

            {historyRequests.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-bold text-neutral-900">
                  Parcel History
                </h2>

                <div className="space-y-4 opacity-95">
                  {historyRequests.map((request) => (
                    <ParcelCard key={request.id} request={request} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ParcelCard({ request }: { request: ParcelRequest }) {
  const displayStatus = normalizeStatus(request.status)
  const currentIndex = timeline.indexOf(
    displayStatus as (typeof timeline)[number],
  )
  const isException =
    request.status === 'cancelled' || request.status === 'rejected'

  const title =
    request.packageDescription || request.description || 'Parcel request'

  return (
    <article className="overflow-hidden rounded-3xl border border-neutral-100 bg-white shadow-sm">
      {request.parcelPhotoUrl && (
        <div className="bg-neutral-50 p-3 pb-0">
          <img
            src={request.parcelPhotoUrl}
            alt={title}
            className="h-36 w-full rounded-2xl border border-neutral-100 bg-neutral-100 object-cover"
          />

          <a
            href={request.parcelPhotoUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block text-center text-xs font-bold text-orange-600 hover:text-orange-700"
          >
            View photo
          </a>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-neutral-400">
              {request.parcelNo || 'Parcel Request'}
            </p>

            <h2 className="mt-1 text-base font-bold text-neutral-900">
              {title}
            </h2>
          </div>

          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass(
              request.status,
            )}`}
          >
            {parcelStatusLabels[request.status] || request.status}
          </span>
        </div>

        <div className="mt-3 space-y-2 rounded-2xl bg-neutral-50 p-3">
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <Calendar size={14} />
            <span>Trip: {formatDate(request.trip?.goingDate)}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <Truck size={14} />
            <span>
              {request.trip?.origin || request.trip?.fromLocation || 'Thimphu'}{' '}
              →{' '}
              {request.trip?.destination ||
                request.trip?.toLocation ||
                'Phuentsholing'}
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-neutral-100 p-3">
          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="h-12 w-px bg-neutral-200" />
              <span className="h-3 w-3 rounded-full bg-orange-500" />
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Pickup
                </p>
                <p className="text-sm font-semibold text-neutral-900">
                  {request.pickupAddress || 'Pickup address'}
                </p>
                <p className="text-xs text-neutral-500">
                  {request.senderName || 'Pickup contact'} ·{' '}
                  {request.senderPhone || request.contactNumber || 'Phone'}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Drop-off
                </p>
                <p className="text-sm font-semibold text-neutral-900">
                  {request.dropoffAddress || 'Drop-off address'}
                </p>
                <p className="text-xs text-neutral-500">
                  {request.receiverName || 'Receiver'} ·{' '}
                  {request.receiverPhone || 'Phone'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {request.parcelType && (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              {parcelTypeLabels[request.parcelType] || request.parcelType}
            </span>
          )}

          <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
            {parcelSizeLabels[request.parcelSize] || request.parcelSize}
          </span>
        </div>

        <div className="mt-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-400">
            Progress
          </p>

          {isException ? (
            <div
              className={`rounded-2xl px-3 py-2 text-sm font-semibold ${statusClass(
                request.status,
              )}`}
            >
              {parcelStatusLabels[request.status] || request.status}
            </div>
          ) : (
            <div className="space-y-3">
              {timeline.map((status, index) => {
                const done = currentIndex >= index
                const event = request.trackingEvents?.find(
                  (item) => normalizeStatus(item.status) === status,
                )

                return (
                  <div key={status} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full ${
                          done
                            ? 'bg-emerald-500 text-white'
                            : 'bg-neutral-100 text-neutral-400'
                        }`}
                      >
                        {done ? (
                          <CheckCircle2 size={16} />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-current" />
                        )}
                      </div>

                      {index < timeline.length - 1 && (
                        <div
                          className={`h-7 w-px ${
                            done ? 'bg-emerald-200' : 'bg-neutral-200'
                          }`}
                        />
                      )}
                    </div>

                    <div>
                      <p
                        className={`text-sm font-bold ${
                          done ? 'text-neutral-900' : 'text-neutral-400'
                        }`}
                      >
                        {parcelStatusLabels[status] || status}
                      </p>

                      {event && (
                        <p className="text-xs text-neutral-400">
                          {formatDateTime(event.createdAt)}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {request.adminNotes && (
          <div
            className={`mt-4 rounded-2xl p-3 text-xs ${
              request.status === 'rejected'
                ? 'bg-red-50 text-red-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            <p className="font-bold">
              {request.status === 'rejected'
                ? 'Rejection Reason'
                : 'Admin Note'}
            </p>
            <p className="mt-1 leading-relaxed">{request.adminNotes}</p>
          </div>
        )}

        {(request.customerNotes || request.instructions) && (
          <p className="mt-3 rounded-2xl bg-neutral-50 p-3 text-xs text-neutral-600">
            Your note: {request.customerNotes || request.instructions}
          </p>
        )}
      </div>
    </article>
  )
}
