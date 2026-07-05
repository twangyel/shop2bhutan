import { useEffect, useMemo, useState } from 'react'
import { Check, Package, RefreshCw, Truck, XCircle } from 'lucide-react'
import {
  fetchAdminParcelRequests,
  updateParcelRequestStatus,
} from '@/lib/parcels'
import {
  parcelSizeLabels,
  parcelStatusLabels,
  parcelTypeLabels,
} from '@/types/parcel'
import type { ParcelRequest, ParcelRequestStatus } from '@/types/parcel'

const tabs: { key: 'all' | ParcelRequestStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'picked_up', label: 'Picked Up' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Cancelled' },
]

function formatDate(value?: string | null) {
  if (!value) return 'Not set'

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

function tripDisplayTitle(request: ParcelRequest) {
  const origin = request.trip?.origin || request.trip?.fromLocation || 'Thimphu'
  const destination =
    request.trip?.destination || request.trip?.toLocation || 'Phuentsholing'

  return `${origin} → ${destination}`
}

function nextStatuses(status: ParcelRequestStatus): ParcelRequestStatus[] {
  if (status === 'pending') return ['accepted', 'rejected', 'cancelled']

  if (status === 'accepted') return ['picked_up', 'cancelled']

  if (status === 'picked_up' || status === 'collected') {
    return ['in_transit', 'cancelled']
  }

  if (status === 'in_transit') return ['delivered', 'cancelled']

  return []
}

function actionLabel(status: ParcelRequestStatus) {
  if (status === 'accepted') return 'Accept Request'
  if (status === 'picked_up') return 'Mark Picked Up'
  if (status === 'in_transit') return 'Mark In Transit'
  if (status === 'delivered') return 'Mark Delivered'
  if (status === 'rejected') return 'Reject'
  if (status === 'cancelled') return 'Cancel'

  return parcelStatusLabels[status] || status
}

function actionClass(status: ParcelRequestStatus) {
  if (status === 'accepted') return 'bg-orange-500 hover:bg-orange-600'
  if (status === 'picked_up') return 'bg-blue-500 hover:bg-blue-600'
  if (status === 'in_transit') return 'bg-purple-500 hover:bg-purple-600'
  if (status === 'delivered') return 'bg-emerald-500 hover:bg-emerald-600'

  return 'bg-red-500 hover:bg-red-600'
}

export default function ParcelRequests() {
  const [requests, setRequests] = useState<ParcelRequest[]>([])
  const [filter, setFilter] = useState<'all' | ParcelRequestStatus>('all')
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState('')
  const [error, setError] = useState('')

  async function loadRequests() {
    try {
      setLoading(true)
      setError('')

      const rows = await fetchAdminParcelRequests()
      setRequests(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return requests
    return requests.filter((request) => request.status === filter)
  }, [filter, requests])

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

  async function changeStatus(
    request: ParcelRequest,
    status: ParcelRequestStatus,
  ) {
    let adminNotes: string | undefined

    if (status === 'rejected') {
      const reason = window.prompt(
        'Why is this parcel request rejected? This reason will be visible to the customer.',
        request.adminNotes || '',
      )

      if (reason === null) return

      if (!reason.trim()) {
        setError('Rejection reason is required.')
        return
      }

      adminNotes = reason.trim()
    }

    if (status === 'cancelled') {
      const reason = window.prompt(
        'Add cancellation note for the customer. Optional.',
        request.adminNotes || '',
      )

      if (reason === null) return

      adminNotes = reason.trim()
    }

    try {
      setUpdatingId(request.id)
      setError('')

      await updateParcelRequestStatus(request.id, status, adminNotes)
      await loadRequests()
      window.dispatchEvent(new CustomEvent('shop2bhutan:admin-parcels-updated'))
      window.dispatchEvent(new CustomEvent('shop2bhutan:parcels-updated'))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update parcel request.',
      )
    } finally {
      setUpdatingId('')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">
            Parcel Requests
          </h2>
          <p className="text-sm text-neutral-500">
            Manage customer parcel bookings and update pickup status.
          </p>
        </div>

        <button
          onClick={loadRequests}
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
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

      <div className="flex flex-wrap gap-2 rounded-2xl border border-neutral-100 bg-white p-2 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              filter === tab.key
                ? 'bg-orange-500 text-white'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {tab.label} ({counts[tab.key] ?? 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-neutral-100 bg-white p-8 text-center text-sm text-neutral-500">
          Loading parcel requests...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-neutral-100 bg-white p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
            <Package size={24} />
          </div>

          <p className="mt-3 text-sm font-semibold text-neutral-700">
            No parcel requests found
          </p>

          <p className="text-xs text-neutral-400">
            Customer parcel bookings will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((request) => (
            <ParcelRequestCard
              key={request.id}
              request={request}
              updating={updatingId === request.id}
              onChangeStatus={(status) => changeStatus(request, status)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ParcelRequestCard({
  request,
  updating,
  onChangeStatus,
}: {
  request: ParcelRequest
  updating: boolean
  onChangeStatus: (status: ParcelRequestStatus) => void
}) {
  const actions = nextStatuses(request.status)
  const title =
    request.packageDescription || request.description || 'Parcel request'

  return (
    <article className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
      <div className="grid gap-4 p-4 lg:grid-cols-[160px_1fr]">
        <div>
          {request.parcelPhotoUrl ? (
            <div className="space-y-2">
              <img
                src={request.parcelPhotoUrl}
                alt={title}
                className="h-36 w-full rounded-2xl border border-neutral-100 bg-neutral-100 object-cover"
              />

              <a
                href={request.parcelPhotoUrl}
                target="_blank"
                rel="noreferrer"
                className="block text-center text-xs font-bold text-orange-600 hover:text-orange-700"
              >
                View photo
              </a>
            </div>
          ) : (
            <div className="flex h-36 w-full items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
              <Package size={28} />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold text-neutral-400">
                {request.parcelNo || 'Parcel Request'}
              </p>

              <h3 className="mt-1 text-base font-bold text-neutral-900">
                {title}
              </h3>

              <p className="mt-1 text-xs text-neutral-500">
                Trip: {tripDisplayTitle(request)} ·{' '}
                {formatDate(request.trip?.goingDate)}
              </p>
            </div>

            <span
              className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(
                request.status,
              )}`}
            >
              {parcelStatusLabels[request.status] || request.status}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-emerald-50/70 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Pickup
              </p>

              <p className="mt-1 text-sm font-semibold text-neutral-900">
                {request.pickupAddress || 'Pickup address not provided'}
              </p>

              <p className="text-xs text-neutral-500">
                {request.senderName || 'Pickup contact'} ·{' '}
                {request.senderPhone || request.contactNumber || 'Phone'}
              </p>
            </div>

            <div className="rounded-2xl bg-orange-50/70 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-orange-700">
                Drop-off
              </p>

              <p className="mt-1 text-sm font-semibold text-neutral-900">
                {request.dropoffAddress || 'Drop-off address not provided'}
              </p>

              <p className="text-xs text-neutral-500">
                {request.receiverName || 'Receiver'} ·{' '}
                {request.receiverPhone || 'Phone'}
              </p>
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

            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
              {tripDisplayTitle(request)}
            </span>
          </div>

          {(request.customerNotes || request.instructions) && (
            <p className="mt-3 rounded-2xl bg-neutral-50 p-3 text-xs text-neutral-600">
              Customer note: {request.customerNotes || request.instructions}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {actions.length > 0 ? (
              actions.map((status) => (
                <button
                  key={status}
                  disabled={updating}
                  onClick={() => onChangeStatus(status)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white disabled:opacity-60 ${actionClass(
                    status,
                  )}`}
                >
                  {status === 'delivered' ? (
                    <Check size={14} />
                  ) : status === 'rejected' || status === 'cancelled' ? (
                    <XCircle size={14} />
                  ) : (
                    <Truck size={14} />
                  )}

                  {updating ? 'Updating...' : actionLabel(status)}
                </button>
              ))
            ) : (
              <span
                className={`rounded-xl px-3 py-2 text-xs font-bold ${statusClass(request.status)}`}
              >
                {request.status === 'delivered'
                  ? 'Completed'
                  : request.status === 'rejected'
                    ? 'Rejected'
                    : request.status === 'cancelled'
                      ? 'Cancelled'
                      : parcelStatusLabels[request.status] || request.status}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
