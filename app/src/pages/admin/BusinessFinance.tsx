import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CarFront,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Fuel,
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
  X,
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
  if (status === 'completed') {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100';
  }
  if (status === 'in_progress') {
    return 'bg-sky-50 text-sky-700 ring-1 ring-sky-100';
  }
  if (status === 'cancelled') {
    return 'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200';
  }
  return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100';
}

function ActionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 text-left transition hover:border-orange-200 hover:bg-orange-50/30 active:scale-[0.995]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 transition group-hover:bg-orange-100 group-hover:text-orange-600">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-neutral-900">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-neutral-500">
          {description}
        </span>
      </span>
      <ArrowRight
        size={16}
        className="shrink-0 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-orange-500"
      />
    </button>
  );
}

function ModalShell({
  title,
  description,
  onClose,
  children,
  footer,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[1200] flex items-end justify-center bg-neutral-950/40 p-3 backdrop-blur-[2px] sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-[22px] border border-neutral-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4">
          <div>
            <h3 className="text-base font-black text-neutral-950">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-neutral-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200 text-neutral-500 transition hover:bg-neutral-50"
            aria-label={`Close ${title}`}
          >
            <X size={17} />
          </button>
        </header>
        <div className="max-h-[calc(92vh-150px)] overflow-y-auto px-5 py-4">
          {children}
        </div>
        <footer className="border-t border-neutral-100 bg-neutral-50/70 px-5 py-3">
          {footer}
        </footer>
      </section>
    </div>
  );
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


  useEffect(() => {
    const modalOpen = showTripForm || showExpenseForm || showOrderLinkForm;
    if (!modalOpen || typeof document === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showExpenseForm, showOrderLinkForm, showTripForm]);

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
  const targetProgress = Math.min(
    100,
    Math.max(0, summary?.progressPercent ?? 0),
  );
  const trips = data?.trips ?? [];
  const tripOrderLinks = data?.tripOrders ?? [];

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight text-neutral-950">
            Business Performance
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500">
            Monitor monthly contribution, operating costs, business trips, and
            actual profit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold text-neutral-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-500/10"
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
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0 text-red-600"
            />
            <div>
              <p className="text-sm font-black text-red-800">
                Profit tracker unavailable
              </p>
              <p className="mt-1 text-xs leading-5 text-red-700">{pageError}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.1em] text-neutral-400">
                Contribution
              </p>
              <p className="mt-2 text-2xl font-black tracking-tight text-neutral-950">
                {loading ? '...' : money(summary?.contribution ?? 0)}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {summary?.eligibleOrderCount ?? 0} paid order
                {(summary?.eligibleOrderCount ?? 0) === 1 ? '' : 's'} counted
              </p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <TrendingUp size={18} />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.1em] text-neutral-400">
                Expenses
              </p>
              <p className="mt-2 text-2xl font-black tracking-tight text-neutral-950">
                {loading ? '...' : money(summary?.expenses ?? 0)}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {monthExpenses.length} expense record
                {monthExpenses.length === 1 ? '' : 's'}
              </p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <ReceiptText size={18} />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.1em] text-neutral-400">
                Net Profit
              </p>
              <p
                className={`mt-2 text-2xl font-black tracking-tight ${
                  (summary?.netProfit ?? 0) >= 0
                    ? 'text-emerald-700'
                    : 'text-red-700'
                }`}
              >
                {loading ? '...' : money(summary?.netProfit ?? 0)}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Contribution minus recorded expenses
              </p>
            </div>
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                (summary?.netProfit ?? 0) >= 0
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              {(summary?.netProfit ?? 0) >= 0 ? (
                <CircleDollarSign size={18} />
              ) : (
                <TrendingDown size={18} />
              )}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-[0.1em] text-neutral-400">
                Monthly Target
              </p>
              <p className="mt-2 text-2xl font-black tracking-tight text-neutral-950">
                {loading ? '...' : money(summary?.monthlyTarget ?? 0)}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-orange-500 transition-all"
                  style={{ width: `${targetProgress}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] font-bold text-neutral-500">
                {money(summary?.contribution ?? 0)} of{' '}
                {money(summary?.monthlyTarget ?? 0)} · {targetProgress}%
              </p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <Target size={18} />
            </span>
          </div>
        </div>
      </div>

      {plannedRiskTrips.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0 text-amber-700"
            />
            <div>
              <p className="text-sm font-black text-amber-900">
                {plannedRiskTrips.length} planned trip
                {plannedRiskTrips.length === 1 ? '' : 's'} may lose money
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-800">
                Expected contribution is below estimated cost. Add more orders or
                postpone the trip.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3.5">
            <div>
              <h3 className="text-sm font-black text-neutral-950">Business Trips</h3>
              <p className="mt-0.5 text-xs text-neutral-500">
                Compare planned contribution, costs, assigned orders, and actual result.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-black text-neutral-600">
                {trips.length} {trips.length === 1 ? 'trip' : 'trips'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowExpenseForm(false);
                  setShowOrderLinkForm(false);
                  setShowTripForm(true);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-orange-500 px-3 text-xs font-black text-white transition hover:bg-orange-600"
              >
                <Plus size={15} />
                Add Trip
              </button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-16 animate-pulse rounded-xl bg-neutral-100"
                />
              ))}
            </div>
          ) : trips.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
                <Route size={23} />
              </span>
              <p className="mt-3 text-sm font-black text-neutral-800">
                No business trips yet
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-neutral-500">
                Plan your first trip to group paid orders, estimate travel costs,
                and measure the final result.
              </p>
              <button
                type="button"
                onClick={() => setShowTripForm(true)}
                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 text-xs font-black text-orange-700"
              >
                <Plus size={14} />
                Add first trip
              </button>
            </div>
          ) : (
            <div>
              <div className="hidden grid-cols-[minmax(220px,1.7fr)_105px_105px_105px_105px_130px_42px] gap-3 border-b border-neutral-100 bg-neutral-50/70 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-neutral-400 lg:grid">
                <span>Trip</span>
                <span>Planned</span>
                <span>Cost</span>
                <span>Linked</span>
                <span>Net</span>
                <span>Status</span>
                <span />
              </div>

              <div className="divide-y divide-neutral-100">
                {trips.map((trip) => {
                  const linkedOrders = tripOrderLinks.filter(
                    (link) => link.businessTripId === trip.id,
                  );

                  return (
                    <article
                      key={trip.id}
                      className={`px-4 py-3.5 ${
                        trip.isAtRisk ? 'bg-amber-50/30' : 'bg-white'
                      }`}
                    >
                      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.7fr)_105px_105px_105px_105px_130px_42px] lg:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-black text-neutral-950">
                              {trip.title}
                            </p>
                            {trip.isAtRisk && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase text-amber-800">
                                At risk
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-xs font-semibold text-neutral-600">
                            {trip.route}
                          </p>
                          <p className="mt-0.5 text-[11px] text-neutral-400">
                            {formatDate(trip.tripDate)} · {linkedOrders.length}{' '}
                            {linkedOrders.length === 1 ? 'order' : 'orders'}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-3 lg:block">
                          <span className="text-[10px] font-black uppercase text-neutral-400 lg:hidden">
                            Planned
                          </span>
                          <span className="text-xs font-black text-neutral-800">
                            {money(trip.expectedContribution)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3 lg:block">
                          <span className="text-[10px] font-black uppercase text-neutral-400 lg:hidden">
                            Cost
                          </span>
                          <span className="text-xs font-black text-neutral-800">
                            {money(trip.estimatedCost)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3 lg:block">
                          <span className="text-[10px] font-black uppercase text-neutral-400 lg:hidden">
                            Linked
                          </span>
                          <span className="text-xs font-black text-neutral-800">
                            {money(trip.linkedContribution)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3 lg:block">
                          <span className="text-[10px] font-black uppercase text-neutral-400 lg:hidden">
                            Net
                          </span>
                          <span
                            className={`text-xs font-black ${
                              trip.netContribution >= 0
                                ? 'text-emerald-700'
                                : 'text-red-700'
                            }`}
                          >
                            {money(trip.netContribution)}
                          </span>
                        </div>

                        <select
                          value={trip.status}
                          onChange={(event) =>
                            void changeTripStatus(
                              trip.id,
                              event.target.value as BusinessTripStatus,
                            )
                          }
                          disabled={busyAction === `trip-status:${trip.id}`}
                          className={`h-9 rounded-xl border-0 px-2.5 text-[11px] font-black outline-none ${statusClass(
                            trip.status,
                          )}`}
                        >
                          {(
                            [
                              'planned',
                              'in_progress',
                              'completed',
                              'cancelled',
                            ] as BusinessTripStatus[]
                          ).map((status) => (
                            <option key={status} value={status}>
                              {TRIP_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => void removeTrip(trip.id)}
                          disabled={busyAction === `delete-trip:${trip.id}`}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          aria-label="Delete business trip"
                        >
                          {busyAction === `delete-trip:${trip.id}` ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </button>
                      </div>

                      {linkedOrders.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-neutral-100 pt-3">
                          {linkedOrders.map((link) => {
                            const linkedOrder = orders.find(
                              (order) => order.id === link.orderId,
                            );

                            return (
                              <span
                                key={link.id}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-2.5 py-1.5 text-[10px] font-bold text-neutral-600"
                              >
                                #{linkedOrder
                                  ? orderNumber(linkedOrder)
                                  : link.orderId.slice(0, 8)}
                                <strong className="text-neutral-900">
                                  {money(link.contributionAmount)}
                                </strong>
                                <button
                                  type="button"
                                  onClick={() => void removeOrderLink(link.id)}
                                  disabled={
                                    busyAction === `unlink-order:${link.id}`
                                  }
                                  className="text-neutral-400 transition hover:text-red-600 disabled:opacity-50"
                                  aria-label="Unassign order"
                                >
                                  {busyAction === `unlink-order:${link.id}` ? (
                                    <Loader2 size={11} className="animate-spin" />
                                  ) : (
                                    <X size={11} />
                                  )}
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-3 xl:sticky xl:top-5 xl:self-start">
          <section className="rounded-2xl border border-neutral-200 bg-white p-3">
            <div className="px-1 pb-3">
              <h3 className="text-sm font-black text-neutral-950">Quick Actions</h3>
              <p className="mt-0.5 text-xs text-neutral-500">
                Open a focused form only when you need it.
              </p>
            </div>
            <div className="space-y-2">
              <ActionCard
                icon={<CarFront size={17} />}
                title="Add Business Trip"
                description="Plan route, date, expected contribution, and cost."
                onClick={() => {
                  setShowExpenseForm(false);
                  setShowOrderLinkForm(false);
                  setShowTripForm(true);
                }}
              />
              <ActionCard
                icon={<ClipboardList size={17} />}
                title="Assign Order"
                description="Attach a paid order and its contribution to a trip."
                onClick={() => {
                  setShowTripForm(false);
                  setShowExpenseForm(false);
                  setShowOrderLinkForm(true);
                }}
              />
              <ActionCard
                icon={<WalletCards size={17} />}
                title="Record Expense"
                description="Add fuel, meals, porter, packaging, or other costs."
                onClick={() => {
                  setShowTripForm(false);
                  setShowOrderLinkForm(false);
                  setShowExpenseForm(true);
                }}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h3 className="text-sm font-black text-neutral-950">Month at a glance</h3>
            <dl className="mt-3 divide-y divide-neutral-100">
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-xs font-semibold text-neutral-500">Trips</dt>
                <dd className="text-xs font-black text-neutral-900">{trips.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-xs font-semibold text-neutral-500">Assigned orders</dt>
                <dd className="text-xs font-black text-neutral-900">
                  {tripOrderLinks.length}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-xs font-semibold text-neutral-500">Expense records</dt>
                <dd className="text-xs font-black text-neutral-900">
                  {monthExpenses.length}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-xs font-semibold text-neutral-500">At-risk trips</dt>
                <dd className="text-xs font-black text-amber-700">
                  {plannedRiskTrips.length}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3.5">
          <div>
            <h3 className="text-sm font-black text-neutral-950">Monthly Expenses</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Every expense recorded for {month} reduces the final net profit.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700">
              {money(summary?.expenses ?? 0)}
            </span>
            <button
              type="button"
              onClick={() => setShowExpenseForm(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-black text-neutral-700 transition hover:bg-neutral-50"
            >
              <Plus size={14} />
              Add Expense
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/70 text-left">
                <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-neutral-400">
                  Date
                </th>
                <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-neutral-400">
                  Category
                </th>
                <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-neutral-400">
                  Description
                </th>
                <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-neutral-400">
                  Linked To
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-black uppercase tracking-[0.1em] text-neutral-400">
                  Amount
                </th>
                <th className="w-12 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {monthExpenses.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-neutral-400"
                  >
                    No expenses recorded for this month.
                  </td>
                </tr>
              ) : (
                monthExpenses.map((expense) => {
                  const trip = trips.find(
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
                    <tr key={expense.id} className="text-sm">
                      <td className="px-4 py-3 text-xs text-neutral-600">
                        {formatDate(expense.expenseDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-2.5 py-1.5 text-[11px] font-bold text-neutral-600">
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
                      <td className="px-4 py-3 text-xs font-semibold text-neutral-800">
                        {expense.description}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-500">
                        {trip?.title ||
                          (order ? `#${orderNumber(order)}` : 'General')}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-black text-neutral-950">
                        {money(expense.amount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void removeExpense(expense.id)}
                          disabled={
                            busyAction === `delete-expense:${expense.id}`
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          aria-label="Delete expense"
                        >
                          {busyAction === `delete-expense:${expense.id}` ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
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

      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <CheckCircle2
          size={18}
          className="mt-0.5 shrink-0 text-blue-600"
        />
        <div>
          <p className="text-xs font-black uppercase tracking-[0.08em] text-blue-800">
            Operating guide
          </p>
          <p className="mt-1 text-xs leading-5 text-blue-700">
            Aim for at least Nu. 5,000–6,000 contribution before a trip expected
            to cost around Nu. 3,000. Avoid travelling for only one or two small
            orders.
          </p>
        </div>
      </div>

      {showTripForm && (
        <ModalShell
          title="Add Business Trip"
          description="Plan the route, date, contribution target, and estimated travel cost."
          onClose={() => setShowTripForm(false)}
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTripForm(false)}
                className="h-10 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-black text-neutral-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveTrip()}
                disabled={busyAction === 'create-trip'}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-black text-white disabled:opacity-60"
              >
                {busyAction === 'create-trip' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CarFront size={16} />
                )}
                Save Trip
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            {parcelTrips.length > 0 && (
              <label className="block">
                <span className="text-xs font-bold text-neutral-600">
                  Existing parcel trip <span className="font-medium text-neutral-400">(optional)</span>
                </span>
                <select
                  value={tripForm.parcelTripId}
                  onChange={(event) =>
                    handleParcelTripSelection(event.target.value)
                  }
                  className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-orange-300"
                >
                  <option value="">Manual business trip</option>
                  {parcelTrips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {tripRoute(trip)} · {formatDate(trip.goingDate)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-xs font-bold text-neutral-600">Trip title</span>
                <input
                  value={tripForm.title}
                  onChange={(event) =>
                    setTripForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Trip title"
                  className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-orange-300"
                />
              </label>
              <label>
                <span className="text-xs font-bold text-neutral-600">Route</span>
                <input
                  value={tripForm.route}
                  onChange={(event) =>
                    setTripForm((current) => ({
                      ...current,
                      route: event.target.value,
                    }))
                  }
                  placeholder="Route"
                  className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-orange-300"
                />
              </label>
              <label>
                <span className="text-xs font-bold text-neutral-600">Trip date</span>
                <input
                  type="date"
                  value={tripForm.tripDate}
                  onChange={(event) =>
                    setTripForm((current) => ({
                      ...current,
                      tripDate: event.target.value,
                    }))
                  }
                  className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-orange-300"
                />
              </label>
              <label>
                <span className="text-xs font-bold text-neutral-600">Expected contribution</span>
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
                  className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-orange-300"
                />
              </label>
              <label>
                <span className="text-xs font-bold text-neutral-600">Estimated cost</span>
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
                  className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-orange-300"
                />
              </label>
              <label>
                <span className="text-xs font-bold text-neutral-600">Notes</span>
                <input
                  value={tripForm.notes}
                  onChange={(event) =>
                    setTripForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Optional notes"
                  className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-orange-300"
                />
              </label>
            </div>
          </div>
        </ModalShell>
      )}

      {showOrderLinkForm && (
        <ModalShell
          title="Assign Order to Trip"
          description="Choose an eligible order and record the contribution allocated to the trip."
          onClose={() => setShowOrderLinkForm(false)}
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowOrderLinkForm(false)}
                className="h-10 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-black text-neutral-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveOrderLink()}
                disabled={busyAction === 'link-order'}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-black text-white disabled:opacity-60"
              >
                {busyAction === 'link-order' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ClipboardList size={16} />
                )}
                Assign Order
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold text-neutral-600">Business trip</span>
              <select
                value={linkForm.businessTripId}
                onChange={(event) =>
                  setLinkForm((current) => ({
                    ...current,
                    businessTripId: event.target.value,
                  }))
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-orange-300"
              >
                <option value="">Select business trip</option>
                {trips
                  .filter((trip) => trip.status !== 'cancelled')
                  .map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.title} · {formatDate(trip.tripDate)}
                    </option>
                  ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-neutral-600">Customer order</span>
              <select
                value={linkForm.orderId}
                onChange={(event) => selectOrderForLink(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-orange-300"
              >
                <option value="">Select order</option>
                {contributionOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    #{orderNumber(order)} · {orderCustomer(order)}
                    {linkedOrderIds.has(order.id) ? ' · already assigned' : ''}
                  </option>
                ))}
              </select>
            </label>

            {selectedLinkOrder && (
              <div className="rounded-xl border border-orange-100 bg-orange-50 px-3 py-2.5 text-xs text-orange-800">
                Suggested contribution:{' '}
                <strong>{money(estimatedOrderContribution(selectedLinkOrder))}</strong>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-xs font-bold text-neutral-600">Contribution amount</span>
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
                  className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-orange-300"
                />
              </label>
              <label>
                <span className="text-xs font-bold text-neutral-600">Note</span>
                <input
                  value={linkForm.notes}
                  onChange={(event) =>
                    setLinkForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Optional note"
                  className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-orange-300"
                />
              </label>
            </div>
          </div>
        </ModalShell>
      )}

      {showExpenseForm && (
        <ModalShell
          title="Record Business Expense"
          description="Add an operating cost and optionally link it to a trip or customer order."
          onClose={() => setShowExpenseForm(false)}
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowExpenseForm(false)}
                className="h-10 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-black text-neutral-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveExpense()}
                disabled={busyAction === 'create-expense'}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-black text-white disabled:opacity-60"
              >
                {busyAction === 'create-expense' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <WalletCards size={16} />
                )}
                Save Expense
              </button>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-xs font-bold text-neutral-600">Expense date</span>
              <input
                type="date"
                value={expenseForm.expenseDate}
                onChange={(event) =>
                  setExpenseForm((current) => ({
                    ...current,
                    expenseDate: event.target.value,
                  }))
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-orange-300"
              />
            </label>
            <label>
              <span className="text-xs font-bold text-neutral-600">Category</span>
              <select
                value={expenseForm.category}
                onChange={(event) =>
                  setExpenseForm((current) => ({
                    ...current,
                    category: event.target.value as BusinessExpenseCategory,
                    description:
                      EXPENSE_CATEGORIES.find(
                        (category) => category.value === event.target.value,
                      )?.label || current.description,
                  }))
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-orange-300"
              >
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-xs font-bold text-neutral-600">Amount</span>
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
                className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-orange-300"
              />
            </label>
            <label>
              <span className="text-xs font-bold text-neutral-600">Description</span>
              <input
                value={expenseForm.description}
                onChange={(event) =>
                  setExpenseForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Expense description"
                className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-orange-300"
              />
            </label>
            <label>
              <span className="text-xs font-bold text-neutral-600">Business trip</span>
              <select
                value={expenseForm.businessTripId}
                onChange={(event) =>
                  setExpenseForm((current) => ({
                    ...current,
                    businessTripId: event.target.value,
                  }))
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-orange-300"
              >
                <option value="">Not linked to a trip</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.title} · {formatDate(trip.tripDate)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-xs font-bold text-neutral-600">Customer order</span>
              <select
                value={expenseForm.orderId}
                onChange={(event) =>
                  setExpenseForm((current) => ({
                    ...current,
                    orderId: event.target.value,
                  }))
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-orange-300"
              >
                <option value="">Not linked to an order</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    #{orderNumber(order)} · {orderCustomer(order)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
