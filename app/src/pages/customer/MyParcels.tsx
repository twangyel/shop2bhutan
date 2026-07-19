import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useAppToast } from '@/components/shared/AppToast'
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
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
  parcelSizeLabels,
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

function formatShortDate(value?: string | null) {
  if (!value) return 'Date not fixed'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date not fixed'

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BHUTAN_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatDateTime(value?: string | null) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return `${date.toLocaleString('en-GB', {
    timeZone: BHUTAN_TIME_ZONE,
    day: 'numeric',
    month: 'short',
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

function formatCompactPickupWindow(request: ParcelRequest) {
  if (!request.pickupWindowStartAt || !request.pickupWindowEndAt) return ''

  const start = new Date(request.pickupWindowStartAt)
  const end = new Date(request.pickupWindowEndAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''

  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: BHUTAN_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(start)

  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: BHUTAN_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return `${date} · ${time.format(start)}–${time.format(end)}`
}

function statusClass(status: string) {
  const normalizedStatus = normalizeStatus(
    String(status || '')
      .trim()
      .toLowerCase(),
  )

  const classes: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    accepted: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
    pickup_scheduled:
      'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
    picked_up: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
    in_transit: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    out_for_delivery:
      'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200',
    delivered:
      'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    rejected: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
    cancelled:
      'bg-neutral-100 text-neutral-700 ring-1 ring-neutral-300',
  }

  return (
    classes[normalizedStatus] ||
    'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200'
  )
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
  const origin =
    request.trip?.origin || request.trip?.fromLocation || 'Pickup location'
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

function nextStepCopy(request: ParcelRequest) {
  const note = request.adminNotes?.trim()

  if (request.status === 'pending') {
    return {
      title: 'Waiting for review',
      message:
        'Shop2Bhutan will review your request and confirm whether it can be accepted for this trip.',
    }
  }

  if (request.status === 'accepted') {
    return {
      title: 'Pickup time will be confirmed',
      message:
        'Your request is accepted. Your evening pickup window will be shared separately.',
    }
  }

  if (request.status === 'pickup_scheduled') {
    return {
      title: 'Keep the parcel ready',
      message:
        request.pickupInstructions?.trim() ||
        'Keep the parcel packed and your phone available during the confirmed pickup window.',
    }
  }

  if (request.status === 'picked_up' || request.status === 'collected') {
    return {
      title: 'Parcel collected',
      message:
        'Your parcel has been collected and will be prepared for the scheduled trip.',
    }
  }

  if (request.status === 'in_transit') {
    return {
      title: 'Parcel is on the way',
      message:
        'Your parcel is travelling to the destination. You will receive another update after delivery.',
    }
  }

  if (request.status === 'delivered') {
    return {
      title: 'Delivery completed',
      message: 'Your parcel has been delivered successfully.',
    }
  }

  if (request.status === 'rejected') {
    return {
      title: 'Request not accepted',
      message: note || 'Please review the reason below or contact support for help.',
    }
  }

  if (request.status === 'cancelled') {
    return {
      title: 'Request cancelled',
      message: note || 'This parcel request is no longer active.',
    }
  }

  return {
    title: 'Parcel updated',
    message: 'Open the details below to review the latest parcel information.',
  }
}

function collapsedSummary(request: ParcelRequest) {
  const pickupWindow = formatCompactPickupWindow(request)
  if (pickupWindow) return pickupWindow

  if (request.status === 'pending') return 'Waiting for review'
  if (request.status === 'accepted') return 'Waiting for evening pickup window'
  if (request.status === 'picked_up' || request.status === 'collected') {
    return 'Parcel collected for the trip'
  }
  if (request.status === 'in_transit') return 'Parcel is on the way'
  if (request.status === 'delivered') return 'Delivery completed'
  if (request.status === 'rejected') return 'Request not accepted'
  if (request.status === 'cancelled') return 'Request cancelled'

  return `Trip: ${formatShortDate(request.trip?.goingDate)}`
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
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-500">
            Parcel tracking
          </p>

          <div className="mt-1 flex items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-black tracking-tight text-neutral-950">
                My Parcels
              </h1>
              <p className="mt-0.5 text-xs text-neutral-500">
                Simple pickup and delivery updates
              </p>
            </div>

            {!loading && requests.length > 0 && (
              <span className="shrink-0 rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-bold text-neutral-600">
                {requests.length} {requests.length === 1 ? 'parcel' : 'parcels'}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        {error && (
          <div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3">
            <p className="text-sm font-semibold text-rose-700">{error}</p>
            <button
              type="button"
              onClick={() => void loadParcels()}
              className="mt-2 text-xs font-bold text-rose-700 underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        )}

        {!authLoading && (!user || isGuest) && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <MapPin size={17} className="mt-0.5 shrink-0 text-neutral-500" />
            <p className="text-xs leading-5 text-neutral-600">
              Guest tracking is saved on this device only. Sign in later for
              permanent access across devices.
            </p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-32 animate-pulse rounded-[22px] bg-neutral-100"
              />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-3xl border border-neutral-200 bg-neutral-50 px-6 py-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-neutral-400 ring-1 ring-neutral-200">
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

                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-600">
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
                <div className="rounded-3xl border border-neutral-200 bg-neutral-50 px-4 py-6 text-center">
                  <CheckCircle2
                    size={24}
                    className="mx-auto text-neutral-500"
                  />
                  <p className="mt-2 text-sm font-bold text-neutral-800">
                    No active parcels
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Completed and closed requests are available below.
                  </p>
                </div>
              )}
            </section>

            {historyRequests.length > 0 && (
              <section className="rounded-3xl border border-neutral-200 bg-neutral-50 p-2">
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

type DetailSection = 'tracking' | 'contacts' | 'parcel' | null

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
  const [openSection, setOpenSection] = useState<DetailSection>(null)

  const displayStatus = normalizeStatus(request.status)
  const currentIndex = timeline.indexOf(
    displayStatus as (typeof timeline)[number],
  )
  const isException =
    request.status === 'cancelled' || request.status === 'rejected'
  const title =
    request.packageDescription || request.description || 'Parcel request'
  const currentEvent = latestStatusEvent(request, displayStatus)
  const nextStep = nextStepCopy(request)
  const eventCount = request.trackingEvents?.length ?? 0

  const toggleSection = (section: Exclude<DetailSection, null>) => {
    setOpenSection((current) => (current === section ? null : section))
  }

  const shareParcelUpdate = async () => {
    if (sharing) return

    setSharing(true)

    try {
      const status = parcelStatusLabels[request.status] || request.status
      const result = await shareTextContent({
        title: `Shop2Bhutan Parcel ${request.parcelNo || 'Update'}`,
        dialogTitle: 'Share parcel update',
        text: [
          `Shop2Bhutan Parcel ${request.parcelNo || 'Request'}`,
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
    <article className="overflow-hidden rounded-[22px] border border-neutral-200 bg-white shadow-[0_5px_18px_rgba(15,23,42,0.035)]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-3 text-left transition active:bg-neutral-50"
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3">
          {request.parcelPhotoUrl ? (
            <img
              src={request.parcelPhotoUrl}
              alt={title}
              className="h-14 w-14 shrink-0 rounded-2xl bg-neutral-100 object-cover ring-1 ring-neutral-200"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500 ring-1 ring-neutral-200">
              <Package size={21} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-400">
                {request.parcelNo || 'Parcel Request'}
              </p>

              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass(
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

            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-neutral-500">
                {request.pickupWindowStartAt ? (
                  <Clock size={13} className="shrink-0 text-orange-500" />
                ) : (
                  <Calendar size={13} className="shrink-0 text-neutral-400" />
                )}
                <span className="truncate">{collapsedSummary(request)}</span>
              </p>

              <ChevronDown
                size={17}
                className={`shrink-0 text-neutral-400 transition-transform ${
                  expanded ? 'rotate-180' : ''
                }`}
              />
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-neutral-100 px-3 pb-4 pt-3">
          <section
            className={`rounded-2xl border px-3 py-3 ${
              isException
                ? request.status === 'rejected'
                  ? 'border-rose-100 bg-rose-50'
                  : 'border-neutral-200 bg-neutral-50'
                : 'border-neutral-200 bg-neutral-50'
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
              What happens next
            </p>
            <p className="mt-1 text-sm font-black text-neutral-900">
              {nextStep.title}
            </p>
            <p className="mt-1 text-xs leading-5 text-neutral-600">
              {nextStep.message}
            </p>
            {currentEvent?.createdAt && (
              <p className="mt-2 text-[10px] font-medium text-neutral-400">
                Updated {formatDateTime(currentEvent.createdAt)}
              </p>
            )}
          </section>

          {request.pickupWindowStartAt && request.pickupWindowEndAt ? (
            <section className="mt-3 rounded-2xl border border-orange-100 bg-orange-50/60 p-3">
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-orange-600 ring-1 ring-orange-100">
                  <Clock size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-orange-600">
                    Confirmed pickup window
                  </p>
                  <p className="mt-1 text-sm font-black leading-5 text-neutral-950">
                    {formatPickupWindow(request)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-neutral-600">
                    {request.pickupInstructions ||
                      'Please keep the parcel packed and your phone available.'}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="mt-3 grid grid-cols-2 divide-x divide-neutral-200 rounded-2xl border border-neutral-200 bg-white px-3 py-2.5">
            <div className="pr-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                Route
              </p>
              <p className="mt-1 line-clamp-2 text-xs font-bold text-neutral-800">
                {routeTitle(request)}
              </p>
            </div>
            <div className="pl-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                Trip date
              </p>
              <p className="mt-1 line-clamp-2 text-xs font-bold text-neutral-800">
                {formatDate(request.trip?.goingDate)}
              </p>
            </div>
          </section>

          <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <AccordionButton
              title="Tracking history"
              subtitle={`${eventCount} ${eventCount === 1 ? 'update' : 'updates'}`}
              open={openSection === 'tracking'}
              onClick={() => toggleSection('tracking')}
            />

            {openSection === 'tracking' && (
              <div className="border-t border-neutral-100 px-3 py-3">
                {isException ? (
                  <p className="text-sm font-semibold text-neutral-700">
                    {parcelStatusLabels[request.status] || request.status}
                  </p>
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
                              className={`absolute left-[11px] top-6 h-full w-px ${
                                currentIndex > index
                                  ? 'bg-neutral-400'
                                  : 'bg-neutral-200'
                              }`}
                            />
                          )}

                          <div
                            className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                              isCurrent
                                ? 'bg-orange-500 text-white ring-4 ring-orange-100'
                                : done
                                  ? 'bg-neutral-800 text-white'
                                  : 'bg-neutral-100 text-neutral-400'
                            }`}
                          >
                            {done ? (
                              <CheckCircle2 size={13} />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1 pt-0.5">
                            <p
                              className={`text-xs font-bold ${
                                done ? 'text-neutral-900' : 'text-neutral-400'
                              }`}
                            >
                              {parcelStatusLabels[status] || status}
                            </p>

                            {event?.createdAt && (
                              <p className="mt-0.5 text-[10px] font-medium text-neutral-400">
                                {formatDateTime(event.createdAt)}
                              </p>
                            )}

                            {event?.message && isCurrent && (
                              <p className="mt-1 text-xs leading-5 text-neutral-500">
                                {event.message}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <AccordionButton
              title="Pickup & delivery details"
              open={openSection === 'contacts'}
              onClick={() => toggleSection('contacts')}
            />

            {openSection === 'contacts' && (
              <div className="border-t border-neutral-100 px-3 py-3">
                <DetailBlock
                  label="Pickup"
                  address={request.pickupAddress || 'Pickup address'}
                  name={request.senderName || 'Pickup contact'}
                  phone={request.senderPhone || request.contactNumber || 'Phone'}
                />
                <div className="my-3 h-px bg-neutral-100" />
                <DetailBlock
                  label="Drop-off"
                  address={request.dropoffAddress || 'Drop-off address'}
                  name={request.receiverName || 'Receiver'}
                  phone={request.receiverPhone || 'Phone'}
                />
              </div>
            )}

            <AccordionButton
              title="Parcel information"
              open={openSection === 'parcel'}
              onClick={() => toggleSection('parcel')}
            />

            {openSection === 'parcel' && (
              <div className="border-t border-neutral-100 px-3 py-3">
                <dl className="grid grid-cols-2 gap-3">
                  <InfoItem
                    label="Parcel type"
                    value={
                      request.parcelType
                        ? parcelTypeLabels[request.parcelType] || request.parcelType
                        : 'Not specified'
                    }
                  />
                  <InfoItem
                    label="Parcel size"
                    value={
                      request.parcelSize
                        ? parcelSizeLabels[request.parcelSize] || request.parcelSize
                        : 'Not specified'
                    }
                  />
                </dl>

                {request.parcelPhotoUrl && (
                  <a
                    href={request.parcelPhotoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700"
                  >
                    <ImageIcon size={14} />
                    View parcel photo
                  </a>
                )}

                {request.adminNotes && (
                  <div
                    className={`mt-3 rounded-xl border p-3 text-xs ${
                      request.status === 'rejected'
                        ? 'border-rose-100 bg-rose-50 text-rose-700'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-700'
                    }`}
                  >
                    <p className="font-bold">
                      {request.status === 'rejected'
                        ? 'Rejection reason'
                        : request.status === 'cancelled'
                          ? 'Cancellation note'
                          : 'Shop2Bhutan note'}
                    </p>
                    <p className="mt-1 leading-5">{request.adminNotes}</p>
                  </div>
                )}

                {(request.customerNotes || request.instructions) && (
                  <div className="mt-3 rounded-xl bg-neutral-50 p-3 text-xs leading-5 text-neutral-600">
                    <span className="font-bold">Your note:</span>{' '}
                    {request.customerNotes || request.instructions}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void shareParcelUpdate()}
              disabled={sharing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-600 transition active:scale-95 disabled:cursor-wait disabled:opacity-60"
            >
              {sharing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Share2 size={14} />
              )}
              Share update
            </button>

            {isException && (
              <a
                href="/support"
                className="inline-flex items-center gap-1.5 rounded-xl bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700 ring-1 ring-orange-100"
              >
                <HelpCircle size={14} />
                Get help
              </a>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

function AccordionButton({
  title,
  subtitle,
  open,
  onClick,
}: {
  title: string
  subtitle?: string
  open: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 border-t border-neutral-100 px-3 py-3 text-left first:border-t-0 transition active:bg-neutral-50"
      aria-expanded={open}
    >
      <div>
        <p className="text-sm font-bold text-neutral-900">{title}</p>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-neutral-500">{subtitle}</p>
        )}
      </div>
      <ChevronDown
        size={17}
        className={`shrink-0 text-neutral-400 transition-transform ${
          open ? 'rotate-180' : ''
        }`}
      />
    </button>
  )
}

function DetailBlock({
  label,
  address,
  name,
  phone,
}: {
  label: string
  address: string
  name: string
  phone: string
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-neutral-900">{address}</p>
      <p className="mt-1 text-xs text-neutral-500">
        {name} · {phone}
      </p>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
        {label}
      </dt>
      <dd className="mt-1 text-xs font-bold text-neutral-800">{value}</dd>
    </div>
  )
}
