import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CarFront,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Fuel,
  Link2,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  Route,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Utensils,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppToast } from '@/components/shared/AppToast';
import { fetchAdminOrders } from '@/lib/customerOrders';
import { fetchAdminParcelTrips } from '@/lib/parcels';
import {
  createBusinessExpense,
  createBusinessTrip,
  deleteBusinessExpense,
  deleteBusinessTrip,
  estimatedOrderContribution,
  fetchBusinessFinanceData,
  linkOrderToBusinessTrip,
  unlinkOrderFromBusinessTrip,
  updateBusinessTripStatus,
} from '@/lib/businessFinance';
import type { Order } from '@/types';
import type { ParcelTrip } from '@/types/parcel';
import type {
  BusinessExpenseCategory,
  BusinessFinanceData,
  BusinessTripStatus,
} from '@/types/businessFinance';

const EXPENSE_CATEGORIES: Array<{
  value: BusinessExpenseCategory;
  label: string;
}> = [
  { value: 'fuel', label: 'Fuel' },
  { value: 'meals', label: 'Meals' },
  { value: 'tolls', label: 'Tolls / Parking' },
  { value: 'porter', label: 'Porter / Handling' },
  { value: 'refunds', label: 'Refunds' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'delivery', label: 'Local Delivery' },
  { value: 'miscellaneous', label: 'Miscellaneous' },
];

const TRIP_STATUS_LABELS: Record<BusinessTripStatus, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function currentMonthValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function money(value: number) {
  return `Nu. ${Math.round(Number(value || 0)).toLocaleString()}`;
}

function formatDate(value?: string) {
  if (!value) return 'Date not set';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function tripRoute(trip: ParcelTrip) {
  const from =
    trip.origin ||
    trip.originLocation?.name ||
    trip.fromLocation ||
    'Pickup location';
  const to =
    trip.destination ||
    trip.destinationLocation?.name ||
    trip.toLocation ||
    'Drop-off location';

  return `${from} → ${to}`;
}

function orderNumber(order: Order) {
  return order.orderNumber || order.id.slice(0, 8).toUpperCase();
}

function orderCustomer(order: Order) {
  return (
    order.user?.name ||
    order.shippingAddress?.recipientName ||
    order.user?.phone ||
    'Customer'
  );
}

function errorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const lower = message.toLowerCase();

  if (
    lower.includes('business_trips') ||
    lower.includes('business_expenses') ||
    lower.includes('business_trip_orders') ||
    lower.includes('schema cache')
  ) {
    return 'Business Finance tables are not installed yet. Run the Phase 3A SQL in Supabase, then refresh this page.';
  }

  return message;
}

function statusClass(status: BusinessTripStatus) {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700';
  if (status === 'in_progress') return 'bg-blue-50 text-blue-700';
  if (status === 'cancelled') return 'bg-neutral-100 text-neutral-500';
  return 'bg-amber-50 text-amber-700';
}

export default function BusinessFinance() {
  const { user } = useAuth();
  const toast = useAppToast();

  const [month, setMonth] = useState(currentMonthValue());
  const [data, setData] = useState<BusinessFinanceData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [parcelTrips, setParcelTrips] = useState<ParcelTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [pageError, setPageError] = useState('');

  const [showTripForm, setShowTripForm] = useState(false);
  const [tripForm, setTripForm] = useState({
    title: 'Thimphu–Phuentsholing business trip',
    route: 'Thimphu → Phuentsholing',
    tripDate: todayValue(),
    expectedContribution: 6000,
    estimatedCost: 3000,
    notes: '',
    parcelTripId: '',
  });

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    expenseDate: todayValue(),
    category: 'fuel' as BusinessExpenseCategory,
    amount: 2000,
    description: 'Fuel',
    businessTripId: '',
    orderId: '',
  });

  const [showOrderLinkForm, setShowOrderLinkForm] = useState(false);
  const [linkForm, setLinkForm] = useState({
    businessTripId: '',
    orderId: '',
    contributionAmount: 0,
    notes: '',
  });

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setPageError('');

      try {
        const [financeData, realOrders, realParcelTrips] = await Promise.all([
          fetchBusinessFinanceData(month),
          fetchAdminOrders(),
          fetchAdminParcelTrips(),
        ]);

        setData(financeData);
        setOrders(realOrders);
        setParcelTrips(realParcelTrips);
      } catch (error) {
        console.error('[BusinessFinance] load failed:', error);
        setPageError(
          errorMessage(error, 'Unable to load business finance data.'),
        );
      } finally {
        setLoading(false);
      }
    },
    [month],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const linkedOrderIds = useMemo(
    () => new Set((data?.tripOrders ?? []).map((link) => link.orderId)),
    [data?.tripOrders],
  );

  const contributionOrders = useMemo(
    () =>
      orders
        .filter(
          (order) =>
            order.status !== 'cancelled' &&
            Boolean(order.quotation) &&
            estimatedOrderContribution(order) > 0,
        )
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt).getTime() -
            new Date(a.updatedAt || a.createdAt).getTime(),
        ),
    [orders],
  );

  const selectedLinkOrder = contributionOrders.find(
    (order) => order.id === linkForm.orderId,
  );

  const monthExpenses = useMemo(
    () =>
      (data?.expenses ?? []).filter((expense) =>
        expense.expenseDate.startsWith(month),
      ),
    [data?.expenses, month],
  );

  const plannedRiskTrips = useMemo(
    () =>
      (data?.trips ?? []).filter(
        (trip) =>
          trip.status === 'planned' &&
          trip.tripDate.startsWith(month) &&
          trip.isAtRisk,
      ),
    [data?.trips, month],
  );

  const refresh = async () => {
    setBusyAction('refresh');
    await loadData(true);
    setBusyAction('');
  };

  const handleParcelTripSelection = (parcelTripId: string) => {
    const selected = parcelTrips.find((trip) => trip.id === parcelTripId);

    setTripForm((current) => ({
      ...current,
      parcelTripId,
      route: selected ? tripRoute(selected) : current.route,
      tripDate: selected?.goingDate || current.tripDate,
      title: selected?.title || selected?.name || current.title,
    }));
  };

  const saveTrip = async () => {
    if (!tripForm.title.trim() || !tripForm.route.trim() || !tripForm.tripDate) {
      toast.warning(
        'Trip details incomplete',
        'Add a title, route, and trip date before saving.',
      );
      return;
    }

    setBusyAction('create-trip');

    try {
      await createBusinessTrip({
        ...tripForm,
        createdBy: user?.id,
      });
      toast.success(
        'Business trip created',
        'The trip is ready for order assignment and expense tracking.',
      );
      setShowTripForm(false);
      setTripForm((current) => ({
        ...current,
        tripDate: todayValue(),
        notes: '',
        parcelTripId: '',
      }));
      await loadData(true);
    } catch (error) {
      toast.error(
        'Unable to create trip',
        errorMessage(error, 'The business trip could not be saved.'),
      );
    } finally {
      setBusyAction('');
    }
  };

  const changeTripStatus = async (
    tripId: string,
    status: BusinessTripStatus,
  ) => {
    setBusyAction(`trip-status:${tripId}`);

    try {
      await updateBusinessTripStatus(tripId, status);
      toast.success(
        'Trip status updated',
        `The trip is now ${TRIP_STATUS_LABELS[status].toLowerCase()}.`,
      );
      await loadData(true);
    } catch (error) {
      toast.error(
        'Unable to update trip',
        errorMessage(error, 'The trip status could not be updated.'),
      );
    } finally {
      setBusyAction('');
    }
  };

  const removeTrip = async (tripId: string) => {
    if (
      !window.confirm(
        'Delete this business trip? Linked trip expenses and order assignments will also be removed.',
      )
    ) {
      return;
    }

    setBusyAction(`delete-trip:${tripId}`);

    try {
      await deleteBusinessTrip(tripId);
      toast.success('Trip deleted', 'The business trip was removed.');
      await loadData(true);
    } catch (error) {
      toast.error(
        'Unable to delete trip',
        errorMessage(error, 'The business trip could not be deleted.'),
      );
    } finally {
      setBusyAction('');
    }
  };

  const saveExpense = async () => {
    if (
      !expenseForm.expenseDate ||
      expenseForm.amount <= 0 ||
      !expenseForm.description.trim()
    ) {
      toast.warning(
        'Expense details incomplete',
        'Add a date, amount, and clear description.',
      );
      return;
    }

    setBusyAction('create-expense');

    try {
      await createBusinessExpense({
        ...expenseForm,
        createdBy: user?.id,
      });
      toast.success(
        'Expense recorded',
        `${money(expenseForm.amount)} was added to business expenses.`,
      );
      setShowExpenseForm(false);
      setExpenseForm((current) => ({
        ...current,
        expenseDate: todayValue(),
        amount: current.category === 'meals' ? 1000 : 0,
        description: '',
        businessTripId: '',
        orderId: '',
      }));
      await loadData(true);
    } catch (error) {
      toast.error(
        'Unable to record expense',
        errorMessage(error, 'The expense could not be saved.'),
      );
    } finally {
      setBusyAction('');
    }
  };

  const removeExpense = async (expenseId: string) => {
    if (!window.confirm('Delete this expense record?')) return;

    setBusyAction(`delete-expense:${expenseId}`);

    try {
      await deleteBusinessExpense(expenseId);
      toast.success('Expense deleted', 'The expense was removed.');
      await loadData(true);
    } catch (error) {
      toast.error(
        'Unable to delete expense',
        errorMessage(error, 'The expense could not be deleted.'),
      );
    } finally {
      setBusyAction('');
    }
  };

  const selectOrderForLink = (orderId: string) => {
    const selected = contributionOrders.find((order) => order.id === orderId);
    setLinkForm((current) => ({
      ...current,
      orderId,
      contributionAmount: selected
        ? estimatedOrderContribution(selected)
        : current.contributionAmount,
    }));
  };

  const saveOrderLink = async () => {
    if (
      !linkForm.businessTripId ||
      !linkForm.orderId ||
      linkForm.contributionAmount <= 0
    ) {
      toast.warning(
        'Assignment incomplete',
        'Choose a trip, an order, and a contribution amount.',
      );
      return;
    }

    setBusyAction('link-order');

    try {
      await linkOrderToBusinessTrip(linkForm);
      toast.success(
        'Order assigned to trip',
        'Its contribution is now included in the trip result.',
      );
      setShowOrderLinkForm(false);
      setLinkForm({
        businessTripId: '',
        orderId: '',
        contributionAmount: 0,
        notes: '',
      });
      await loadData(true);
    } catch (error) {
      toast.error(
        'Unable to assign order',
        errorMessage(error, 'The order could not be linked to the trip.'),
      );
    } finally {
      setBusyAction('');
    }
  };

  const removeOrderLink = async (linkId: string) => {
    setBusyAction(`unlink-order:${linkId}`);

    try {
      await unlinkOrderFromBusinessTrip(linkId);
      toast.success('Order unassigned', 'The order was removed from the trip.');
      await loadData(true);
    } catch (error) {
      toast.error(
        'Unable to unassign order',
        errorMessage(error, 'The order link could not be removed.'),
      );
    } finally {
      setBusyAction('');
    }
  };

  const summary = data?.summary;

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-600">
            Phase 3A
          </p>
          <h2 className="mt-1 text-xl font-black text-neutral-950">
            Profit & Trip Tracker
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500">
            Track contribution earned, trip costs, operating expenses, and the
            actual net result of Shop2Bhutan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold text-neutral-700 outline-none focus:border-amber-400"
          />
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={busyAction === 'refresh'}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
          >
            {busyAction === 'refresh' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Refresh
          </button>
        </div>
      </div>

      {pageError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={20}
              className="mt-0.5 shrink-0 text-red-600"
            />
            <div>
              <p className="text-sm font-black text-red-800">
                Profit tracker unavailable
              </p>
              <p className="mt-1 text-sm leading-6 text-red-700">{pageError}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-neutral-500">
                Monthly Contribution
              </p>
              <p className="mt-2 text-2xl font-black text-neutral-950">
                {loading ? '...' : money(summary?.contribution ?? 0)}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                {summary?.eligibleOrderCount ?? 0} paid order
                {(summary?.eligibleOrderCount ?? 0) === 1 ? '' : 's'} counted
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <TrendingUp size={20} />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-neutral-500">
                Business Expenses
              </p>
              <p className="mt-2 text-2xl font-black text-neutral-950">
                {loading ? '...' : money(summary?.expenses ?? 0)}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                {monthExpenses.length} expense record
                {monthExpenses.length === 1 ? '' : 's'}
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <ReceiptText size={20} />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-neutral-500">Net Profit</p>
              <p
                className={`mt-2 text-2xl font-black ${
                  (summary?.netProfit ?? 0) >= 0
                    ? 'text-emerald-700'
                    : 'text-red-700'
                }`}
              >
                {loading ? '...' : money(summary?.netProfit ?? 0)}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                Contribution minus recorded expenses
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              {(summary?.netProfit ?? 0) >= 0 ? (
                <CircleDollarSign size={20} />
              ) : (
                <TrendingDown size={20} />
              )}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-neutral-500">
                Monthly Target
              </p>
              <p className="mt-2 text-2xl font-black text-neutral-950">
                {loading ? '...' : money(summary?.monthlyTarget ?? 0)}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(0, summary?.progressPercent ?? 0))}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs font-bold text-violet-600">
                {summary?.progressPercent ?? 0}% achieved
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <Target size={20} />
            </span>
          </div>
        </div>
      </div>

      {plannedRiskTrips.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={20}
              className="mt-0.5 shrink-0 text-amber-700"
            />
            <div>
              <p className="text-sm font-black text-amber-900">
                {plannedRiskTrips.length} planned trip
                {plannedRiskTrips.length === 1 ? '' : 's'} may lose money
              </p>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                Expected contribution is lower than estimated trip cost. Group
                more orders or postpone the trip.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-neutral-950">
                Business Trips
              </h3>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Compare planned contribution and cost before travelling.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowTripForm((current) => !current)}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-amber-500 px-3 text-xs font-black text-white transition hover:bg-amber-600"
            >
              <Plus size={15} />
              Add Trip
            </button>
          </div>

          {showTripForm && (
            <div className="mt-4 space-y-3 rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
              {parcelTrips.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-neutral-600">
                    Link an existing parcel trip (optional)
                  </label>
                  <select
                    value={tripForm.parcelTripId}
                    onChange={(event) =>
                      handleParcelTripSelection(event.target.value)
                    }
                    className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                  >
                    <option value="">Manual business trip</option>
                    {parcelTrips.map((trip) => (
                      <option key={trip.id} value={trip.id}>
                        {tripRoute(trip)} · {formatDate(trip.goingDate)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={tripForm.title}
                  onChange={(event) =>
                    setTripForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Trip title"
                  className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                />
                <input
                  value={tripForm.route}
                  onChange={(event) =>
                    setTripForm((current) => ({
                      ...current,
                      route: event.target.value,
                    }))
                  }
                  placeholder="Route"
                  className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                />
                <input
                  type="date"
                  value={tripForm.tripDate}
                  onChange={(event) =>
                    setTripForm((current) => ({
                      ...current,
                      tripDate: event.target.value,
                    }))
                  }
                  className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  value={tripForm.expectedContribution}
                  onChange={(event) =>
                    setTripForm((current) => ({
                      ...current,
                      expectedContribution: Number(event.target.value) || 0,
                    }))
                  }
                  placeholder="Expected contribution"
                  className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  value={tripForm.estimatedCost}
                  onChange={(event) =>
                    setTripForm((current) => ({
                      ...current,
                      estimatedCost: Number(event.target.value) || 0,
                    }))
                  }
                  placeholder="Estimated trip cost"
                  className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                />
                <input
                  value={tripForm.notes}
                  onChange={(event) =>
                    setTripForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Notes"
                  className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                />
              </div>

              <button
                type="button"
                onClick={() => void saveTrip()}
                disabled={busyAction === 'create-trip'}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-black text-white disabled:opacity-60"
              >
                {busyAction === 'create-trip' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CarFront size={16} />
                )}
                Save Business Trip
              </button>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {loading ? (
              [1, 2].map((item) => (
                <div
                  key={item}
                  className="h-40 animate-pulse rounded-2xl bg-neutral-100"
                />
              ))
            ) : (data?.trips.length ?? 0) === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 px-5 py-8 text-center">
                <Route size={26} className="mx-auto text-neutral-300" />
                <p className="mt-3 text-sm font-black text-neutral-800">
                  No business trips recorded
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Add a planned trip before travelling.
                </p>
              </div>
            ) : (
              data?.trips.map((trip) => {
                const linkedOrders = (data.tripOrders ?? []).filter(
                  (link) => link.businessTripId === trip.id,
                );

                return (
                  <article
                    key={trip.id}
                    className={`rounded-2xl border p-4 ${
                      trip.isAtRisk
                        ? 'border-amber-200 bg-amber-50/30'
                        : 'border-neutral-100 bg-white'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-black text-neutral-950">
                            {trip.title}
                          </h4>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-black ${statusClass(trip.status)}`}
                          >
                            {TRIP_STATUS_LABELS[trip.status]}
                          </span>
                          {trip.isAtRisk && (
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-800">
                              At risk
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs font-bold text-neutral-600">
                          {trip.route}
                        </p>
                        <p className="mt-1 text-xs text-neutral-400">
                          {formatDate(trip.tripDate)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => void removeTrip(trip.id)}
                        disabled={busyAction === `delete-trip:${trip.id}`}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        aria-label="Delete business trip"
                      >
                        {busyAction === `delete-trip:${trip.id}` ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl bg-neutral-50 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase text-neutral-400">
                          Planned contribution
                        </p>
                        <p className="mt-1 text-sm font-black text-neutral-900">
                          {money(trip.expectedContribution)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-neutral-50 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase text-neutral-400">
                          Estimated cost
                        </p>
                        <p className="mt-1 text-sm font-black text-neutral-900">
                          {money(trip.estimatedCost)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-neutral-50 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase text-neutral-400">
                          Linked contribution
                        </p>
                        <p className="mt-1 text-sm font-black text-neutral-900">
                          {money(trip.linkedContribution)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-neutral-50 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase text-neutral-400">
                          Actual net
                        </p>
                        <p
                          className={`mt-1 text-sm font-black ${
                            trip.netContribution >= 0
                              ? 'text-emerald-700'
                              : 'text-red-700'
                          }`}
                        >
                          {money(trip.netContribution)}
                        </p>
                      </div>
                    </div>

                    {linkedOrders.length > 0 && (
                      <div className="mt-3 space-y-2 rounded-xl border border-neutral-100 bg-neutral-50/70 p-3">
                        <p className="text-[10px] font-black uppercase tracking-wide text-neutral-400">
                          Assigned Orders
                        </p>
                        {linkedOrders.map((link) => {
                          const linkedOrder = orders.find(
                            (order) => order.id === link.orderId,
                          );

                          return (
                            <div
                              key={link.id}
                              className="flex items-center justify-between gap-3 text-xs"
                            >
                              <span className="min-w-0 truncate font-bold text-neutral-700">
                                #{linkedOrder ? orderNumber(linkedOrder) : link.orderId.slice(0, 8)}
                                {linkedOrder
                                  ? ` · ${orderCustomer(linkedOrder)}`
                                  : ''}
                              </span>
                              <span className="flex shrink-0 items-center gap-2">
                                <strong className="text-neutral-900">
                                  {money(link.contributionAmount)}
                                </strong>
                                <button
                                  type="button"
                                  onClick={() => void removeOrderLink(link.id)}
                                  disabled={
                                    busyAction === `unlink-order:${link.id}`
                                  }
                                  className="text-red-500 disabled:opacity-50"
                                >
                                  {busyAction === `unlink-order:${link.id}` ? (
                                    <Loader2
                                      size={13}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Trash2 size={13} />
                                  )}
                                </button>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {(
                        [
                          'planned',
                          'in_progress',
                          'completed',
                          'cancelled',
                        ] as BusinessTripStatus[]
                      ).map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() =>
                            void changeTripStatus(trip.id, status)
                          }
                          disabled={
                            trip.status === status ||
                            busyAction === `trip-status:${trip.id}`
                          }
                          className={`rounded-xl px-3 py-2 text-[11px] font-black transition disabled:opacity-40 ${
                            trip.status === status
                              ? 'bg-neutral-900 text-white'
                              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                          }`}
                        >
                          {TRIP_STATUS_LABELS[status]}
                        </button>
                      ))}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-neutral-950">
                  Assign Orders
                </h3>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  Link customer orders to a trip to measure that trip’s result.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOrderLinkForm((current) => !current)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"
              >
                <Link2 size={17} />
              </button>
            </div>

            {showOrderLinkForm && (
              <div className="mt-4 space-y-3">
                <select
                  value={linkForm.businessTripId}
                  onChange={(event) =>
                    setLinkForm((current) => ({
                      ...current,
                      businessTripId: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                >
                  <option value="">Select business trip</option>
                  {(data?.trips ?? [])
                    .filter((trip) => trip.status !== 'cancelled')
                    .map((trip) => (
                      <option key={trip.id} value={trip.id}>
                        {trip.title} · {formatDate(trip.tripDate)}
                      </option>
                    ))}
                </select>

                <select
                  value={linkForm.orderId}
                  onChange={(event) => selectOrderForLink(event.target.value)}
                  className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                >
                  <option value="">Select order</option>
                  {contributionOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      #{orderNumber(order)} · {orderCustomer(order)}
                      {linkedOrderIds.has(order.id) ? ' · already assigned' : ''}
                    </option>
                  ))}
                </select>

                {selectedLinkOrder && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    Suggested contribution:{' '}
                    <strong>
                      {money(estimatedOrderContribution(selectedLinkOrder))}
                    </strong>
                  </div>
                )}

                <input
                  type="number"
                  min="0"
                  value={linkForm.contributionAmount}
                  onChange={(event) =>
                    setLinkForm((current) => ({
                      ...current,
                      contributionAmount: Number(event.target.value) || 0,
                    }))
                  }
                  placeholder="Contribution amount"
                  className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm"
                />

                <input
                  value={linkForm.notes}
                  onChange={(event) =>
                    setLinkForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Optional note"
                  className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm"
                />

                <button
                  type="button"
                  onClick={() => void saveOrderLink()}
                  disabled={busyAction === 'link-order'}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-black text-white disabled:opacity-60"
                >
                  {busyAction === 'link-order' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ClipboardList size={16} />
                  )}
                  Assign Order
                </button>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-neutral-950">
                  Record Expense
                </h3>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  Fuel, meals, porter, refunds, packaging, and other costs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExpenseForm((current) => !current)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600"
              >
                <Plus size={17} />
              </button>
            </div>

            {showExpenseForm && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={expenseForm.expenseDate}
                    onChange={(event) =>
                      setExpenseForm((current) => ({
                        ...current,
                        expenseDate: event.target.value,
                      }))
                    }
                    className="h-10 rounded-xl border border-neutral-200 px-3 text-sm"
                  />
                  <select
                    value={expenseForm.category}
                    onChange={(event) =>
                      setExpenseForm((current) => ({
                        ...current,
                        category: event.target
                          .value as BusinessExpenseCategory,
                        description:
                          EXPENSE_CATEGORIES.find(
                            (category) =>
                              category.value === event.target.value,
                          )?.label || current.description,
                      }))
                    }
                    className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                  >
                    {EXPENSE_CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="number"
                  min="0"
                  value={expenseForm.amount}
                  onChange={(event) =>
                    setExpenseForm((current) => ({
                      ...current,
                      amount: Number(event.target.value) || 0,
                    }))
                  }
                  placeholder="Amount"
                  className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm"
                />

                <input
                  value={expenseForm.description}
                  onChange={(event) =>
                    setExpenseForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Description"
                  className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm"
                />

                <select
                  value={expenseForm.businessTripId}
                  onChange={(event) =>
                    setExpenseForm((current) => ({
                      ...current,
                      businessTripId: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                >
                  <option value="">Not linked to a trip</option>
                  {(data?.trips ?? []).map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.title} · {formatDate(trip.tripDate)}
                    </option>
                  ))}
                </select>

                <select
                  value={expenseForm.orderId}
                  onChange={(event) =>
                    setExpenseForm((current) => ({
                      ...current,
                      orderId: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                >
                  <option value="">Not linked to an order</option>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      #{orderNumber(order)} · {orderCustomer(order)}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => void saveExpense()}
                  disabled={busyAction === 'create-expense'}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 text-sm font-black text-white disabled:opacity-60"
                >
                  {busyAction === 'create-expense' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <WalletCards size={16} />
                  )}
                  Save Expense
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      <section className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-neutral-950">
              Expenses for {month}
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              Every expense reduces the month’s net profit.
            </p>
          </div>
          <span className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700">
            {money(summary?.expenses ?? 0)}
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-neutral-100 text-left">
                <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wide text-neutral-400">
                  Date
                </th>
                <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wide text-neutral-400">
                  Category
                </th>
                <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wide text-neutral-400">
                  Description
                </th>
                <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wide text-neutral-400">
                  Trip / Order
                </th>
                <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-wide text-neutral-400">
                  Amount
                </th>
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {monthExpenses.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-10 text-center text-sm text-neutral-400"
                  >
                    No expenses recorded for this month.
                  </td>
                </tr>
              ) : (
                monthExpenses.map((expense) => {
                  const trip = data?.trips.find(
                    (item) => item.id === expense.businessTripId,
                  );
                  const order = orders.find(
                    (item) => item.id === expense.orderId,
                  );
                  const categoryLabel =
                    EXPENSE_CATEGORIES.find(
                      (item) => item.value === expense.category,
                    )?.label || expense.category;

                  return (
                    <tr
                      key={expense.id}
                      className="border-b border-neutral-50 text-sm"
                    >
                      <td className="px-3 py-3 text-neutral-600">
                        {formatDate(expense.expenseDate)}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-600">
                          {expense.category === 'fuel' ? (
                            <Fuel size={13} />
                          ) : expense.category === 'meals' ? (
                            <Utensils size={13} />
                          ) : (
                            <ReceiptText size={13} />
                          )}
                          {categoryLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-semibold text-neutral-800">
                        {expense.description}
                      </td>
                      <td className="px-3 py-3 text-xs text-neutral-500">
                        {trip?.title ||
                          (order ? `#${orderNumber(order)}` : 'General')}
                      </td>
                      <td className="px-3 py-3 text-right font-black text-neutral-950">
                        {money(expense.amount)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void removeExpense(expense.id)}
                          disabled={
                            busyAction === `delete-expense:${expense.id}`
                          }
                          className="text-neutral-400 transition hover:text-red-600 disabled:opacity-50"
                        >
                          {busyAction === `delete-expense:${expense.id}` ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
        <div className="flex items-start gap-3">
          <CheckCircle2
            size={20}
            className="mt-0.5 shrink-0 text-blue-600"
          />
          <div>
            <p className="text-sm font-black text-blue-900">
              Recommended operating rule
            </p>
            <p className="mt-1 text-sm leading-6 text-blue-800">
              Avoid a Thimphu–Phuentsholing trip for only one or two small
              orders. Aim for at least Nu. 5,000–6,000 contribution before a
              trip expected to cost around Nu. 3,000.
            </p>
          </div>
          <ArrowRight size={18} className="ml-auto shrink-0 text-blue-500" />
        </div>
      </div>
    </div>
  );
}
