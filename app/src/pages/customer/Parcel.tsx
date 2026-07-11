import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
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
import { supabase } from '@/lib/supabase'

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

  const loadParcelHome = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent)

    try {
      if (!silent) setLoading(true)
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
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadParcelHome()
  }, [loadParcelHome])

  useEffect(() => {
    let active = true
    const timers: number[] = []

    const refreshSoon = (delay = 0) => {
      const timer = window.setTimeout(() => {
        if (active) void loadParcelHome({ silent: true })
      }, delay)

      timers.push(timer)
    }

    const handleRealtimeRefresh = () => {
      refreshSoon(0)
      refreshSoon(700)
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) handleRealtimeRefresh()
    }

    window.addEventListener('shop2bhutan:parcel-trips-updated', handleRealtimeRefresh)
    window.addEventListener('shop2bhutan:parcels-updated', handleRealtimeRefresh)
    window.addEventListener('focus', handleRealtimeRefresh)
    window.addEventListener('pageshow', handleRealtimeRefresh)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const channel = supabase
      .channel('customer-parcel-home-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parcel_trips' },
        handleRealtimeRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parcel_requests' },
        handleRealtimeRefresh,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refreshSoon(0)
      })

    return () => {
      active = false
      timers.forEach((timer) => window.clearTimeout(timer))
      window.removeEventListener('shop2bhutan:parcel-trips-updated', handleRealtimeRefresh)
      window.removeEventListener('shop2bhutan:parcels-updated', handleRealtimeRefresh)
      window.removeEventListener('focus', handleRealtimeRefresh)
      window.removeEventListener('pageshow', handleRealtimeRefresh)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      void supabase.removeChannel(channel)
    }
  }, [loadParcelHome])

  const activeRequests = requests.filter((request) =>
    activeParcelStatuses.has(request.status),
  )

  return (
    <div className="min-h-screen bg-neutral-50 pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-neutral-100 bg-white/95 backdrop-blur">
        <div className="px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-orange-500">
            Parcel service
          </p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight text-neutral-950">
                Parcel Pickup & Drop
              </h1>
              <p className="mt-0.5 text-xs font-medium text-neutral-500">
                Thimphu ↔ Phuentsholing
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-orange-50 px-3 py-1.5 text-[11px] font-bold text-orange-700 ring-1 ring-orange-100">
              Scheduled trips
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-4 py-4">
        {/* Info Banner */}
        <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
          <Info size={17} className="mt-0.5 shrink-0 text-blue-500" />
          <p className="text-[12px] leading-[1.6] text-blue-800">
            <span className="font-extrabold text-blue-950">Lightweight items only.</span> Documents, small electronics, or permitted medicines. Photo and declaration required.
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
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-orange-500">Tracking</p>
                <h2 className="mt-1 text-lg font-extrabold tracking-tight text-neutral-950">
                  Active parcels
                </h2>
              </div>

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
                  className="flex w-full items-center gap-3 rounded-2xl border border-neutral-100 bg-white p-3.5 text-left shadow-sm transition active:scale-[0.99]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                    <Package size={20} />
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-orange-500">Book a parcel</p>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight text-neutral-950">
              Available trips
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Select the route and scheduled date that works for you.
            </p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((item) => (
                <div
                  key={item}
                  className="h-48 animate-pulse rounded-2xl bg-neutral-200"
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
                  className="w-full overflow-hidden rounded-2xl border border-neutral-100 bg-white text-left shadow-sm shadow-slate-100 transition hover:border-orange-200 active:scale-[0.99]"
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
                            Documents, electronics, permitted medicine
                          </span>
                        </div>
                      </div>

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                        <ChevronRight size={18} />
                      </div>
                    </div>
                  </div>

                  {/* Route Visual */}
                  <div className="mt-3 px-4">
                    <div className="flex items-center gap-3 rounded-2xl bg-neutral-50 p-3.5 ring-1 ring-neutral-100">
                      <div className="flex flex-col items-center">
                        <span className="h-3 w-3 rounded-full bg-emerald-500" />
                        <span className="my-1 h-8 w-px bg-neutral-300" />
                        <span className="h-3 w-3 rounded-full bg-orange-500" />
                      </div>

                      <div className="flex-1 space-y-3">
                        <div>
                          <p className="text-[11px] font-semibold text-emerald-600">
                            From
                          </p>
                          <p className="text-sm font-bold text-neutral-900">
                            {trip.origin || trip.fromLocation || 'Thimphu'}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] font-semibold text-orange-500">
                            To
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
                      Scheduled trip date
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
