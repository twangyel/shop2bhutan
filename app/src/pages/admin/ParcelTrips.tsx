import { useEffect, useState } from 'react'
import { Calendar, Plus, RefreshCw, Truck } from 'lucide-react'
import {
  createParcelTrip,
  fetchAdminParcelTrips,
  updateParcelTripStatus,
} from '@/lib/parcels'
import type { ParcelTrip, ParcelTripStatus } from '@/types/parcel'
import { parcelTripStatusLabels } from '@/types/parcel'

function formatDate(value?: string | null) {
  if (!value) return 'Not set'

  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function statusClass(status?: ParcelTripStatus) {
  if (status === 'open') return 'bg-emerald-50 text-emerald-700'
  if (status === 'closed') return 'bg-amber-50 text-amber-700'
  if (status === 'completed') return 'bg-blue-50 text-blue-700'
  if (status === 'cancelled') return 'bg-red-50 text-red-700'
  return 'bg-neutral-100 text-neutral-600'
}

export default function ParcelTrips() {
  const [trips, setTrips] = useState<ParcelTrip[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    title: '',
    goingDate: '',
    bookingCutoffAt: '',
  })

  async function loadTrips() {
    try {
      setLoading(true)
      setError('')
      const rows = await fetchAdminParcelTrips()
      setTrips(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trips.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTrips()
  }, [])

  async function handleCreateTrip() {
    if (!form.goingDate) {
      setError('Trip date is required.')
      return
    }

    try {
      setSaving(true)
      setError('')

      await createParcelTrip({
        title: form.title,
        goingDate: form.goingDate,
        bookingCutoffAt: form.bookingCutoffAt || null,
        status: 'open',
      })

      setForm({
        title: '',
        goingDate: '',
        bookingCutoffAt: '',
      })

      setShowForm(false)
      await loadTrips()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trip.')
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(tripId: string, status: ParcelTripStatus) {
    try {
      setError('')
      await updateParcelTripStatus(tripId, status)
      await loadTrips()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update trip status.',
      )
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">
            Parcel Trips
          </h2>
          <p className="text-sm text-neutral-500">
            Admin-fixed Thimphu to Phuentsholing parcel trip dates.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadTrips}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          <button
            onClick={() => setShowForm((value) => !value)}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600"
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

      {showForm && (
        <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Trip Title
              </label>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
                placeholder="Thimphu to Phuentsholing"
                className="mt-1.5 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Trip Date
              </label>
              <input
                type="date"
                value={form.goingDate}
                onChange={(event) =>
                  setForm({ ...form, goingDate: event.target.value })
                }
                className="mt-1.5 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Booking Cutoff
              </label>
              <input
                type="datetime-local"
                value={form.bookingCutoffAt}
                onChange={(event) =>
                  setForm({ ...form, bookingCutoffAt: event.target.value })
                }
                className="mt-1.5 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
            Route is fixed for MVP: <b>Thimphu → Phuentsholing</b>. Customers
            can only book the trip dates created here.
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-700"
            >
              Cancel
            </button>

            <button
              onClick={handleCreateTrip}
              disabled={saving}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? 'Creating...' : 'Create Open Trip'}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
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
              Create your first trip date to open parcel booking.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
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
                {trips.map((trip) => (
                  <tr
                    key={trip.id}
                    className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-bold text-neutral-900">
                        {trip.title || trip.name || 'Parcel Trip'}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Admin fixed trip date
                      </p>
                    </td>

                    <td className="px-4 py-3 text-sm text-neutral-700">
                      {formatDate(trip.goingDate)}
                    </td>

                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-2 text-sm text-neutral-700">
                        <Truck size={15} />
                        {trip.origin || trip.fromLocation || 'Thimphu'} →{' '}
                        {trip.destination ||
                          trip.toLocation ||
                          'Phuentsholing'}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-sm font-semibold text-neutral-700">
                      {trip.requestCount ?? 0}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(
                          trip.status,
                        )}`}
                      >
                        {trip.status
                          ? parcelTripStatusLabels[trip.status]
                          : 'Draft'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {trip.status !== 'open' && (
                          <button
                            onClick={() => changeStatus(trip.id, 'open')}
                            className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                          >
                            Open
                          </button>
                        )}

                        {trip.status === 'open' && (
                          <button
                            onClick={() => changeStatus(trip.id, 'closed')}
                            className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100"
                          >
                            Close
                          </button>
                        )}

                        {trip.status !== 'completed' && (
                          <button
                            onClick={() =>
                              changeStatus(trip.id, 'completed')
                            }
                            className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100"
                          >
                            Complete
                          </button>
                        )}

                        {trip.status !== 'cancelled' && (
                          <button
                            onClick={() =>
                              changeStatus(trip.id, 'cancelled')
                            }
                            className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}