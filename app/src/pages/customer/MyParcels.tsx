import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useAppToast } from '@/components/shared/AppToast'
import {
  Calendar,
  CheckCircle2,
  Clock,
  ChevronDown,
  HelpCircle,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Package,
  Share2,
} from 'lucide-react'
import { fetchMyParcelRequests } from '@/lib/parcels'
import { shareTextContent } from '@/lib/nativeShare'
import {
  parcelStatusLabels,
  parcelTypeLabels,
} from '@/types/parcel'
import type { ParcelRequest } from '@/types/parcel'

const timeline = [
  'pending',
  'accepted',
  'pickup_scheduled',
  'picked_up',
  'in_transit',
  'delivered',
] as const

const BHUTAN_TIME_ZONE = 'Asia/Thimphu'

function formatDate(value?: string | null) {
  if (!value) return 'Date not fixed'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date not fixed'

  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value?: string | null) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return `${date.toLocaleString('en-GB', {
    timeZone: BHUTAN_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })} BTT`
}

function formatPickupWindow(request: ParcelRequest) {
  if (!request.pickupWindowStartAt || !request.pickupWindowEndAt) return ''

  const start = new Date(request.pickupWindowStartAt)
  const end = new Date(request.pickupWindowEndAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''

  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: BHUTAN_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(start)
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: BHUTAN_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return `${date}, ${time.format(start)}–${time.format(end)}`
}

function statusClass(status: string) {
  if (status === 'pending') {
    return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
  }

  if (status === 'accepted') {
    return 'bg-orange-50 text-orange-700 ring-1 ring-orange-100'
  }

  if (status === 'pickup_scheduled') {
    return 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
  }

  if (status === 'picked_up' || status === 'collected') {
    return 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
  }

  if (status === 'in_transit') {
    return 'bg-violet-50 text-violet-700 ring-1 ring-violet-100'
  }

  if (status === 'delivered') {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
  }

  if (status === 'rejected') {
    return 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
  }

  if (status === 'cancelled') {
    return 'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200'
  }

  return 'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200'
}

function normalizeStatus(status: string) {
  if (status === 'collected') return 'picked_up'
  return status
}

const activeParcelStatuses = new Set([
  'pending',
  'accepted',
  'pickup_scheduled',
  'picked_up',
  'collected',
  'in_transit',
])

function routeTitle(request: ParcelRequest) {
  const origin = request.trip?.origin || request.trip?.fromLocation || 'Pickup location'
  const destination =
    request.trip?.destination ||
    request.trip?.toLocation ||
    'Drop-off location'

  return `${origin} → ${destination}`
}

function latestStatusEvent(request: ParcelRequest, status: string) {
  return [...(request.trackingEvents ?? [])]
    .filter((event) => normalizeStatus(event.status) === status)
    .sort(
      (a, b) =>
        (new Date(b.createdAt).getTime() || 0) -
        (new Date(a.createdAt).getTime() || 0),
    )[0]
}

export default function MyParcels() {
  const navigate = useNavigate()
  const { showToast } = useAppToast()
  const { user, loading: authLoading, isGuest } = useAuth()

  const [requests, setRequests] = useState<ParcelRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null)

  useEffect(() => {
    if (!error) return

    showToast({
      type: 'error',
      title: 'Unable to load parcels',
      message: error,
    })
  }, [error, showToast])

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
    void loadParcels()
  }, [])

  const activeRequests = requests.filter((request) =>
    activeParcelStatuses.has(request.status),
  )

  const historyRequests = requests.filter(
    (request) => !activeParcelStatuses.has(request.status),
  )

  const toggleRequest = (requestId: string) => {
    setExpandedRequestId((current) =>
      current === requestId ? null : requestId,
    )
  }

  const toggleHistory = () => {
    if (historyOpen) {
      const expandedIsHistory = historyRequests.some(
        (request) => request.id === expandedRequestId,
      )
      if (expandedIsHistory) setExpandedRequestId(null)
    }

    setHistoryOpen((open) => !open)
  }

  return (
    <div className="min-h-screen bg-white pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 border-b border-neutral-100 bg-white/95 backdrop-blur">
        <div className="px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-orange-500">
            Parcel tracking
          </p>
          <div className="mt-0.5 flex items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-black tracking-tight text-neutral-950">
                My Parcels
              </h1>
              <p className="mt-0.5 text-xs text-neutral-500">
                Track every pickup and delivery update
              </p>
            </div>

            {!loading && requests.length > 0 && (
              <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-bold text-neutral-600">
                {requests.length} {requests.length === 1 ? 'parcel' : 'parcels'}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        {error && (
          <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
            <p className="text-sm font-semibold text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => void loadParcels()}
              className="mt-2 text-xs font-bold text-red-700 underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        )}

        {!authLoading && (!user || isGuest) && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
            <MapPin size={17} className="mt-0.5 shrink-0 text-blue-500" />
            <p className="text-xs leading-5 text-blue-700">
              Guest parcel tracking is saved on this device only. Sign in later
              for permanent access across devices.
            </p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-36 animate-pulse rounded-[22px] bg-neutral-100"
              />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-3xl border border-neutral-100 bg-neutral-50 px-6 py-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-neutral-400 ring-1 ring-neutral-100">
              <Package size={27} />
            </div>

            <h2 className="mt-4 text-base font-black text-neutral-900">
              No parcels yet
            </h2>

            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-neutral-500">
              Book a parcel whenever an available route across Bhutan is open.
            </p>

            <button
              type="button"
              onClick={() => navigate('/parcel')}
              className="mt-5 h-11 rounded-2xl bg-orange-500 px-5 text-sm font-bold text-white transition active:scale-[0.98]"
            >
              Book a Parcel
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-neutral-900">
                    Active Parcels
                  </h2>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Current requests and deliveries
                  </p>
                </div>

                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700">
                  {activeRequests.length} active
                </span>
              </div>

              {activeRequests.length > 0 ? (
                <div className="space-y-3">
                  {activeRequests.map((request) => (
                    <ParcelCard
                      key={request.id}
                      request={request}
                      expanded={expandedRequestId === request.id}
                      onToggle={() => toggleRequest(request.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-neutral-100 bg-neutral-50 px-4 py-6 text-center">
                  <CheckCircle2
                    size={24}
                    className="mx-auto text-emerald-500"
                  />
                  <p className="mt-2 text-sm font-bold text-neutral-800">
                    No active parcels
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Your completed and closed requests are available below.
                  </p>
                </div>
              )}
            </section>

            {historyRequests.length > 0 && (
              <section className="rounded-3xl border border-neutral-100 bg-neutral-50 p-2">
                <button
                  type="button"
                  onClick={toggleHistory}
                  className="flex w-full items-center justify-between gap-3 rounded-[1.25rem] bg-white px-4 py-3 text-left ring-1 ring-neutral-100 transition active:scale-[0.99]"
                >
                  <div>
                    <h2 className="text-sm font-black text-neutral-900">
                      Parcel History
                    </h2>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {historyRequests.length} completed or closed{' '}
                      {historyRequests.length === 1 ? 'request' : 'requests'}
                    </p>
                  </div>

                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                    <ChevronDown
                      size={17}
                      className={`transition-transform ${
                        historyOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </span>
                </button>

                {historyOpen && (
                  <div className="space-y-3 px-1 pb-1 pt-3">
                    {historyRequests.map((request) => (
                      <ParcelCard
                        key={request.id}
                        request={request}
                        expanded={expandedRequestId === request.id}
                        onToggle={() => toggleRequest(request.id)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function ParcelCard({
  request,
  expanded,
  onToggle,
}: {
  request: ParcelRequest
  expanded: boolean
  onToggle: () => void
}) {
  const { showToast } = useAppToast()
  const [sharing, setSharing] = useState(false)

  const displayStatus = normalizeStatus(request.status)
  const currentIndex = timeline.indexOf(
    displayStatus as (typeof timeline)[number],
  )
  const isException =
    request.status === 'cancelled' || request.status === 'rejected'
  const needsHelp = isException
  const title =
    request.packageDescription || request.description || 'Parcel request'
  const currentEvent = latestStatusEvent(request, displayStatus)
  const progressPercent = isException
    ? 100
    : Math.max(
        12,
        Math.round(
          ((Math.max(0, currentIndex) + 1) / timeline.length) * 100,
        ),
      )

  const shareParcelUpdate = async () => {
    if (sharing) return

    setSharing(true)

    try {
      const status =
        parcelStatusLabels[request.status] || request.status
      const result = await shareTextContent({
        title: `Shop2Bhutan Parcel ${
          request.parcelNo || 'Update'
        }`,
        dialogTitle: 'Share parcel update',
        text: [
          `Shop2Bhutan Parcel ${
            request.parcelNo || 'Request'
          }`,
          `Route: ${routeTitle(request)}`,
          `Trip date: ${formatDate(request.trip?.goingDate)}`,
          `Status: ${status}`,
          ...(formatPickupWindow(request)
            ? [`Pickup: ${formatPickupWindow(request)}`]
            : []),
          '',
          'Open Shop2Bhutan to view the complete private details.',
        ].join('\n'),
      })

      if (result === 'copied') {
        showToast({
          type: 'success',
          title: 'Parcel update copied',
          message: 'The parcel status is ready to paste and share.',
        })
      }
    } catch (shareError) {
      console.warn('Unable to share parcel update:', shareError)
      showToast({
        type: 'error',
        title: 'Unable to share',
        message: 'The parcel update could not be shared right now.',
      })
    } finally {
      setSharing(false)
    }
  }

  return (
    <article className="overflow-hidden rounded-[22px] border border-neutral-100 bg-white shadow-[0_5px_18px_rgba(15,23,42,0.035)]">
      <div className="p-3">
        <div className="flex items-start gap-3">
          {request.parcelPhotoUrl ? (
            <img
              src={request.parcelPhotoUrl}
              alt={title}
              className="h-[52px] w-[52px] shrink-0 rounded-2xl bg-neutral-100 object-cover ring-1 ring-neutral-200"
            />
          ) : (
            <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <Package size={21} />
            </div>
          )}

          <button
            type="button"
            onClick={onToggle}
            className="min-w-0 flex-1 text-left"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.1em] text-neutral-400">
                {request.parcelNo || 'Parcel Request'}
              </p>

              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${statusClass(
                  request.status,
                )}`}
              >
                {parcelStatusLabels[request.status] || request.status}
              </span>
            </div>

            <h3 className="mt-1 truncate text-sm font-black text-neutral-950">
              {title}
            </h3>

            <p className="mt-1 truncate text-xs font-semibold text-neutral-600">
              {routeTitle(request)}
            </p>

            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-500">
              <Calendar size={12} className="shrink-0 text-neutral-400" />
              <span className="truncate">
                {formatDate(request.trip?.goingDate)}
              </span>
            </p>
          </button>

          <div className="flex shrink-0 flex-col gap-2">
            <button
              type="button"
              onClick={onToggle}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-50 text-neutral-600 ring-1 ring-neutral-100 transition active:scale-95"
              aria-label={expanded ? 'Hide parcel details' : 'View parcel details'}
            >
              <ChevronDown
                size={16}
                className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            </button>

            <button
              type="button"
              onClick={() => void shareParcelUpdate()}
              disabled={sharing}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition active:scale-95 disabled:cursor-wait disabled:opacity-60"
              aria-label="Share parcel update"
              title="Share parcel update"
            >
              {sharing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Share2 size={14} strokeWidth={2.3} />
              )}
            </button>
          </div>
        </div>

        {!isException ? (
          <button
            type="button"
            onClick={onToggle}
            className="mt-3 w-full rounded-2xl bg-neutral-50 px-3 py-2.5 text-left ring-1 ring-neutral-100 transition active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">
                  Current status
                </p>
                <p className="mt-0.5 truncate text-xs font-black text-neutral-800">
                  {parcelStatusLabels[request.status] || request.status}
                </p>
              </div>

              <span className="text-[10px] font-bold text-neutral-400">
                {progressPercent}%
              </span>
            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-neutral-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className={`mt-3 flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left ${statusClass(
              request.status,
            )}`}
          >
            <span className="text-xs font-black">
              {parcelStatusLabels[request.status] || request.status}
            </span>
            <ChevronDown
              size={15}
              className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>

      {expanded && (
        <div className="border-t border-neutral-100 px-3 pb-4 pt-3">
          <div className="rounded-2xl bg-neutral-50 px-3 py-3 ring-1 ring-neutral-100">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-400">
                  Latest update
                </p>
                <p className="mt-1 text-sm font-black text-neutral-900">
                  {parcelStatusLabels[request.status] || request.status}
                </p>
                {currentEvent && (
                  <p className="mt-1 text-xs leading-5 text-neutral-500">
                    {currentEvent.message ||
                      `Updated ${formatDateTime(currentEvent.createdAt)}`}
                  </p>
                )}
              </div>

              {!isException && (
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-100">
                  {progressPercent}% complete
                </span>
              )}
            </div>
          </div>

          {request.pickupWindowStartAt && request.pickupWindowEndAt ? (
            <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
              <div className="flex items-start gap-2.5">
                <Clock size={16} className="mt-0.5 shrink-0 text-blue-600" />
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-500">
                    Confirmed pickup window
                  </p>
                  <p className="mt-1 text-sm font-black leading-5 text-blue-950">
                    {formatPickupWindow(request)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-blue-700">
                    {request.pickupInstructions ||
                      'Please keep the parcel packed and your phone available.'}
                  </p>
                </div>
              </div>
            </div>
          ) : request.status === 'accepted' ? (
            <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-700">
              Your request is accepted. Shop2Bhutan will confirm your evening pickup window separately.
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-2 divide-x divide-neutral-200 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-neutral-100">
            <div className="pr-3">
              <p className="text-[9px] font-black uppercase tracking-wider text-neutral-400">
                Route
              </p>
              <p className="mt-1 line-clamp-2 text-xs font-bold text-neutral-800">
                {routeTitle(request)}
              </p>
            </div>
            <div className="pl-3">
              <p className="text-[9px] font-black uppercase tracking-wider text-neutral-400">
                Trip date
              </p>
              <p className="mt-1 line-clamp-2 text-xs font-bold text-neutral-800">
                {formatDate(request.trip?.goingDate)}
              </p>
            </div>
          </div>

          {request.parcelType && (
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-blue-50 px-3 py-2.5 ring-1 ring-blue-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-500">
                Parcel type
              </span>
              <span className="text-xs font-black text-blue-700">
                {parcelTypeLabels[request.parcelType] || request.parcelType}
              </span>
            </div>
          )}

          <div className="mt-3 rounded-2xl border border-neutral-100 p-3">
            <div className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <span className="h-3 w-3 rounded-full bg-emerald-500" />
                <span className="h-12 w-px bg-neutral-200" />
                <span className="h-3 w-3 rounded-full bg-orange-500" />
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    Pickup
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-neutral-900">
                    {request.pickupAddress || 'Pickup address'}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {request.senderName || 'Pickup contact'} ·{' '}
                    {request.senderPhone || request.contactNumber || 'Phone'}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    Drop-off
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-neutral-900">
                    {request.dropoffAddress || 'Drop-off address'}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {request.receiverName || 'Receiver'} ·{' '}
                    {request.receiverPhone || 'Phone'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {request.parcelPhotoUrl && (
            <a
              href={request.parcelPhotoUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"
            >
              <ImageIcon size={14} />
              View parcel photo
            </a>
          )}

          <div className="mt-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.12em] text-neutral-400">
              Tracking journey
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
              <div>
                {timeline.map((status, index) => {
                  const done = currentIndex >= index
                  const isCurrent = currentIndex === index
                  const event = latestStatusEvent(request, status)

                  return (
                    <div
                      key={status}
                      className="relative flex gap-3 pb-4 last:pb-0"
                    >
                      {index < timeline.length - 1 && (
                        <span
                          className={`absolute left-[13px] top-7 h-full w-px ${
                            currentIndex > index
                              ? 'bg-emerald-200'
                              : 'bg-neutral-200'
                          }`}
                        />
                      )}

                      <div
                        className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          done
                            ? isCurrent
                              ? 'bg-orange-500 text-white ring-4 ring-orange-100'
                              : 'bg-emerald-500 text-white'
                            : 'bg-neutral-100 text-neutral-400'
                        }`}
                      >
                        {done ? (
                          <CheckCircle2 size={15} />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-current" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 pt-0.5">
                        <p
                          className={`text-sm font-bold ${
                            done ? 'text-neutral-900' : 'text-neutral-400'
                          }`}
                        >
                          {parcelStatusLabels[status] || status}
                        </p>

                        {event && (
                          <>
                            <p className="mt-0.5 text-[11px] font-medium text-neutral-400">
                              {formatDateTime(event.createdAt)}
                            </p>
                            {event.message && (
                              <p className="mt-1 text-xs leading-5 text-neutral-500">
                                {event.message}
                              </p>
                            )}
                          </>
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
              className={`mt-4 rounded-2xl border p-3 text-xs ${
                request.status === 'rejected'
                  ? 'border-rose-100 bg-rose-50 text-rose-700'
                  : request.status === 'cancelled'
                    ? 'border-neutral-200 bg-neutral-50 text-neutral-700'
                    : 'border-amber-100 bg-amber-50 text-amber-700'
              }`}
            >
              <p className="font-bold">
                {request.status === 'rejected'
                  ? 'Rejection Reason'
                  : request.status === 'cancelled'
                    ? 'Cancellation Note'
                    : 'Admin Note'}
              </p>
              <p className="mt-1 leading-5">{request.adminNotes}</p>
            </div>
          )}

          {(request.customerNotes || request.instructions) && (
            <p className="mt-3 rounded-2xl bg-neutral-50 p-3 text-xs leading-5 text-neutral-600">
              <span className="font-bold">Your note:</span>{' '}
              {request.customerNotes || request.instructions}
            </p>
          )}

          {needsHelp && (
            <a
              href="/support"
              className="mt-3 inline-flex items-center gap-1.5 rounded-2xl bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700"
            >
              <HelpCircle size={14} />
              Need help with this parcel?
            </a>
          )}
        </div>
      )}
    </article>
  )
}
