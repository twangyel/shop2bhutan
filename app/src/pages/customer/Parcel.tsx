import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Package,
  ChevronRight,
  Clock,
  Info,
} from 'lucide-react'
import {
  fetchMyActiveParcelRequestsPreview,
  fetchOpenParcelTrips,
} from '@/lib/parcels'
import type { ParcelRequest, ParcelTrip } from '@/types/parcel'
import { parcelStatusLabels } from '@/types/parcel'

function formatDate(value?: string | null) {
  if (!value) return 'Date not fixed'

  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
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

const activeParcelStatuses = new Set([
  'pending',
  'accepted',
  'picked_up',
  'collected',
  'in_transit',
])

function tripDisplayTitle(trip?: ParcelTrip | null) {
  const origin = trip?.origin || trip?.fromLocation || 'Thimphu'
  const destination = trip?.destination || trip?.toLocation || 'Phuentsholing'

  return `${origin} → ${destination}`
}

export default function Parcel() {
  const navigate = useNavigate()

  const [trips, setTrips] = useState<ParcelTrip[]>([])
  const [requests, setRequests] = useState<ParcelRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadParcelHome() {
    try {
      setLoading(true)
      setError('')

      const [tripRows, requestRows] = await Promise.all([
        fetchOpenParcelTrips(),
        fetchMyActiveParcelRequestsPreview(2).catch(() => []),
      ])

      setTrips(tripRows)
      setRequests(requestRows)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load parcel trips.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadParcelHome()
  }, [])

  const activeRequests = requests.filter((request) =>
    activeParcelStatuses.has(request.status),
  )

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-neutral-100 bg-white">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate('/')}
            className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-100"
          >
            <ArrowLeft size={22} />
          </button>

          <div>
            <h1 className="text-lg font-bold text-neutral-900">
              Parcel Pickup and Drop
            </h1>
            <p className="text-xs text-neutral-500">
              Thimphu to Phuentsholing and vice versa
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-4 py-4">
        {/* Info Banner */}
        <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
          <div className="mt-0.5 shrink-0 text-blue-500">
            <Info size={18} />
          </div>
          <p className="text-xs leading-relaxed text-blue-700">
            Book documents, small electronics, or permitted medicines for an admin-scheduled trip date. A parcel photo and declaration are required before submission.

          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Active Parcels */}
        {activeRequests.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-neutral-900">
                Active Parcels
              </h2>

              <button
                onClick={() => navigate('/my-parcels?view=active')}
                className="flex items-center gap-1 text-sm font-semibold text-orange-600"
              >
                View All
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="space-y-3">
              {activeRequests.slice(0, 2).map((request) => (
                <button
                  key={request.id}
                  onClick={() => navigate('/my-parcels?view=active')}
                  className="flex w-full items-center gap-3 rounded-3xl border border-neutral-100 bg-white p-4 text-left shadow-sm transition active:scale-[0.99]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <Package size={22} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-neutral-900">
                      {request.packageDescription ||
                        request.description ||
                        'Parcel request'}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {tripDisplayTitle(request.trip)}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass(
                      request.status,
                    )}`}
                  >
                    {parcelStatusLabels[request.status] || request.status}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Available Trips */}
        <section>
          <div className="mb-3">
            <h2 className="text-base font-bold text-neutral-900">
              Available Routes & Dates
            </h2>
            <p className="text-xs text-neutral-500">
              Select the correct route and date to book your parcel
            </p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((item) => (
                <div
                  key={item}
                  className="h-48 animate-pulse rounded-3xl bg-neutral-100"
                />
              ))}
            </div>
          ) : trips.length === 0 ? (
            <div className="flex flex-col items-center py-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-400">
                <Calendar size={32} />
              </div>

              <h3 className="mt-4 text-base font-bold text-neutral-900">
                No trips open yet
              </h3>

              <p className="mt-2 text-center text-sm leading-relaxed text-neutral-500">
                Booking opens once admin schedules a trip. Check back soon.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {trips.map((trip) => (
                <button
                  key={trip.id}
                  onClick={() => navigate(`/parcel-booking/${trip.id}`)}
                  className="w-full overflow-hidden rounded-3xl border border-neutral-100 bg-white text-left shadow-sm transition hover:border-orange-200 active:scale-[0.99]"
                >
                  {/* Card Header */}
                  <div className="p-4 pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-neutral-900">
                          {tripDisplayTitle(trip)}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {formatDate(trip.goingDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin size={12} />
                            Documents, small electronics, medicine only
                          </span>
                        </div>
                      </div>

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                        <ChevronRight size={18} />
                      </div>
                    </div>
                  </div>

                  {/* Route Visual */}
                  <div className="mt-4 px-4">
                    <div className="flex items-center gap-3 rounded-2xl bg-neutral-50 p-4">
                      <div className="flex flex-col items-center">
                        <span className="h-3 w-3 rounded-full bg-emerald-500" />
                        <span className="my-1 h-8 w-px bg-neutral-300" />
                        <span className="h-3 w-3 rounded-full bg-orange-500" />
                      </div>

                      <div className="flex-1 space-y-3">
                        <div>
                          <p className="text-[11px] font-semibold text-neutral-400">
                            Pickup
                          </p>
                          <p className="text-sm font-bold text-neutral-900">
                            {trip.origin || trip.fromLocation || 'Thimphu'}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] font-semibold text-neutral-400">
                            Drop-off
                          </p>
                          <p className="text-sm font-bold text-neutral-900">
                            {trip.destination ||
                              trip.toLocation ||
                              'Phuentsholing'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between border-t border-neutral-50 px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                      <Clock size={13} />
                      Admin fixed trip date
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                      Booking Open
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
