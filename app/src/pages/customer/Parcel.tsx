import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  MapPin,
  Package,
  Truck,
} from 'lucide-react'
import { fetchMyParcelRequests, fetchOpenParcelTrips } from '@/lib/parcels'
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
        fetchMyParcelRequests().catch(() => []),
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
      <div className="sticky top-0 z-10 border-b border-neutral-100 bg-white/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate('/')}
            className="-ml-1 rounded-full p-1 hover:bg-neutral-100"
          >
            <ArrowLeft size={22} />
          </button>

          <div>
            <h1 className="text-lg font-bold text-neutral-900">
              Parcel Pickup
            </h1>
            <p className="text-xs text-neutral-500">
              Thimphu to Phuentsholing delivery
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-4 py-4">
        <div className="rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-blue-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-sm">
              <Truck size={22} />
            </div>

            <div className="flex-1">
              <p className="text-sm font-bold text-neutral-900">
                Scheduled lightweight parcel delivery
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                Book documents, small electronics, or medicine for an
                admin-fixed trip date. Parcel photo and declaration are
                required.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {activeRequests.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold text-neutral-900">
                Active Parcels
              </h2>

              <button
                onClick={() => navigate('/my-parcels')}
                className="text-xs font-semibold text-orange-600"
              >
                View All
              </button>
            </div>

            <div className="space-y-2">
              {activeRequests.slice(0, 2).map((request) => (
                <button
                  key={request.id}
                  onClick={() => navigate('/my-parcels')}
                  className="flex w-full items-center gap-3 rounded-2xl border border-neutral-100 bg-white p-3 text-left shadow-sm transition active:scale-[0.99]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <Package size={20} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {request.packageDescription ||
                        request.description ||
                        'Parcel request'}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {tripDisplayTitle(request.trip)}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-bold ${statusClass(
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

        <section>
          <div className="mb-3">
            <h2 className="text-sm font-bold text-neutral-900">
              Available Trip Dates
            </h2>
            <p className="text-xs text-neutral-500">
              Select the date fixed by admin.
            </p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((item) => (
                <div
                  key={item}
                  className="h-32 animate-pulse rounded-3xl bg-neutral-100"
                />
              ))}
            </div>
          ) : trips.length === 0 ? (
            <div className="rounded-3xl border border-neutral-100 bg-neutral-50 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-neutral-400">
                <Calendar size={24} />
              </div>

              <h3 className="mt-3 text-sm font-bold text-neutral-800">
                No parcel trips available
              </h3>

              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                Trip dates will appear here once admin opens booking.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {trips.map((trip) => (
                <button
                  key={trip.id}
                  onClick={() => navigate(`/parcel-booking/${trip.id}`)}
                  className="w-full rounded-3xl border border-neutral-100 bg-white p-4 text-left shadow-sm transition hover:border-orange-200 active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-neutral-900">
                        {tripDisplayTitle(trip)}
                      </h3>
                      <p className="mt-1 text-xs text-neutral-500">
                        Admin fixed trip date
                      </p>
                    </div>

                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                      <ArrowRight size={18} />
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl bg-neutral-50 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center">
                        <span className="h-3 w-3 rounded-full bg-emerald-500" />
                        <span className="h-8 w-px bg-neutral-300" />
                        <span className="h-3 w-3 rounded-full bg-orange-500" />
                      </div>

                      <div className="flex-1 space-y-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                            Pickup
                          </p>
                          <p className="text-sm font-semibold text-neutral-900">
                            {trip.origin || trip.fromLocation || 'Thimphu'}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                            Drop-off
                          </p>
                          <p className="text-sm font-semibold text-neutral-900">
                            {trip.destination ||
                              trip.toLocation ||
                              'Phuentsholing'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs text-neutral-600">
                    <Calendar size={14} />
                    <span>{formatDate(trip.goingDate)}</span>
                  </div>

                  <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                    <MapPin size={14} />
                    <span>Documents, small electronics, medicine only</span>
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
