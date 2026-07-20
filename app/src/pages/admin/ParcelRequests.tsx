import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  Camera,
  Check,
  Clock,
  Copy,
  Eye,
  Image as ImageIcon,
  Loader2,
  MapPin,
  MoreHorizontal,
  Package,
  Phone,
  RefreshCw,
  Search,
  Truck,
  User,
  X,
  XCircle,
} from 'lucide-react'
import {
  completeParcelDelivery,
  fetchAdminParcelRequests,
  scheduleParcelPickup,
  updateParcelRequestStatus,
} from '@/lib/parcels'
import {
  parcelSizeLabels,
  parcelStatusLabels,
  parcelTypeLabels,
} from '@/types/parcel'
import type { ParcelRequest, ParcelRequestStatus } from '@/types/parcel'
import { supabase } from '@/lib/supabase'
import { useAppToast } from '@/components/shared/AppToast'
import {
  consumeRestoredCameraFile,
  isCameraCancellation,
  isNativeCameraRuntime,
  NATIVE_CAMERA_RESTORED_EVENT,
  pickNativeImageFile,
} from '@/lib/camera'

const tabs: { key: 'all' | ParcelRequestStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'pickup_scheduled', label: 'Pickup Scheduled' },
  { key: 'picked_up', label: 'Picked Up' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Cancelled' },
]

type ReasonModalState = {
  request: ParcelRequest
  status: ParcelRequestStatus
}

type PickupScheduleInput = {
  pickupWindowStartAt: string
  pickupWindowEndAt: string
  pickupInstructions?: string
}

type DeliveryProofInput = {
  deliveryProofFile: File
  receiverName: string
  deliveryNote?: string
}

function formatDate(value?: string | null) {
  if (!value) return 'Date not set'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Date not set'

  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Date not set'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Date not set'

  return `${parsed.toLocaleString('en-GB', {
    timeZone: 'Asia/Thimphu',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })} BTT`
}

function formatPickupWindow(request: ParcelRequest) {
  if (!request.pickupWindowStartAt || !request.pickupWindowEndAt) return ''

  const start = new Date(request.pickupWindowStartAt)
  const end = new Date(request.pickupWindowEndAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''

  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Thimphu',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(start)
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Thimphu',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return `${date}, ${time.format(start)}–${time.format(end)}`
}

function statusLabel(status: ParcelRequestStatus) {
  if (status === 'pending') return 'Pending Review'
  return parcelStatusLabels[status] || status
}

function statusClass(status: ParcelRequestStatus) {
  if (status === 'pending') {
    return 'border border-amber-100 bg-amber-50 text-amber-700'
  }

  if (status === 'accepted') {
    return 'border border-blue-100 bg-blue-50 text-blue-700'
  }

  if (status === 'pickup_scheduled') {
    return 'border border-cyan-100 bg-cyan-50 text-cyan-700'
  }

  if (status === 'picked_up' || status === 'collected') {
    return 'border border-violet-100 bg-violet-50 text-violet-700'
  }

  if (status === 'in_transit') {
    return 'border border-indigo-100 bg-indigo-50 text-indigo-700'
  }

  if (status === 'delivered') {
    return 'border border-emerald-100 bg-emerald-50 text-emerald-700'
  }

  if (status === 'rejected') {
    return 'border border-rose-100 bg-rose-50 text-rose-700'
  }

  return 'border border-neutral-200 bg-neutral-100 text-neutral-600'
}

function tripDisplayTitle(request: ParcelRequest) {
  const origin = request.trip?.origin || request.trip?.fromLocation || 'Pickup location'
  const destination =
    request.trip?.destination || request.trip?.toLocation || 'Drop-off location'

  return `${origin} → ${destination}`
}

function parcelTitle(request: ParcelRequest) {
  return request.packageDescription || request.description || 'Parcel request'
}

function nextStatuses(status: ParcelRequestStatus): ParcelRequestStatus[] {
  if (status === 'pending') return ['accepted', 'rejected', 'cancelled']

  if (status === 'accepted') return ['pickup_scheduled', 'cancelled']

  if (status === 'pickup_scheduled') return ['picked_up', 'cancelled']

  if (status === 'picked_up' || status === 'collected') {
    return ['in_transit', 'cancelled']
  }

  if (status === 'in_transit') return ['delivered', 'cancelled']

  return []
}

function primaryNextStatus(status: ParcelRequestStatus) {
  return nextStatuses(status).find(
    (nextStatus) => nextStatus !== 'rejected' && nextStatus !== 'cancelled',
  )
}

function actionLabel(status: ParcelRequestStatus) {
  if (status === 'accepted') return 'Accept Request'
  if (status === 'pickup_scheduled') return 'Schedule Pickup'
  if (status === 'picked_up') return 'Mark Picked Up'
  if (status === 'in_transit') return 'Mark In Transit'
  if (status === 'delivered') return 'Mark Delivered'
  if (status === 'rejected') return 'Reject'
  if (status === 'cancelled') return 'Cancel'

  return statusLabel(status)
}

function actionClass(status: ParcelRequestStatus) {
  if (status === 'accepted') return 'bg-orange-500 hover:bg-orange-600'
  if (status === 'pickup_scheduled') return 'bg-blue-600 hover:bg-blue-700'
  if (status === 'picked_up') return 'bg-violet-600 hover:bg-violet-700'
  if (status === 'in_transit') return 'bg-indigo-600 hover:bg-indigo-700'
  if (status === 'delivered') return 'bg-emerald-600 hover:bg-emerald-700'

  return 'bg-rose-600 hover:bg-rose-700'
}

function isFinalStatus(status: ParcelRequestStatus) {
  return status === 'delivered' || status === 'rejected' || status === 'cancelled'
}

function finalStatusText(status: ParcelRequestStatus) {
  if (status === 'delivered') return 'Completed — no further action required'
  if (status === 'rejected') return 'Rejected — reason shared with customer'
  if (status === 'cancelled') return 'Cancelled — customer has been notified'
  return statusLabel(status)
}

function searchableText(request: ParcelRequest) {
  return [
    request.parcelNo,
    parcelTitle(request),
    request.senderName,
    request.senderPhone,
    request.contactNumber,
    request.pickupAddress,
    request.receiverName,
    request.receiverPhone,
    request.dropoffAddress,
    tripDisplayTitle(request),
    request.parcelType ? parcelTypeLabels[request.parcelType] : '',
    request.parcelSize ? parcelSizeLabels[request.parcelSize] : '',
    formatPickupWindow(request),
    request.pickupInstructions,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export default function ParcelRequests() {
  const toast = useAppToast()
  const [searchParams] = useSearchParams()
  const initialStatus = searchParams.get('status')
  const [requests, setRequests] = useState<ParcelRequest[]>([])
  const [filter, setFilter] = useState<'all' | ParcelRequestStatus>(
    initialStatus === 'pending' ? 'pending' : 'all',
  )
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState('')
  const [error, setError] = useState('')
  const [reasonModal, setReasonModal] = useState<ReasonModalState | null>(null)
  const [scheduleModal, setScheduleModal] = useState<ParcelRequest | null>(null)
  const [deliveryModal, setDeliveryModal] = useState<ParcelRequest | null>(null)
  const [selectedRequestId, setSelectedRequestId] = useState('')
  const [openMenuId, setOpenMenuId] = useState('')

  const loadRequests = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent)

    try {
      if (!silent) setLoading(true)
      setError('')

      const rows = await fetchAdminParcelRequests()
      setRequests(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  useEffect(() => {
    let active = true
    const timers: number[] = []

    const refreshSoon = (delay = 0) => {
      const timer = window.setTimeout(() => {
        if (!active) return
        void loadRequests({ silent: true })
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

    window.addEventListener('shop2bhutan:admin-parcels-updated', handleRealtimeRefresh)
    window.addEventListener('focus', handleRealtimeRefresh)
    window.addEventListener('pageshow', handleRealtimeRefresh)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const channel = supabase
      .channel('admin-parcel-requests-page-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parcel_requests' },
        handleRealtimeRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parcel_trips' },
        handleRealtimeRefresh,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refreshSoon(0)
      })

    return () => {
      active = false
      timers.forEach((timer) => window.clearTimeout(timer))
      window.removeEventListener('shop2bhutan:admin-parcels-updated', handleRealtimeRefresh)
      window.removeEventListener('focus', handleRealtimeRefresh)
      window.removeEventListener('pageshow', handleRealtimeRefresh)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      void supabase.removeChannel(channel)
    }
  }, [loadRequests])

  useEffect(() => {
    if (!openMenuId) return undefined

    const closeMenu = () => setOpenMenuId('')
    window.addEventListener('click', closeMenu)

    return () => window.removeEventListener('click', closeMenu)
  }, [openMenuId])

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return requests.filter((request) => {
      const statusMatches = filter === 'all' || request.status === filter
      const searchMatches =
        !normalizedQuery || searchableText(request).includes(normalizedQuery)

      return statusMatches && searchMatches
    })
  }, [filter, query, requests])

  const counts = useMemo(() => {
    return requests.reduce<Record<string, number>>(
      (acc, request) => {
        acc.all += 1
        acc[request.status] = (acc[request.status] ?? 0) + 1
        return acc
      },
      { all: 0 },
    )
  }, [requests])

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) || null,
    [requests, selectedRequestId],
  )

  async function performStatusChange(
    request: ParcelRequest,
    status: ParcelRequestStatus,
    adminNotes?: string,
  ) {
    try {
      setUpdatingId(request.id)
      setError('')
      setOpenMenuId('')

      await updateParcelRequestStatus(request.id, status, adminNotes)
      await loadRequests({ silent: true })
      window.dispatchEvent(new CustomEvent('shop2bhutan:admin-parcels-updated'))
      window.dispatchEvent(new CustomEvent('shop2bhutan:parcels-updated'))
      toast.success(
        'Parcel request updated',
        `${actionLabel(status)} was completed successfully.`,
      )
      return true
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to update parcel request.'
      toast.error('Parcel update failed', message)
      return false
    } finally {
      setUpdatingId('')
    }
  }

  function changeStatus(request: ParcelRequest, status: ParcelRequestStatus) {
    setOpenMenuId('')

    if (status === 'pickup_scheduled') {
      setScheduleModal(request)
      return
    }

    if (status === 'delivered') {
      setDeliveryModal(request)
      return
    }

    if (status === 'rejected' || status === 'cancelled') {
      setReasonModal({ request, status })
      return
    }

    void performStatusChange(request, status)
  }

  async function confirmReasonModal(note: string) {
    if (!reasonModal) return

    const success = await performStatusChange(
      reasonModal.request,
      reasonModal.status,
      note,
    )

    if (success) setReasonModal(null)
  }

  async function confirmPickupSchedule(input: PickupScheduleInput) {
    if (!scheduleModal) return

    try {
      setUpdatingId(scheduleModal.id)
      setError('')

      await scheduleParcelPickup({
        requestId: scheduleModal.id,
        ...input,
      })
      await loadRequests({ silent: true })
      window.dispatchEvent(new CustomEvent('shop2bhutan:admin-parcels-updated'))
      window.dispatchEvent(new CustomEvent('shop2bhutan:parcels-updated'))
      toast.success(
        'Pickup scheduled',
        'The customer has been notified with the confirmed evening window.',
      )
      setScheduleModal(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to schedule pickup.'
      toast.error('Pickup scheduling failed', message)
    } finally {
      setUpdatingId('')
    }
  }

async function confirmDelivery(input: DeliveryProofInput) {
  if (!deliveryModal) return

  try {
    setUpdatingId(deliveryModal.id)
    setError('')

    await completeParcelDelivery({
      requestId: deliveryModal.id,
      deliveryProofFile: input.deliveryProofFile,
      receiverName: input.receiverName,
      deliveryNote: input.deliveryNote,
    })

    await loadRequests({ silent: true })
    window.dispatchEvent(
      new CustomEvent('shop2bhutan:admin-parcels-updated'),
    )
    window.dispatchEvent(
      new CustomEvent('shop2bhutan:parcels-updated'),
    )
    toast.success(
      'Parcel delivered',
      'Proof of delivery was saved and the sender has been notified.',
    )
    setDeliveryModal(null)
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Failed to complete parcel delivery.'
    toast.error('Delivery confirmation failed', message)
  } finally {
    setUpdatingId('')
  }
}

  async function copyPhone(phone?: string | null) {
    if (!phone) return

    try {
      await navigator.clipboard.writeText(phone)
      toast.success('Phone number copied', phone)
    } catch {
      toast.error('Unable to copy', 'Copy the phone number manually.')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">Parcel Requests</h2>
          <p className="text-sm text-neutral-500">
            Review bookings, contact customers and update parcel progress.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadRequests()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
        <div className="border-b border-neutral-100 p-3">
          <div className="relative max-w-xl">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search parcel ID, customer, phone or route..."
              className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-10 pr-10 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto border-b border-neutral-100 p-2">
          <div className="flex min-w-max gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                  filter === tab.key
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {tab.label} ({counts[tab.key] ?? 0})
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs text-neutral-500">
          <span>
            Showing <strong className="text-neutral-800">{filtered.length}</strong> of{' '}
            <strong className="text-neutral-800">{requests.length}</strong> requests
          </span>
          {query && (
            <span className="max-w-[45%] truncate">
              Search: <strong className="text-neutral-700">{query}</strong>
            </span>
          )}
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-neutral-100 bg-white p-8 text-center text-sm text-neutral-500">
          Loading parcel requests...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-neutral-100 bg-white p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
            <Package size={24} />
          </div>

          <p className="mt-3 text-sm font-semibold text-neutral-700">
            {query ? 'No matching parcel requests' : 'No parcel requests found'}
          </p>

          <p className="mt-1 text-xs text-neutral-400">
            {query
              ? 'Try a different parcel ID, customer, phone number or route.'
              : 'Customer parcel bookings will appear here.'}
          </p>
        </div>
      ) : (
        <section className="overflow-visible rounded-2xl border border-neutral-100 bg-white shadow-sm">
          <div className="hidden grid-cols-[minmax(260px,1.5fr)_minmax(180px,1fr)_minmax(180px,1fr)_150px_210px] gap-4 border-b border-neutral-100 bg-neutral-50/70 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500 xl:grid">
            <span>Request</span>
            <span>Pickup</span>
            <span>Drop-off</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-neutral-100">
            {filtered.map((request) => (
              <ParcelRequestRow
                key={request.id}
                request={request}
                updating={updatingId === request.id}
                menuOpen={openMenuId === request.id}
                onView={() => setSelectedRequestId(request.id)}
                onToggleMenu={(event) => {
                  event.stopPropagation()
                  setOpenMenuId((current) => (current === request.id ? '' : request.id))
                }}
                onChangeStatus={(status) => changeStatus(request, status)}
              />
            ))}
          </div>
        </section>
      )}

      {selectedRequest && (
        <ParcelRequestDrawer
          request={selectedRequest}
          updating={updatingId === selectedRequest.id}
          onClose={() => setSelectedRequestId('')}
          onCopyPhone={copyPhone}
          onChangeStatus={(status) => changeStatus(selectedRequest, status)}
        />
      )}

      {reasonModal && (
        <StatusReasonModal
          request={reasonModal.request}
          status={reasonModal.status}
          updating={updatingId === reasonModal.request.id}
          onClose={() => setReasonModal(null)}
          onConfirm={confirmReasonModal}
        />
      )}

      {scheduleModal && (
        <PickupScheduleModal
          request={scheduleModal}
          updating={updatingId === scheduleModal.id}
          onClose={() => setScheduleModal(null)}
          onConfirm={confirmPickupSchedule}
        />
      )}

      {deliveryModal && (
        <DeliveryProofModal
          request={deliveryModal}
          updating={updatingId === deliveryModal.id}
          onClose={() => setDeliveryModal(null)}
          onConfirm={confirmDelivery}
        />
      )}
    </div>
  )
}

function ParcelRequestRow({
  request,
  updating,
  menuOpen,
  onView,
  onToggleMenu,
  onChangeStatus,
}: {
  request: ParcelRequest
  updating: boolean
  menuOpen: boolean
  onView: () => void
  onToggleMenu: (event: MouseEvent<HTMLButtonElement>) => void
  onChangeStatus: (status: ParcelRequestStatus) => void
}) {
  const title = parcelTitle(request)
  const primaryStatus = primaryNextStatus(request.status)
  const destructiveStatuses = nextStatuses(request.status).filter(
    (status) => status === 'rejected' || status === 'cancelled',
  )

  return (
    <article
      className="group grid cursor-pointer gap-4 px-4 py-4 transition hover:bg-neutral-50/80 xl:grid-cols-[minmax(260px,1.5fr)_minmax(180px,1fr)_minmax(180px,1fr)_150px_210px] xl:items-center"
      onClick={onView}
    >
      <div className="flex min-w-0 gap-3">
        {request.parcelPhotoUrl ? (
          <img
            src={request.parcelPhotoUrl}
            alt={title}
            className="h-14 w-14 shrink-0 rounded-xl border border-neutral-100 bg-neutral-100 object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400">
            <Package size={22} />
          </div>
        )}

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-xs font-bold text-neutral-400">
              {request.parcelNo || 'Parcel Request'}
            </p>
            <span
              className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold xl:hidden ${statusClass(
                request.status,
              )}`}
            >
              {statusLabel(request.status)}
            </span>
          </div>

          <h3 className="mt-1 truncate text-sm font-bold text-neutral-900">{title}</h3>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
            <span>{tripDisplayTitle(request)}</span>
            <span className="text-neutral-300">•</span>
            <span>{formatDate(request.trip?.goingDate)}</span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {request.parcelType && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                {parcelTypeLabels[request.parcelType] || request.parcelType}
              </span>
            )}
            {request.parcelSize && (
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                {parcelSizeLabels[request.parcelSize] || request.parcelSize}
              </span>
            )}
          </div>

          {formatPickupWindow(request) && (
            <p className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-blue-600">
              <Clock size={11} />
              {formatPickupWindow(request)}
            </p>
          )}
        </div>
      </div>

      <ContactSummary
        label="Pickup"
        address={request.pickupAddress}
        name={request.senderName}
        phone={request.senderPhone || request.contactNumber}
      />

      <ContactSummary
        label="Drop-off"
        address={request.dropoffAddress}
        name={request.receiverName}
        phone={request.receiverPhone}
      />

      <div className="hidden xl:block">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(
            request.status,
          )}`}
        >
          {statusLabel(request.status)}
        </span>
      </div>

      <div
        className="flex flex-wrap items-center gap-2 xl:justify-end"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onView}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50"
        >
          <Eye size={14} />
          View
        </button>

        {request.status === 'pickup_scheduled' && (
          <button
            type="button"
            disabled={updating}
            onClick={() => onChangeStatus('pickup_scheduled')}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-50 disabled:opacity-60"
          >
            <Clock size={14} />
            Edit Window
          </button>
        )}

        {primaryStatus && (
          <button
            type="button"
            disabled={updating}
            onClick={() => onChangeStatus(primaryStatus)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-white transition disabled:opacity-60 ${actionClass(
              primaryStatus,
            )}`}
          >
            {primaryStatus === 'delivered' ? (
              <Check size={14} />
            ) : primaryStatus === 'pickup_scheduled' ? (
              <Clock size={14} />
            ) : (
              <Truck size={14} />
            )}
            {updating ? 'Updating...' : actionLabel(primaryStatus)}
          </button>
        )}

        {destructiveStatuses.length > 0 && (
          <div className="relative">
            <button
              type="button"
              disabled={updating}
              onClick={onToggleMenu}
              aria-label="More parcel request actions"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-50"
            >
              <MoreHorizontal size={17} />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 z-30 mt-2 w-44 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                {destructiveStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => onChangeStatus(status)}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                      status === 'rejected'
                        ? 'text-rose-600 hover:bg-rose-50'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <XCircle size={14} />
                    {status === 'rejected' ? 'Reject Request' : 'Cancel Request'}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {isFinalStatus(request.status) && (
          <span className="text-xs font-semibold text-neutral-500">
            {finalStatusText(request.status)}
          </span>
        )}
      </div>
    </article>
  )
}

function ContactSummary({
  label,
  address,
  name,
  phone,
}: {
  label: string
  address?: string | null
  name?: string | null
  phone?: string | null
}) {
  return (
    <div className="min-w-0 rounded-xl bg-neutral-50 p-3 xl:bg-transparent xl:p-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 xl:hidden">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-neutral-800 xl:mt-0">
        {address || `${label} address not provided`}
      </p>
      <p className="mt-0.5 truncate text-xs text-neutral-500">
        {name || `${label} contact`}
        {phone ? ` · ${phone}` : ''}
      </p>
    </div>
  )
}

function ParcelRequestDrawer({
  request,
  updating,
  onClose,
  onCopyPhone,
  onChangeStatus,
}: {
  request: ParcelRequest
  updating: boolean
  onClose: () => void
  onCopyPhone: (phone?: string | null) => Promise<void>
  onChangeStatus: (status: ParcelRequestStatus) => void
}) {
  const title = parcelTitle(request)
  const primaryStatus = primaryNextStatus(request.status)
  const secondaryStatuses = nextStatuses(request.status).filter(
    (status) => status === 'rejected' || status === 'cancelled',
  )

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/35" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-neutral-100 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-bold text-neutral-400">
              {request.parcelNo || 'Parcel Request'}
            </p>
            <h2 className="mt-1 truncate text-lg font-bold text-neutral-950">{title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(
                  request.status,
                )}`}
              >
                {statusLabel(request.status)}
              </span>
              <span className="text-xs text-neutral-500">
                {tripDisplayTitle(request)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close parcel details"
          >
            <X size={19} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5">
          {request.parcelPhotoUrl ? (
            <a href={request.parcelPhotoUrl} target="_blank" rel="noreferrer">
              <img
                src={request.parcelPhotoUrl}
                alt={title}
                className="h-56 w-full rounded-2xl border border-neutral-100 bg-neutral-100 object-cover"
              />
              <span className="mt-2 flex items-center justify-center gap-1.5 text-xs font-bold text-orange-600">
                <Eye size={14} />
                Open full photo
              </span>
            </a>
          ) : (
            <div className="flex h-40 w-full items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
              <Package size={32} />
            </div>
          )}

          {request.deliveryProofUrl && (
            <section className="mt-5 overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50">
              <a
                href={request.deliveryProofUrl}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                <img
                  src={request.deliveryProofUrl}
                  alt="Proof of parcel delivery"
                  className="h-52 w-full bg-neutral-100 object-cover"
                />
              </a>
              <div className="p-4">
                <div className="flex items-center gap-2 text-emerald-700">
                  <Check size={16} />
                  <p className="text-xs font-bold uppercase tracking-wider">
                    Proof of delivery
                  </p>
                </div>
                <p className="mt-2 text-sm font-bold text-emerald-950">
                  Handed to{' '}
                  {request.deliveryReceiverName ||
                    request.receiverName ||
                    'receiver'}
                </p>
                {request.deliveredAt && (
                  <p className="mt-1 text-xs text-emerald-700">
                    {formatDateTime(request.deliveredAt)}
                  </p>
                )}
                {request.deliveryNote && (
                  <p className="mt-2 text-xs leading-5 text-emerald-800">
                    {request.deliveryNote}
                  </p>
                )}
                <a
                  href={request.deliveryProofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100"
                >
                  <ImageIcon size={14} />
                  Open full photo
                </a>
              </div>
            </section>
          )}

          <section className="mt-5 rounded-2xl border border-neutral-100 bg-neutral-50/70 p-4">
            <div className="flex items-start gap-3">
              <MapPin size={18} className="mt-0.5 shrink-0 text-orange-500" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Trip
                </p>
                <p className="mt-1 text-sm font-bold text-neutral-900">
                  {tripDisplayTitle(request)}
                </p>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
                  <CalendarDays size={13} />
                  {formatDate(request.trip?.goingDate)}
                </div>
              </div>
            </div>
          </section>

          {formatPickupWindow(request) && (
            <section className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <Clock size={18} className="mt-0.5 shrink-0 text-blue-600" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                    Confirmed pickup window
                  </p>
                  <p className="mt-1 text-sm font-bold text-blue-950">
                    {formatPickupWindow(request)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-blue-700">
                    {request.pickupInstructions ||
                      'Please keep the parcel packed and your phone available.'}
                  </p>
                </div>
              </div>
            </section>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ContactDetailCard
              title="Pickup"
              address={request.pickupAddress}
              name={request.senderName}
              phone={request.senderPhone || request.contactNumber}
              onCopyPhone={onCopyPhone}
            />
            <ContactDetailCard
              title="Drop-off"
              address={request.dropoffAddress}
              name={request.receiverName}
              phone={request.receiverPhone}
              onCopyPhone={onCopyPhone}
            />
          </div>

          <section className="mt-4 rounded-2xl border border-neutral-100 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Parcel information
            </p>

            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <DetailItem
                label="Parcel type"
                value={
                  request.parcelType
                    ? parcelTypeLabels[request.parcelType] || request.parcelType
                    : 'Not provided'
                }
              />
              <DetailItem
                label="Size"
                value={
                  request.parcelSize
                    ? parcelSizeLabels[request.parcelSize] || request.parcelSize
                    : 'Not provided'
                }
              />
              <div className="sm:col-span-2">
                <DetailItem label="Description" value={title} />
              </div>
            </dl>
          </section>

          {(request.customerNotes || request.instructions) && (
            <section className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Customer note
              </p>
              <p className="mt-2 text-sm leading-relaxed text-blue-900">
                {request.customerNotes || request.instructions}
              </p>
            </section>
          )}

          {request.adminNotes && (
            <section
              className={`mt-4 rounded-2xl border p-4 ${
                request.status === 'rejected'
                  ? 'border-rose-100 bg-rose-50'
                  : request.status === 'cancelled'
                    ? 'border-neutral-200 bg-neutral-50'
                    : 'border-amber-100 bg-amber-50'
              }`}
            >
              <p
                className={`text-xs font-bold uppercase tracking-wider ${
                  request.status === 'rejected'
                    ? 'text-rose-700'
                    : request.status === 'cancelled'
                      ? 'text-neutral-600'
                      : 'text-amber-700'
                }`}
              >
                {request.status === 'rejected'
                  ? 'Rejection reason'
                  : request.status === 'cancelled'
                    ? 'Cancellation note'
                    : 'Admin note'}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-800">
                {request.adminNotes}
              </p>
            </section>
          )}
        </div>

        <footer className="border-t border-neutral-100 bg-white px-4 py-4 sm:px-5">
          {primaryStatus ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              {request.status === 'pickup_scheduled' && (
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => onChangeStatus('pickup_scheduled')}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-blue-200 px-4 text-sm font-bold text-blue-700 transition hover:bg-blue-50 disabled:opacity-60"
                >
                  <Clock size={16} />
                  Edit Window
                </button>
              )}

              <button
                type="button"
                disabled={updating}
                onClick={() => onChangeStatus(primaryStatus)}
                className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white transition disabled:opacity-60 ${actionClass(
                  primaryStatus,
                )}`}
              >
                {primaryStatus === 'delivered' ? (
                  <Check size={16} />
                ) : primaryStatus === 'pickup_scheduled' ? (
                  <Clock size={16} />
                ) : (
                  <Truck size={16} />
                )}
                {updating ? 'Updating...' : actionLabel(primaryStatus)}
              </button>

              {secondaryStatuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={updating}
                  onClick={() => onChangeStatus(status)}
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold transition disabled:opacity-60 ${
                    status === 'rejected'
                      ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                      : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <XCircle size={15} />
                  {status === 'rejected' ? 'Reject' : 'Cancel'}
                </button>
              ))}
            </div>
          ) : (
            <div
              className={`rounded-2xl px-4 py-3 text-center text-sm font-bold ${statusClass(
                request.status,
              )}`}
            >
              {finalStatusText(request.status)}
            </div>
          )}
        </footer>
      </aside>
    </div>
  )
}

function ContactDetailCard({
  title,
  address,
  name,
  phone,
  onCopyPhone,
}: {
  title: string
  address?: string | null
  name?: string | null
  phone?: string | null
  onCopyPhone: (phone?: string | null) => Promise<void>
}) {
  return (
    <section className="rounded-2xl border border-neutral-100 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">
        {title}
      </p>

      <div className="mt-3 flex items-start gap-2.5">
        <MapPin size={16} className="mt-0.5 shrink-0 text-neutral-400" />
        <p className="text-sm font-semibold leading-relaxed text-neutral-900">
          {address || `${title} address not provided`}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2.5">
        <User size={16} className="shrink-0 text-neutral-400" />
        <p className="min-w-0 truncate text-sm text-neutral-700">
          {name || `${title} contact`}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Phone size={16} className="shrink-0 text-neutral-400" />
        {phone ? (
          <>
            <a
              href={`tel:${phone}`}
              className="min-w-0 flex-1 truncate text-sm font-bold text-orange-600 hover:text-orange-700"
            >
              {phone}
            </a>
            <button
              type="button"
              onClick={() => void onCopyPhone(phone)}
              aria-label={`Copy ${title.toLowerCase()} phone number`}
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            >
              <Copy size={14} />
            </button>
          </>
        ) : (
          <span className="text-sm text-neutral-400">Phone not provided</span>
        )}
      </div>
    </section>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-neutral-900">{value}</dd>
    </div>
  )
}

function bhutanDateInputValue(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Thimphu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const part = (type: string) => parts.find((item) => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function bhutanTimeInputValue(value: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Thimphu',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value)
  const part = (type: string) => parts.find((item) => item.type === type)?.value || ''
  return `${part('hour')}:${part('minute')}`
}

function defaultPickupDate() {
  const now = new Date()
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Thimphu',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now),
  )
  return bhutanDateInputValue(new Date(now.getTime() + (hour >= 20 ? 86_400_000 : 0)))
}

function makeBhutanDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00+06:00`)
}

function DeliveryProofModal({
  request,
  updating,
  onClose,
  onConfirm,
}: {
  request: ParcelRequest
  updating: boolean
  onClose: () => void
  onConfirm: (input: DeliveryProofInput) => Promise<void>
}) {
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('')
  const [receiverName, setReceiverName] = useState(
    request.receiverName || '',
  )
  const [deliveryNote, setDeliveryNote] = useState('')
  const [openingCamera, setOpeningCamera] = useState(false)
  const [localError, setLocalError] = useState('')
  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl('')
      return undefined
    }

    const previewUrl = URL.createObjectURL(photoFile)
    setPhotoPreviewUrl(previewUrl)

    return () => URL.revokeObjectURL(previewUrl)
  }, [photoFile])

  function applyPhoto(file: File | null) {
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setPhotoFile(null)
      setLocalError('Please select a valid image file.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoFile(null)
      setLocalError('Delivery photo must be below 5 MB.')
      return
    }

    setPhotoFile(file)
    setLocalError('')
  }

  async function openPhotoPicker() {
    if (!isNativeCameraRuntime()) {
      photoInputRef.current?.click()
      return
    }

    setOpeningCamera(true)
    setLocalError('')

    try {
      const file = await pickNativeImageFile({
        purpose: 'parcel-delivery-proof',
        fileNamePrefix: 'parcel-delivery-proof',
        quality: 86,
        width: 1800,
        height: 1800,
      })

      if (file) applyPhoto(file)
    } catch (cameraError) {
      if (!isCameraCancellation(cameraError)) {
        setLocalError(
          cameraError instanceof Error
            ? cameraError.message
            : 'Unable to open the camera or gallery.',
        )
      }
    } finally {
      setOpeningCamera(false)
    }
  }

  useEffect(() => {
    let active = true

    const restoreCameraResult = async () => {
      try {
        const file = await consumeRestoredCameraFile(
          'parcel-delivery-proof',
          'parcel-delivery-proof',
        )

        if (active && file) applyPhoto(file)
      } catch (cameraError) {
        if (active && !isCameraCancellation(cameraError)) {
          setLocalError('Unable to restore the delivery photo.')
        }
      }
    }

    void restoreCameraResult()

    const handleRestoredResult = () => {
      void restoreCameraResult()
    }

    window.addEventListener(
      NATIVE_CAMERA_RESTORED_EVENT,
      handleRestoredResult,
    )

    return () => {
      active = false
      window.removeEventListener(
        NATIVE_CAMERA_RESTORED_EVENT,
        handleRestoredResult,
      )
    }
  }, [])

  async function submit() {
    const cleanedReceiver = receiverName.trim()

    if (!photoFile) {
      setLocalError('Take or select a delivery photo before confirming.')
      return
    }

    if (!cleanedReceiver) {
      setLocalError('Receiver name is required.')
      return
    }

    setLocalError('')
    await onConfirm({
      deliveryProofFile: photoFile,
      receiverName: cleanedReceiver,
      deliveryNote: deliveryNote.trim() || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-4 sm:items-center">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-neutral-900">
              Confirm parcel delivery
            </p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-500">
              Add a handover photo. The sender will see it as proof of delivery.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={updating}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 disabled:opacity-50"
            aria-label="Close delivery confirmation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-neutral-50 p-3">
          <p className="text-xs font-bold text-neutral-400">
            {request.parcelNo || 'Parcel Request'}
          </p>
          <p className="mt-1 text-sm font-bold text-neutral-900">
            {parcelTitle(request)}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Deliver to {request.receiverName || 'receiver'} ·{' '}
            {request.receiverPhone || 'Phone'}
          </p>
        </div>

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            applyPhoto(event.target.files?.[0] ?? null)
            event.target.value = ''
          }}
        />

        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-600">
            Delivery photo <span className="text-rose-500">*</span>
          </p>

          {photoPreviewUrl ? (
            <div className="mt-2 overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50">
              <img
                src={photoPreviewUrl}
                alt="Delivery proof preview"
                className="h-56 w-full bg-neutral-100 object-cover"
              />
              <div className="flex gap-2 p-3">
                <button
                  type="button"
                  onClick={() => void openPhotoPicker()}
                  disabled={updating || openingCamera}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-white text-xs font-bold text-emerald-700 ring-1 ring-emerald-100 disabled:opacity-60"
                >
                  <Camera size={15} />
                  Retake
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoFile(null)}
                  disabled={updating}
                  className="h-10 flex-1 rounded-xl bg-white text-xs font-bold text-neutral-600 ring-1 ring-neutral-200 disabled:opacity-60"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void openPhotoPicker()}
              disabled={updating || openingCamera}
              className="mt-2 flex h-36 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
            >
              {openingCamera ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <Camera size={26} />
              )}
              <span className="text-sm font-bold">
                {openingCamera ? 'Opening camera...' : 'Take delivery photo'}
              </span>
              <span className="text-[11px] text-emerald-600">
                Camera or gallery · Maximum 5 MB
              </span>
            </button>
          )}
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
            Received by
          </span>
          <input
            value={receiverName}
            onChange={(event) => {
              setReceiverName(event.target.value)
              setLocalError('')
            }}
            className="mt-2 h-11 w-full rounded-2xl border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
            placeholder="Receiver name"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
            Delivery note <span className="normal-case text-neutral-400">(optional)</span>
          </span>
          <textarea
            value={deliveryNote}
            onChange={(event) => setDeliveryNote(event.target.value)}
            className="mt-2 h-24 w-full resize-none rounded-2xl border border-neutral-200 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
            placeholder="Example: Parcel handed over in good condition."
          />
        </label>

        {localError && (
          <p className="mt-3 text-xs font-semibold text-red-600">
            {localError}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={updating}
            className="h-11 flex-1 rounded-2xl bg-neutral-100 text-sm font-bold text-neutral-700 disabled:opacity-50"
          >
            Not Now
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={updating || openingCamera}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-bold text-white disabled:opacity-60"
          >
            {updating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            {updating ? 'Saving proof...' : 'Confirm Delivery'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PickupScheduleModal({
  request,
  updating,
  onClose,
  onConfirm,
}: {
  request: ParcelRequest
  updating: boolean
  onClose: () => void
  onConfirm: (input: PickupScheduleInput) => Promise<void>
}) {
  const existingStart = request.pickupWindowStartAt
    ? new Date(request.pickupWindowStartAt)
    : null
  const existingEnd = request.pickupWindowEndAt
    ? new Date(request.pickupWindowEndAt)
    : null
  const [date, setDate] = useState(
    existingStart && !Number.isNaN(existingStart.getTime())
      ? bhutanDateInputValue(existingStart)
      : defaultPickupDate(),
  )
  const [startTime, setStartTime] = useState(
    existingStart && !Number.isNaN(existingStart.getTime())
      ? bhutanTimeInputValue(existingStart)
      : '17:30',
  )
  const [endTime, setEndTime] = useState(
    existingEnd && !Number.isNaN(existingEnd.getTime())
      ? bhutanTimeInputValue(existingEnd)
      : '20:00',
  )
  const [instructions, setInstructions] = useState(
    request.pickupInstructions ||
      'Please keep the parcel packed and your phone available.',
  )
  const [localError, setLocalError] = useState('')

  const quickWindows = [
    { label: '5:30–6:30 PM', start: '17:30', end: '18:30' },
    { label: '6:30–8:00 PM', start: '18:30', end: '20:00' },
    { label: '5:30–8:00 PM', start: '17:30', end: '20:00' },
  ]

  async function submit() {
    if (!date || !startTime || !endTime) {
      setLocalError('Choose the pickup date, start time and end time.')
      return
    }

    const start = makeBhutanDateTime(date, startTime)
    const end = makeBhutanDateTime(date, endTime)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setLocalError('Choose a valid pickup date and time window.')
      return
    }
    if (end.getTime() <= start.getTime()) {
      setLocalError('Pickup end time must be later than the start time.')
      return
    }

    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
    if (weekday >= 1 && weekday <= 5 && startTime < '17:30') {
      setLocalError('Weekday pickup must start at or after 5:30 PM.')
      return
    }
    if (end.getTime() <= Date.now()) {
      setLocalError('Choose a pickup window that has not already passed.')
      return
    }

    setLocalError('')
    await onConfirm({
      pickupWindowStartAt: start.toISOString(),
      pickupWindowEndAt: end.toISOString(),
      pickupInstructions: instructions.trim() || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-3xl bg-white p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-neutral-900">Schedule pickup</p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-500">
              Confirm a practical pickup window. Weekday pickups should begin after 5:30 PM.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={updating}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-neutral-50 p-3">
          <p className="text-xs font-bold text-neutral-400">
            {request.parcelNo || 'Parcel Request'}
          </p>
          <p className="mt-1 text-sm font-bold text-neutral-900">
            {parcelTitle(request)}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {request.senderName || 'Customer'} · {request.pickupAddress || 'Pickup address'}
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="sm:col-span-1">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
              Pickup date
            </span>
            <input
              type="date"
              min={bhutanDateInputValue(new Date())}
              value={date}
              onChange={(event) => {
                setDate(event.target.value)
                setLocalError('')
              }}
              className="mt-2 h-11 w-full rounded-2xl border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </label>
          <label>
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
              From
            </span>
            <input
              type="time"
              value={startTime}
              onChange={(event) => {
                setStartTime(event.target.value)
                setLocalError('')
              }}
              className="mt-2 h-11 w-full rounded-2xl border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </label>
          <label>
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
              To
            </span>
            <input
              type="time"
              value={endTime}
              onChange={(event) => {
                setEndTime(event.target.value)
                setLocalError('')
              }}
              className="mt-2 h-11 w-full rounded-2xl border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {quickWindows.map((window) => (
            <button
              key={window.label}
              type="button"
              onClick={() => {
                setStartTime(window.start)
                setEndTime(window.end)
                setLocalError('')
              }}
              className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
            >
              {window.label}
            </button>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
            Customer instruction
          </span>
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            className="mt-2 h-24 w-full resize-none rounded-2xl border border-neutral-200 p-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
            placeholder="Please keep the parcel packed and your phone available."
          />
        </label>

        {localError && (
          <p className="mt-2 text-xs font-semibold text-red-600">{localError}</p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={updating}
            className="h-11 flex-1 rounded-2xl bg-neutral-100 text-sm font-bold text-neutral-700 disabled:opacity-50"
          >
            Not Now
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={updating}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-bold text-white disabled:opacity-60"
          >
            <Clock size={16} />
            {updating ? 'Scheduling...' : 'Confirm Window'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusReasonModal({
  request,
  status,
  updating,
  onClose,
  onConfirm,
}: {
  request: ParcelRequest
  status: ParcelRequestStatus
  updating: boolean
  onClose: () => void
  onConfirm: (note: string) => Promise<void>
}) {
  const [note, setNote] = useState(request.adminNotes || '')
  const [localError, setLocalError] = useState('')
  const isReject = status === 'rejected'
  const title = isReject ? 'Reject parcel request' : 'Cancel parcel request'
  const description = isReject
    ? 'Add a clear reason. This will be visible to the customer.'
    : 'Add a short note for the customer. Optional, but recommended.'

  async function submit() {
    const cleaned = note.trim()

    if (isReject && !cleaned) {
      setLocalError('Rejection reason is required.')
      return
    }

    setLocalError('')
    await onConfirm(cleaned)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-3xl bg-white p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-neutral-900">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-500">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={updating}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-neutral-50 p-3">
          <p className="text-xs font-bold text-neutral-400">
            {request.parcelNo || 'Parcel Request'}
          </p>
          <p className="mt-1 text-sm font-bold text-neutral-900">
            {parcelTitle(request)}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {request.senderName || 'Customer'} ·{' '}
            {request.senderPhone || request.contactNumber || 'Phone'}
          </p>
        </div>

        <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-neutral-600">
          {isReject ? 'Reason' : 'Note'}
        </label>
        <textarea
          value={note}
          onChange={(event) => {
            setNote(event.target.value)
            setLocalError('')
          }}
          placeholder={
            isReject
              ? 'Example: Parcel type is not allowed for this trip.'
              : 'Example: Trip cancelled due to a schedule change.'
          }
          className="mt-2 h-28 w-full resize-none rounded-2xl border border-neutral-200 p-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
        />

        {localError && (
          <p className="mt-2 text-xs font-semibold text-red-600">{localError}</p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={updating}
            className="h-11 flex-1 rounded-2xl bg-neutral-100 text-sm font-bold text-neutral-700 disabled:opacity-50"
          >
            Keep Request
          </button>

          <button
            type="button"
            onClick={submit}
            disabled={updating}
            className={`h-11 flex-1 rounded-2xl text-sm font-bold text-white disabled:opacity-60 ${
              isReject ? 'bg-rose-500' : 'bg-neutral-700'
            }`}
          >
            {updating ? 'Updating...' : isReject ? 'Reject' : 'Cancel Request'}
          </button>
        </div>
      </div>
    </div>
  )
}
