import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  Package,
  ChevronRight,
  Info,
} from 'lucide-react'
import {
  fetchMyActiveParcelRequestsPreview,
  fetchOpenParcelTrips,
} from '@/lib/parcels'
import type { ParcelRequest, ParcelTrip } from '@/types/parcel'
import { parcelStatusLabels } from '@/types/parcel'
import { supabase } from '@/lib/supabase'

function parseDate(value?: string | null) {
  if (!value) return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value?: string | null) {
  const date = parseDate(value)
  if (!date) return 'Date not fixed'

  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatCutoff(value?: string | null) {
  if (!value) return 'No cutoff set'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No cutoff set'

  return `${date.toLocaleString('en-GB', {
    timeZone: 'Asia/Thimphu',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })} BTT`
}

function tripDateParts(value?: string | null) {
  const date = parseDate(value)

  if (!date) {
    return { weekday: 'Trip', day: '--', month: 'Date' }
  }

  return {
    weekday: date.toLocaleDateString('en-GB', { weekday: 'short' }),
    day: date.toLocaleDateString('en-GB', { day: '2-digit' }),
    month: date.toLocaleDateString('en-GB', { month: 'short' }),
  }
}

function statusClass(status: string) {
  if (status === 'pending') {
    return 'bg-amber-50 text-amber-700 border border-amber-100'
  }

  if (status === 'accepted') {
    return 'bg-orange-50 text-orange-700 border border-orange-200'
  }

  if (status === 'pickup_scheduled') {
    return 'bg-blue-50 text-blue-700 border border-blue-100'
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
  'pickup_scheduled',
  'picked_up',
  'collected',
  'in_transit',
])

function tripDisplayTitle(trip?: ParcelTrip | null) {
  const origin = trip?.origin || trip?.fromLocation || 'Pickup location'
  const destination = trip?.destination || trip?.toLocation || 'Drop-off location'

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
                Routes across Bhutan
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
            <span className="font-extrabold text-blue-950">Lightweight items only.</span> Documents, small electronics, or permitted medicines. Photo and declaration required. Weekday pickups are confirmed for after 5:30 PM.
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
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-neutral-400">
                      <Calendar size={11} />
                      {formatDate(request.trip?.goingDate)}
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
                  className="h-36 animate-pulse rounded-[22px] bg-neutral-100"
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
            <div className="space-y-3">
              {trips.map((trip) => {
                const dateParts = tripDateParts(trip.goingDate)

                return (
                  <button
                    key={trip.id}
                    type="button"
                    onClick={() => navigate(`/parcel-booking/${trip.id}`)}
                    className="w-full rounded-[22px] border border-neutral-100 bg-white p-3 text-left shadow-[0_5px_18px_rgba(15,23,42,0.035)] transition active:scale-[0.988] active:bg-neutral-50/60"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-[70px] w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-orange-50 text-orange-700 ring-1 ring-orange-100">
                        <span className="text-[10px] font-black uppercase tracking-wider">
                          {dateParts.weekday}
                        </span>
                        <span className="mt-0.5 text-xl font-black leading-none">
                          {dateParts.day}
                        </span>
                        <span className="mt-1 text-[10px] font-bold uppercase">
                          {dateParts.month}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-400">
                              Scheduled route
                            </p>
                            <h3 className="mt-0.5 line-clamp-2 text-sm font-black leading-5 text-neutral-950">
                              {tripDisplayTitle(trip)}
                            </h3>
                          </div>

                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                            <ChevronRight size={17} />
                          </span>
                        </div>

                        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
                          <Calendar size={13} className="shrink-0 text-neutral-400" />
                          {formatDate(trip.goingDate)}
                        </p>

                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-500">
                          <Package size={12} className="shrink-0 text-blue-500" />
                          <span className="truncate">
                            Documents, electronics and permitted medicine
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl bg-neutral-50 px-3 py-2.5 ring-1 ring-neutral-100">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                          Booking closes
                        </p>
                        <p className="mt-0.5 truncate text-[11px] font-bold text-neutral-700">
                          {formatCutoff(trip.bookingCutoffAt)}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10.5px] font-black text-emerald-700 ring-1 ring-emerald-100">
                        Booking Open
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
