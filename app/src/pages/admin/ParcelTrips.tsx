import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  ChevronDown,
  Clock,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  Truck,
} from 'lucide-react'
import {
  createParcelLocation,
  createParcelTrip,
  deleteParcelTrip,
  fetchAdminParcelTrips,
  fetchParcelLocations,
  updateParcelLocationStatus,
  updateParcelTripStatus,
} from '@/lib/parcels'
import type {
  ParcelLocation,
  ParcelLocationType,
  ParcelTrip,
  ParcelTripStatus,
} from '@/types/parcel'
import { parcelTripStatusLabels } from '@/types/parcel'
import { supabase } from '@/lib/supabase'
import { useAppToast } from '@/components/shared/AppToast'

const BHUTAN_DZONGKHAGS = [
  'Bumthang',
  'Chhukha',
  'Dagana',
  'Gasa',
  'Haa',
  'Lhuentse',
  'Mongar',
  'Paro',
  'Pemagatshel',
  'Punakha',
  'Samdrup Jongkhar',
  'Samtse',
  'Sarpang',
  'Thimphu',
  'Trashigang',
  'Trashiyangtse',
  'Trongsa',
  'Tsirang',
  'Wangdue Phodrang',
  'Zhemgang',
] as const

const LOCATION_TYPES: Array<{
  value: ParcelLocationType
  label: string
}> = [
  { value: 'dzongkhag', label: 'Dzongkhag / headquarters' },
  { value: 'town', label: 'Town' },
  { value: 'hub', label: 'Parcel hub' },
  { value: 'custom', label: 'Other location' },
]

function formatDate(value?: string | null) {
  if (!value) return 'Not set'

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

function tripDisplayTitle(trip: ParcelTrip) {
  const origin =
    trip.origin ||
    trip.originLocation?.name ||
    trip.fromLocation ||
    'Pickup location'
  const destination =
    trip.destination ||
    trip.destinationLocation?.name ||
    trip.toLocation ||
    'Drop-off location'

  return `${origin} → ${destination}`
}

function locationLabel(location: ParcelLocation) {
  if (
    !location.dzongkhag ||
    location.name.toLowerCase() === location.dzongkhag.toLowerCase()
  ) {
    return location.name
  }

  return `${location.name} — ${location.dzongkhag}`
}

function findDefaultLocation(
  locations: ParcelLocation[],
  preferredName: string,
) {
  return (
    locations.find(
      (location) =>
        location.isActive &&
        location.name.toLowerCase() === preferredName.toLowerCase(),
    )?.id ?? ''
  )
}

function statusHelp(status?: ParcelTripStatus) {
  if (status === 'open') return 'Customers can book this trip.'
  if (status === 'closed') return 'Booking is closed; existing requests remain.'
  if (status === 'completed') return 'Trip completed and kept for records.'
  if (status === 'cancelled') return 'Trip cancelled; customers cannot book.'
  return 'Draft or inactive trip.'
}

function statusClass(status?: ParcelTripStatus) {
  if (status === 'open') {
    return 'border border-emerald-100 bg-emerald-50 text-emerald-700'
  }
  if (status === 'closed') {
    return 'border border-amber-100 bg-amber-50 text-amber-700'
  }
  if (status === 'completed') {
    return 'border border-blue-100 bg-blue-50 text-blue-700'
  }
  if (status === 'cancelled') {
    return 'border border-red-100 bg-red-50 text-red-700'
  }
  return 'border border-neutral-200 bg-neutral-100 text-neutral-600'
}

function tripActions(status?: ParcelTripStatus) {
  if (status === 'open') {
    return [
      { status: 'closed' as ParcelTripStatus, label: 'Close booking' },
      { status: 'completed' as ParcelTripStatus, label: 'Mark completed' },
      { status: 'cancelled' as ParcelTripStatus, label: 'Cancel trip' },
    ]
  }

  if (status === 'closed') {
    return [
      { status: 'open' as ParcelTripStatus, label: 'Re-open booking' },
      { status: 'completed' as ParcelTripStatus, label: 'Mark completed' },
      { status: 'cancelled' as ParcelTripStatus, label: 'Cancel trip' },
    ]
  }

  if (status === 'completed' || status === 'cancelled') {
    return [
      { status: 'open' as ParcelTripStatus, label: 'Re-open booking' },
    ]
  }

  return [
    { status: 'open' as ParcelTripStatus, label: 'Open booking' },
    { status: 'cancelled' as ParcelTripStatus, label: 'Cancel trip' },
  ]
}

type TripForm = {
  title: string
  originLocationId: string
  destinationLocationId: string
  goingDate: string
  bookingCutoffAt: string
}

type LocationForm = {
  name: string
  dzongkhag: string
  locationType: ParcelLocationType
}

const emptyTripForm: TripForm = {
  title: '',
  originLocationId: '',
  destinationLocationId: '',
  goingDate: '',
  bookingCutoffAt: '',
}

const emptyLocationForm: LocationForm = {
  name: '',
  dzongkhag: 'Thimphu',
  locationType: 'town',
}

export default function ParcelTrips() {
  const toast = useAppToast()
  const [trips, setTrips] = useState<ParcelTrip[]>([])
  const [locations, setLocations] = useState<ParcelLocation[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showLocationManager, setShowLocationManager] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingLocation, setSavingLocation] = useState(false)
  const [updatingLocationId, setUpdatingLocationId] = useState('')
  const [error, setError] = useState('')
  const [locationError, setLocationError] = useState('')
  const [form, setForm] = useState<TripForm>(emptyTripForm)
  const [locationForm, setLocationForm] =
    useState<LocationForm>(emptyLocationForm)
  const [updatingTripId, setUpdatingTripId] = useState<string | null>(null)
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)

  const activeLocations = useMemo(
    () => locations.filter((location) => location.isActive),
    [locations],
  )

  const selectedOrigin = activeLocations.find(
    (location) => location.id === form.originLocationId,
  )
  const selectedDestination = activeLocations.find(
    (location) => location.id === form.destinationLocationId,
  )
  const routePreview =
    selectedOrigin && selectedDestination
      ? `${selectedOrigin.name} → ${selectedDestination.name}`
      : 'Select From and To locations'

  const applyLocationDefaults = useCallback(
    (rows: ParcelLocation[], current: TripForm) => {
      const active = rows.filter((location) => location.isActive)
      const defaultOrigin =
        current.originLocationId ||
        findDefaultLocation(active, 'Thimphu') ||
        active[0]?.id ||
        ''
      const defaultDestination =
        current.destinationLocationId ||
        findDefaultLocation(active, 'Phuentsholing') ||
        active.find((location) => location.id !== defaultOrigin)?.id ||
        ''

      return {
        ...current,
        originLocationId: defaultOrigin,
        destinationLocationId:
          defaultDestination === defaultOrigin
            ? active.find((location) => location.id !== defaultOrigin)?.id || ''
            : defaultDestination,
      }
    },
    [],
  )

  const loadData = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent)

      try {
        if (!silent) setLoading(true)
        setError('')

        const [tripRows, locationRows] = await Promise.all([
          fetchAdminParcelTrips(),
          fetchParcelLocations({ includeInactive: true }),
        ])

        setTrips(tripRows)
        setLocations(locationRows)
        setForm((current) => applyLocationDefaults(locationRows, current))
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load parcel trips and locations.',
        )
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [applyLocationDefaults],
  )

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    let active = true
    const timers: number[] = []

    const refreshSoon = (delay = 0) => {
      const timer = window.setTimeout(() => {
        if (!active) return
        void loadData({ silent: true })
      }, delay)

      timers.push(timer)
    }

    const handleRealtimeRefresh = () => {
      refreshSoon(0)
      refreshSoon(800)
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) handleRealtimeRefresh()
    }

    window.addEventListener(
      'shop2bhutan:parcel-trips-updated',
      handleRealtimeRefresh,
    )
    window.addEventListener(
      'shop2bhutan:admin-parcels-updated',
      handleRealtimeRefresh,
    )
    window.addEventListener('focus', handleRealtimeRefresh)
    window.addEventListener('pageshow', handleRealtimeRefresh)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const channel = supabase
      .channel('admin-parcel-trips-page-realtime')
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parcel_locations' },
        handleRealtimeRefresh,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refreshSoon(0)
      })

    return () => {
      active = false
      timers.forEach((timer) => window.clearTimeout(timer))
      window.removeEventListener(
        'shop2bhutan:parcel-trips-updated',
        handleRealtimeRefresh,
      )
      window.removeEventListener(
        'shop2bhutan:admin-parcels-updated',
        handleRealtimeRefresh,
      )
      window.removeEventListener('focus', handleRealtimeRefresh)
      window.removeEventListener('pageshow', handleRealtimeRefresh)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      void supabase.removeChannel(channel)
    }
  }, [loadData])

  async function handleCreateTrip() {
    if (!form.originLocationId || !form.destinationLocationId) {
      toast.warning('Route locations required', 'Select both From and To locations.')
      return
    }

    if (form.originLocationId === form.destinationLocationId) {
      toast.warning('Choose different locations', 'From and To locations must be different.')
      return
    }

    if (!form.goingDate) {
      toast.warning('Trip date required', 'Trip date is required.')
      return
    }

    try {
      setSaving(true)
      setError('')

      await createParcelTrip({
        title: form.title.trim() || undefined,
        originLocationId: form.originLocationId,
        destinationLocationId: form.destinationLocationId,
        goingDate: form.goingDate,
        bookingCutoffAt: form.bookingCutoffAt || null,
        status: 'open',
      })

      setForm((current) =>
        applyLocationDefaults(locations, {
          ...emptyTripForm,
          originLocationId: current.originLocationId,
          destinationLocationId: current.destinationLocationId,
        }),
      )
      setShowForm(false)
      toast.success('Parcel trip created', `${routePreview} is now open for booking.`)
      await loadData({ silent: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create trip.'
      toast.error('Unable to create trip', message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateLocation() {
    if (!locationForm.name.trim()) {
      setLocationError('Location name is required.')
      return
    }

    if (!locationForm.dzongkhag) {
      setLocationError('Select a dzongkhag.')
      return
    }

    try {
      setSavingLocation(true)
      setLocationError('')

      const created = await createParcelLocation({
        name: locationForm.name,
        dzongkhag: locationForm.dzongkhag,
        locationType: locationForm.locationType,
      })

      const nextLocations = [...locations, created].sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.name.localeCompare(b.name),
      )

      setLocations(nextLocations)
      setLocationForm(emptyLocationForm)
      setForm((current) =>
        current.originLocationId && current.destinationLocationId
          ? current
          : applyLocationDefaults(nextLocations, current),
      )
      toast.success('Parcel location added', `${created.name} is ready to use in trip routes.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add location.'
      toast.error('Unable to add location', message)
    } finally {
      setSavingLocation(false)
    }
  }

  async function toggleLocation(location: ParcelLocation) {
    try {
      setUpdatingLocationId(location.id)
      setLocationError('')

      const updated = await updateParcelLocationStatus(
        location.id,
        !location.isActive,
      )

      setLocations((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )

      toast.success(
        updated.isActive ? 'Location enabled' : 'Location disabled',
        `${updated.name} ${updated.isActive ? 'can now be used' : 'will no longer appear'} in new parcel routes.`,
      )

      if (!updated.isActive) {
        setForm((current) => {
          const next = {
            ...current,
            originLocationId:
              current.originLocationId === updated.id
                ? ''
                : current.originLocationId,
            destinationLocationId:
              current.destinationLocationId === updated.id
                ? ''
                : current.destinationLocationId,
          }

          return applyLocationDefaults(
            locations.map((item) =>
              item.id === updated.id ? updated : item,
            ),
            next,
          )
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update location.'
      toast.error('Location update failed', message)
    } finally {
      setUpdatingLocationId('')
    }
  }

  async function changeStatus(tripId: string, status: ParcelTripStatus) {
    try {
      setUpdatingTripId(tripId)
      setError('')
      await updateParcelTripStatus(tripId, status)
      toast.success('Trip status updated', `The trip is now ${parcelTripStatusLabels[status] || status}.`)
      await loadData({ silent: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update trip status.'
      toast.error('Trip status update failed', message)
    } finally {
      setUpdatingTripId(null)
      setOpenDropdownId(null)
    }
  }


  async function handleDeleteTrip(trip: ParcelTrip) {
    const requestCount = Math.max(0, Number(trip.requestCount || 0))

    if (requestCount > 0) {
      setOpenDropdownId(null)
      toast.warning(
        'Trip cannot be deleted',
        `This trip has ${requestCount} parcel request${requestCount === 1 ? '' : 's'}. Cancel or complete it instead so customer history remains available.`,
      )
      return
    }

    const tripName = trip.title || tripDisplayTitle(trip)
    const confirmed = window.confirm(
      `Permanently delete this parcel trip?\n\n${tripName}\n\nThis action cannot be undone.`,
    )
    if (!confirmed) return

    try {
      setDeletingTripId(trip.id)
      setOpenDropdownId(null)
      setError('')

      await deleteParcelTrip(trip.id)
      toast.success(
        'Parcel trip deleted',
        `${tripName} was permanently removed.`,
      )
      await loadData({ silent: true })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete parcel trip.'
      toast.error('Unable to delete trip', message)
    } finally {
      setDeletingTripId(null)
    }
  }

  async function handleTripAction(
    trip: ParcelTrip,
    status: ParcelTripStatus,
  ) {
    if (status === trip.status) return

    if (status === 'cancelled') {
      const ok = window.confirm(
        'Cancel this parcel trip? Customers will no longer be able to book it.',
      )
      if (!ok) return
    }

    if (status === 'completed') {
      const ok = window.confirm('Mark this parcel trip as completed?')
      if (!ok) return
    }

    await changeStatus(trip.id, status)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">Parcel Trips</h2>
          <p className="text-sm text-neutral-500">
            Create dynamic parcel routes between any active Bhutan location.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setShowLocationManager((value) => !value)}
            className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-700 hover:bg-orange-100"
          >
            <Settings2 size={16} />
            Manage Locations
          </button>

          <button
            type="button"
            onClick={() => setShowForm((value) => !value)}
            disabled={activeLocations.length < 2}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} />
            Add Trip
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showLocationManager && (
        <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-black text-neutral-900">
                Parcel Locations
              </h3>
              <p className="mt-0.5 text-xs leading-5 text-neutral-500">
                The 20 dzongkhags are seeded automatically. Add towns or hubs
                such as Gelephu, Phuentsholing, Jakar, or Bajo whenever needed.
              </p>
            </div>
            <span className="w-fit rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600">
              {activeLocations.length} active
            </span>
          </div>

          {locationError && (
            <div className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">
              {locationError}
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label>
              <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                Location name
              </span>
              <input
                value={locationForm.name}
                onChange={(event) =>
                  setLocationForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Example: Gelephu"
                className="mt-1.5 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                Dzongkhag
              </span>
              <select
                value={locationForm.dzongkhag}
                onChange={(event) =>
                  setLocationForm((current) => ({
                    ...current,
                    dzongkhag: event.target.value,
                  }))
                }
                className="mt-1.5 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                {BHUTAN_DZONGKHAGS.map((dzongkhag) => (
                  <option key={dzongkhag} value={dzongkhag}>
                    {dzongkhag}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                Location type
              </span>
              <select
                value={locationForm.locationType}
                onChange={(event) =>
                  setLocationForm((current) => ({
                    ...current,
                    locationType: event.target.value as ParcelLocationType,
                  }))
                }
                className="mt-1.5 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                {LOCATION_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void handleCreateLocation()}
                disabled={savingLocation}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white disabled:opacity-60"
              >
                {savingLocation ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Plus size={15} />
                )}
                Add Location
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((location) => (
              <div
                key={location.id}
                className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${
                  location.isActive
                    ? 'border-neutral-100 bg-white'
                    : 'border-neutral-200 bg-neutral-50 opacity-70'
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                  <MapPin size={16} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-neutral-900">
                    {location.name}
                  </p>
                  <p className="truncate text-[11px] text-neutral-500">
                    {location.dzongkhag} · {location.locationType}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void toggleLocation(location)}
                  disabled={updatingLocationId === location.id}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    location.isActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-neutral-200 text-neutral-600'
                  }`}
                >
                  {updatingLocationId === location.id
                    ? 'Saving'
                    : location.isActive
                      ? 'Active'
                      : 'Inactive'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {showForm && (
        <section className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                From
              </span>
              <select
                value={form.originLocationId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    originLocationId: event.target.value,
                  }))
                }
                className="mt-1.5 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                <option value="">Select pickup location</option>
                {activeLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {locationLabel(location)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                To
              </span>
              <select
                value={form.destinationLocationId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    destinationLocationId: event.target.value,
                  }))
                }
                className="mt-1.5 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                <option value="">Select drop-off location</option>
                {activeLocations.map((location) => (
                  <option
                    key={location.id}
                    value={location.id}
                    disabled={location.id === form.originLocationId}
                  >
                    {locationLabel(location)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Trip Title
                <span className="font-medium normal-case text-neutral-400">
                  {' '}(optional)
                </span>
              </span>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder={routePreview}
                className="mt-1.5 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Trip Date
              </span>
              <input
                type="date"
                value={form.goingDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    goingDate: event.target.value,
                  }))
                }
                className="mt-1.5 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Booking Cutoff
              </span>
              <input
                type="datetime-local"
                value={form.bookingCutoffAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    bookingCutoffAt: event.target.value,
                  }))
                }
                className="mt-1.5 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </label>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-blue-700">
            <Truck size={17} className="mt-0.5 shrink-0" />
            <p>
              Selected route: <b>{routePreview}</b>. Customers will see this
              route immediately when the trip is open. Existing
              Thimphu–Phuentsholing trips remain unchanged.
            </p>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-700"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => void handleCreateTrip()}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              {saving ? 'Creating...' : 'Create Open Trip'}
            </button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-neutral-100 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-neutral-500">
            Loading parcel trips...
          </div>
        ) : trips.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
              <Calendar size={24} />
            </div>
            <p className="mt-3 text-sm font-semibold text-neutral-700">
              No parcel trips yet
            </p>
            <p className="text-xs text-neutral-400">
              Create a route and trip date to open parcel booking.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px]">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Trip
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Route
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Requests
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {trips.map((trip) => {
                  const actions = tripActions(trip.status)
                  const isUpdating =
                    updatingTripId === trip.id || deletingTripId === trip.id
                  const isDeleting = deletingTripId === trip.id
                  const isDropdownOpen = openDropdownId === trip.id

                  return (
                    <tr
                      key={trip.id}
                      className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50"
                    >
                      <td className="px-4 py-3 align-top">
                        <p className="text-sm font-bold text-neutral-900">
                          {trip.title || tripDisplayTitle(trip)}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {tripDisplayTitle(trip)}
                        </p>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <p className="text-sm font-semibold text-neutral-700">
                          {formatDate(trip.goingDate)}
                        </p>
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-neutral-500">
                          <Clock size={13} />
                          Cutoff: {formatDateTime(trip.bookingCutoffAt)}
                        </p>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="inline-flex items-center gap-2 text-sm text-neutral-700">
                          <Truck size={15} />
                          {tripDisplayTitle(trip)}
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top text-sm font-semibold text-neutral-700">
                        {trip.requestCount ?? 0}
                      </td>

                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(
                            trip.status,
                          )}`}
                        >
                          {trip.status
                            ? parcelTripStatusLabels[trip.status]
                            : 'Draft'}
                        </span>
                        <p className="mt-1 text-xs text-neutral-400">
                          {statusHelp(trip.status)}
                        </p>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col items-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenDropdownId(
                                isDropdownOpen ? null : trip.id,
                              )
                            }
                            disabled={isUpdating}
                            aria-label={`Manage trip: ${
                              trip.title || trip.name || 'Parcel Trip'
                            }`}
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-bold text-neutral-700 shadow-sm transition hover:border-orange-200 hover:bg-orange-50 disabled:opacity-50"
                          >
                            {isUpdating ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                {isDeleting ? 'Deleting...' : 'Updating...'}
                              </>
                            ) : (
                              <>
                                Manage
                                <ChevronDown
                                  size={14}
                                  className={`transition-transform ${
                                    isDropdownOpen ? 'rotate-180' : ''
                                  }`}
                                />
                              </>
                            )}
                          </button>

                          {isDropdownOpen && !isUpdating && (
                            <div className="w-44 overflow-hidden rounded-xl border border-neutral-100 bg-white shadow-lg">
                              {actions.map((action) => (
                                <button
                                  key={action.status}
                                  type="button"
                                  onClick={() =>
                                    void handleTripAction(trip, action.status)
                                  }
                                  disabled={isUpdating}
                                  className="block w-full px-4 py-2.5 text-left text-sm text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
                                >
                                  {action.label}
                                </button>
                              ))}

                              <div className="border-t border-neutral-100">
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteTrip(trip)}
                                  disabled={isUpdating}
                                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                                >
                                  <Trash2 size={14} />
                                  Delete trip
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
