import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Eye,
  FileText,
  Loader2,
  PackageSearch,
  ReceiptText,
  ShieldAlert,
  RefreshCw,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import StatusBadge from "@/components/shared/StatusBadge";
import { supabase } from "@/lib/supabase";
import {
  fetchAdminCustomers,
  fetchAdminOrders,
  fetchAdminPayments,
  type AdminCustomerRecord,
  type AdminPaymentRecord,
} from "@/lib/customerOrders";
import type { Order, OrderItem, OrderStatus } from "@/types";
import { fetchAdminParcelRequests, fetchAdminParcelTrips } from "@/lib/parcels";
import type { ParcelRequest, ParcelTrip } from "@/types/parcel";
import {
  DEFAULT_BUSINESS_FINANCE_SUMMARY,
  fetchBusinessFinanceSummary,
} from "@/lib/businessFinance";
import type { BusinessFinanceSummary } from "@/types/businessFinance";

type DashboardPeriod = "7d" | "30d" | "month";

type StatCard = {
  title: string;
  value: string;
  change: string;
  positive: boolean | null;
  icon: typeof ClipboardList;
  accent: string;
};

type RevenuePoint = {
  date: string;
  amount: number;
};

type StatusPoint = {
  status: OrderStatus;
  label: string;
  count: number;
  color: string;
};

type TopProductPoint = {
  id: string;
  name: string;
  unitsSold: number;
  revenue: number;
};

type ProfitSettings = {
  includeServiceCharge: boolean;
  includeDeliveryFee: boolean;
  verifiedPaymentsOnly: boolean;
};

type ProfitSettingRow = {
  key: string;
  value: unknown;
};

type ProfitSnapshot = {
  total: number;
  serviceCharge: number;
  deliveryFee: number;
  orderCount: number;
};

const DEFAULT_PROFIT_SETTINGS: ProfitSettings = {
  includeServiceCharge: true,
  includeDeliveryFee: true,
  verifiedPaymentsOnly: true,
};

const PROFIT_SETTING_KEYS = {
  includeServiceCharge: "profit_include_service_charge",
  includeDeliveryFee: "profit_include_delivery_fee",
  verifiedPaymentsOnly: "profit_verified_payments_only",
} as const;

const PERIODS: { key: DashboardPeriod; label: string }[] = [
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "month", label: "This Month" },
];

const STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  pending_confirmation: "Pending Confirmation",
  quotation_pending: "Quotation Pending",
  quoted: "Quoted",
  payment_pending: "Payment Pending",
  payment_verified: "Payment Verified",
  order_placed: "Order Placed",
  in_transit: "In Transit",
  arrived_at_hub: "Arrived at Hub",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_ORDER: OrderStatus[] = [
  "pending_confirmation",
  "quotation_pending",
  "quoted",
  "payment_pending",
  "payment_verified",
  "order_placed",
  "in_transit",
  "arrived_at_hub",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const STATUS_COLORS: Partial<Record<OrderStatus, string>> = {
  pending_confirmation: "#f97316",
  quotation_pending: "#f59e0b",
  quoted: "#8b5cf6",
  payment_pending: "#3b82f6",
  payment_verified: "#10b981",
  order_placed: "#14b8a6",
  in_transit: "#06b6d4",
  arrived_at_hub: "#6366f1",
  out_for_delivery: "#84cc16",
  delivered: "#22c55e",
  cancelled: "#ef4444",
};

const DAY_MS = 24 * 60 * 60 * 1000;


type ActionCentreItem = {
  id: string;
  title: string;
  description: string;
  count: number;
  urgency: "critical" | "attention" | "normal";
  path: string;
  icon: typeof ClipboardList;
};

function hoursSince(value?: string | null) {
  const date = getDate(value);
  return date ? Math.max(0, (Date.now() - date.getTime()) / (60 * 60 * 1000)) : 0;
}

function orderActionAgeHours(order: Order) {
  return hoursSince(order.updatedAt || order.createdAt);
}

function isOrderOverdue(order: Order) {
  if (order.status === "delivered" || order.status === "cancelled") return false;

  const age = orderActionAgeHours(order);
  const thresholds: Partial<Record<OrderStatus, number>> = {
    pending_confirmation: 12,
    quotation_pending: 12,
    quoted: 48,
    payment_pending: 72,
    payment_verified: 24,
    order_placed: 72,
    in_transit: 7 * 24,
    arrived_at_hub: 48,
    out_for_delivery: 24,
  };

  return age >= (thresholds[order.status] ?? 72);
}

function parcelRequestDate(request: ParcelRequest) {
  const row = request as ParcelRequest & {
    updatedAt?: string;
    updated_at?: string;
    createdAt?: string;
    created_at?: string;
  };
  return row.updatedAt || row.updated_at || row.createdAt || row.created_at || "";
}

function tripDate(trip: ParcelTrip) {
  const row = trip as ParcelTrip & {
    goingDate?: string;
    going_date?: string;
    departureDate?: string;
    departure_date?: string;
  };
  return getDate(row.goingDate || row.going_date || row.departureDate || row.departure_date);
}

function numericAmount(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function booleanSettingValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "on", "enabled"].includes(normalized)) return true;
  if (["false", "0", "no", "off", "disabled"].includes(normalized)) return false;
  return fallback;
}

async function fetchProfitSettings(): Promise<ProfitSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key,value")
    .in("key", Object.values(PROFIT_SETTING_KEYS));

  if (error) {
    // Profit settings are optional. Keep the dashboard working with safe
    // defaults if the app_settings table or the new keys are unavailable.
    console.warn("[Dashboard] Profit settings fallback:", error);
    return DEFAULT_PROFIT_SETTINGS;
  }

  const rows = (data ?? []) as ProfitSettingRow[];
  const getValue = (key: string, fallback: boolean) =>
    booleanSettingValue(rows.find((row) => row.key === key)?.value, fallback);

  return {
    includeServiceCharge: getValue(
      PROFIT_SETTING_KEYS.includeServiceCharge,
      DEFAULT_PROFIT_SETTINGS.includeServiceCharge,
    ),
    includeDeliveryFee: getValue(
      PROFIT_SETTING_KEYS.includeDeliveryFee,
      DEFAULT_PROFIT_SETTINGS.includeDeliveryFee,
    ),
    verifiedPaymentsOnly: getValue(
      PROFIT_SETTING_KEYS.verifiedPaymentsOnly,
      DEFAULT_PROFIT_SETTINGS.verifiedPaymentsOnly,
    ),
  };
}

function firstVerifiedPaymentDate(
  order: Order,
  verifiedPayments: AdminPaymentRecord[],
) {
  const dates = verifiedPayments
    .filter((payment) => payment.orderId === order.id)
    .map(paymentDate)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length > 0) return dates[0];

  const embeddedPayments = [
    ...(order.payments ?? []),
    ...(order.payment ? [order.payment] : []),
  ]
    .filter(
      (payment) =>
        String(payment.status || "").toLowerCase() === "verified",
    )
    .map((payment) => getDate(payment.verifiedAt) || getDate(payment.createdAt))
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime());

  return embeddedPayments[0] ?? null;
}

function quotationRecognitionDate(
  order: Order,
  verifiedPayments: AdminPaymentRecord[],
  verifiedOnly: boolean,
) {
  if (verifiedOnly) return firstVerifiedPaymentDate(order, verifiedPayments);

  return (
    getDate(order.quotation?.respondedAt) ||
    getDate(order.quotation?.createdAt) ||
    orderDate(order)
  );
}

function getDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function periodStart(period: DashboardPeriod) {
  const today = startOfDay(new Date());

  if (period === "month") {
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  return addDays(today, period === "30d" ? -29 : -6);
}

function periodDays(period: DashboardPeriod) {
  const today = startOfDay(new Date());
  const start = periodStart(period);
  return Math.max(
    1,
    Math.round((today.getTime() - start.getTime()) / DAY_MS) + 1,
  );
}

function formatChartDate(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(value: number) {
  const amount = Math.round(numericAmount(value));
  return `Nu. ${amount.toLocaleString("en-US")}`;
}

function formatCompactCurrency(value: number) {
  // Keep dashboard money values readable and accounting-friendly.
  // Avoid lakh/k shorthand such as "Nu. 1.4L" because it looks wrong in admin KPIs.
  return formatCurrency(value);
}

function formatPercentChange(current: number, previous: number) {
  if (previous <= 0 && current <= 0) return "0%";
  if (previous <= 0) return "+100%";

  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function isPositiveChange(current: number, previous: number) {
  return current >= previous;
}

function isDeactivated(customer: AdminCustomerRecord) {
  return (
    customer.accountStatus === "deactivated" || customer.isActive === false
  );
}

function paymentDate(payment: AdminPaymentRecord) {
  return (
    getDate(payment.verifiedAt) ||
    getDate(payment.createdAt) ||
    getDate((payment as { submittedAt?: string }).submittedAt)
  );
}

function isVerifiedPayment(payment: AdminPaymentRecord) {
  return String(payment.status || "").toLowerCase() === "verified";
}

function orderDate(order: Order) {
  return getDate(order.createdAt) || getDate(order.updatedAt);
}

function orderTotal(order: Order) {
  const quotationTotal = numericAmount(order.quotation?.totalAmount);
  if (quotationTotal > 0) return quotationTotal;

  const paymentAmount = numericAmount(order.payment?.amount);
  if (paymentAmount > 0) return paymentAmount;

  return (order.items ?? []).reduce(
    (sum, item) =>
      sum + numericAmount(item.unitPrice) * numericAmount(item.quantity || 1),
    0,
  );
}

function orderCustomerName(order: Order) {
  return (
    order.user?.name ||
    order.shippingAddress?.recipientName ||
    order.user?.phone ||
    "Customer"
  );
}

function itemName(item: OrderItem) {
  const itemWithProduct = item as OrderItem & { product?: { name?: string } };
  return item.productName || itemWithProduct.product?.name || "Product item";
}

function itemKey(item: OrderItem) {
  return item.productId || item.sourceUrl || itemName(item).toLowerCase();
}

function buildRevenueData(
  payments: AdminPaymentRecord[],
  period: DashboardPeriod,
): RevenuePoint[] {
  const start = periodStart(period);
  const days = periodDays(period);
  const points = Array.from({ length: days }, (_, index) => {
    const date = addDays(start, index);
    return {
      rawDate: date,
      date: formatChartDate(date),
      amount: 0,
    };
  });

  const pointByKey = new Map(
    points.map((point) => [
      startOfDay(point.rawDate).toISOString().slice(0, 10),
      point,
    ]),
  );

  payments.filter(isVerifiedPayment).forEach((payment) => {
    const date = paymentDate(payment);
    if (!date) return;

    const day = startOfDay(date);
    if (day < start) return;

    const key = day.toISOString().slice(0, 10);
    const point = pointByKey.get(key);
    if (point) point.amount += numericAmount(payment.amount);
  });

  return points.map(({ date, amount }) => ({ date, amount }));
}

function buildStatusData(orders: Order[]): StatusPoint[] {
  const counts = new Map<OrderStatus, number>();

  orders.forEach((order) => {
    counts.set(order.status, (counts.get(order.status) || 0) + 1);
  });

  const sortedStatuses = [
    ...STATUS_ORDER,
    ...Array.from(counts.keys()).filter(
      (status) => !STATUS_ORDER.includes(status),
    ),
  ];

  return sortedStatuses
    .map((status) => ({
      status,
      label: STATUS_LABELS[status] || status.replace(/_/g, " "),
      count: counts.get(status) || 0,
      color: STATUS_COLORS[status] || "#94a3b8",
    }))
    .filter((item) => item.count > 0);
}

function buildTopProducts(orders: Order[]): TopProductPoint[] {
  const products = new Map<string, TopProductPoint>();

  orders
    .filter((order) => order.status !== "cancelled")
    .forEach((order) => {
      (order.items ?? []).forEach((item) => {
        const key = itemKey(item);
        const existing = products.get(key) ?? {
          id: key,
          name: itemName(item),
          unitsSold: 0,
          revenue: 0,
        };

        const quantity = numericAmount(item.quantity || 1) || 1;
        existing.unitsSold += quantity;
        existing.revenue += quantity * numericAmount(item.unitPrice);
        products.set(key, existing);
      });
    });

  return Array.from(products.values())
    .sort((a, b) => b.revenue - a.revenue || b.unitsSold - a.unitsSold)
    .slice(0, 8);
}

function emptyRevenueData(period: DashboardPeriod) {
  const start = periodStart(period);
  const days = periodDays(period);

  return Array.from({ length: days }, (_, index) => ({
    date: formatChartDate(addDays(start, index)),
    amount: 0,
  }));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<AdminCustomerRecord[]>([]);
  const [payments, setPayments] = useState<AdminPaymentRecord[]>([]);
  const [parcelRequests, setParcelRequests] = useState<ParcelRequest[]>([]);
  const [parcelTrips, setParcelTrips] = useState<ParcelTrip[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<DashboardPeriod>("7d");
  const [profitPeriod, setProfitPeriod] = useState<DashboardPeriod>("month");
  const [profitSettings, setProfitSettings] = useState<ProfitSettings>(DEFAULT_PROFIT_SETTINGS);
  const [businessFinance, setBusinessFinance] = useState<BusinessFinanceSummary>(
    DEFAULT_BUSINESS_FINANCE_SUMMARY,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const [
        realOrders,
        realCustomers,
        realPayments,
        realProfitSettings,
        realParcelRequests,
        realParcelTrips,
        realBusinessFinance,
      ] = await Promise.all([
        fetchAdminOrders(),
        fetchAdminCustomers(),
        fetchAdminPayments(),
        fetchProfitSettings(),
        fetchAdminParcelRequests(),
        fetchAdminParcelTrips(),
        fetchBusinessFinanceSummary(undefined, { allowMissing: true }),
      ]);

      setOrders(realOrders);
      setCustomers(realCustomers);
      setPayments(realPayments);
      setProfitSettings(realProfitSettings);
      setParcelRequests(realParcelRequests);
      setParcelTrips(realParcelTrips);
      setBusinessFinance(realBusinessFinance);
    } catch (err) {
      console.error("Failed to load admin dashboard:", err);
      setError(
        err instanceof Error ? err.message : "Unable to load dashboard data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!active) return;
      await loadDashboard(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [loadDashboard]);

  const verifiedPayments = useMemo(
    () => payments.filter(isVerifiedPayment),
    [payments],
  );

  const metrics = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const last7Start = addDays(today, -6);
    const previous7Start = addDays(today, -13);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const last30Start = addDays(today, -29);

    const orderCreatedInRange = (order: Order, start: Date, end: Date) => {
      const date = orderDate(order);
      return Boolean(date && date >= start && date <= end);
    };

    const paymentInRange = (
      payment: AdminPaymentRecord,
      start: Date,
      end: Date,
    ) => {
      const date = paymentDate(payment);
      return Boolean(date && date >= start && date <= end);
    };

    const ordersLast7 = orders.filter((order) =>
      orderCreatedInRange(order, last7Start, now),
    ).length;
    const ordersPrevious7 = orders.filter((order) =>
      orderCreatedInRange(
        order,
        previous7Start,
        new Date(last7Start.getTime() - 1),
      ),
    ).length;

    const revenue = verifiedPayments.reduce(
      (sum, payment) => sum + numericAmount(payment.amount),
      0,
    );
    const revenueLast7 = verifiedPayments
      .filter((payment) => paymentInRange(payment, last7Start, now))
      .reduce((sum, payment) => sum + numericAmount(payment.amount), 0);
    const revenuePrevious7 = verifiedPayments
      .filter((payment) =>
        paymentInRange(
          payment,
          previous7Start,
          new Date(last7Start.getTime() - 1),
        ),
      )
      .reduce((sum, payment) => sum + numericAmount(payment.amount), 0);

    const pendingQuotations = orders.filter(
      (order) =>
        order.status === "quotation_pending" ||
        order.quotation?.status === "pending",
    ).length;

    const activeCustomers = customers.filter(
      (customer) => !isDeactivated(customer),
    ).length;
    const newCustomers = customers.filter((customer) => {
      const date = getDate(customer.joined);
      return Boolean(date && date >= last30Start && date <= now);
    }).length;
    const newCustomersThisMonth = customers.filter((customer) => {
      const date = getDate(customer.joined);
      return Boolean(date && date >= monthStart && date <= now);
    }).length;

    return {
      totalOrders: orders.length,
      ordersLast7,
      ordersPrevious7,
      pendingQuotations,
      revenue,
      revenueLast7,
      revenuePrevious7,
      activeCustomers,
      newCustomers,
      newCustomersThisMonth,
    };
  }, [customers, orders, verifiedPayments]);

  const statCards = useMemo<StatCard[]>(
    () => [
      {
        title: "Total Orders",
        value: metrics.totalOrders.toLocaleString(),
        change: formatPercentChange(
          metrics.ordersLast7,
          metrics.ordersPrevious7,
        ),
        positive: isPositiveChange(
          metrics.ordersLast7,
          metrics.ordersPrevious7,
        ),
        icon: ClipboardList,
        accent: "bg-amber-50 text-amber-600",
      },
      {
        title: "Pending Quotations",
        value: metrics.pendingQuotations.toLocaleString(),
        change: metrics.pendingQuotations > 0 ? "Needs attention" : "All clear",
        positive: null,
        icon: FileText,
        accent: "bg-orange-50 text-orange-600",
      },
      {
        title: "Verified Collections",
        value: formatCompactCurrency(metrics.revenue),
        change: formatPercentChange(
          metrics.revenueLast7,
          metrics.revenuePrevious7,
        ),
        positive: isPositiveChange(
          metrics.revenueLast7,
          metrics.revenuePrevious7,
        ),
        icon: TrendingUp,
        accent: "bg-emerald-50 text-emerald-600",
      },
      {
        title: "Active Customers",
        value: metrics.activeCustomers.toLocaleString(),
        change: `+${metrics.newCustomers.toLocaleString()} new`,
        positive: true,
        icon: Users,
        accent: "bg-blue-50 text-blue-600",
      },
    ],
    [metrics],
  );


  const actionCentre = useMemo(() => {
    const quotationOrders = orders.filter(
      (order) =>
        order.status === "pending_confirmation" ||
        order.status === "quotation_pending" ||
        order.quotation?.status === "pending",
    );
    const pendingPayments = payments.filter(
      (payment) => String(payment.status).toLowerCase() === "pending",
    );
    const overdueOrders = orders.filter(isOrderOverdue);
    const pendingParcels = parcelRequests.filter(
      (request) => request.status === "pending",
    );
    const staleParcels = parcelRequests.filter(
      (request) =>
        !["delivered", "rejected", "cancelled"].includes(request.status) &&
        hoursSince(parcelRequestDate(request)) >= 48,
    );

    const now = new Date();
    const nextTrip = [...parcelTrips]
      .filter((trip) => {
        const date = tripDate(trip);
        return Boolean(date && date >= startOfDay(now) && trip.status !== "cancelled" && trip.status !== "completed");
      })
      .sort((a, b) => (tripDate(a)?.getTime() ?? 0) - (tripDate(b)?.getTime() ?? 0))[0];

    const items: ActionCentreItem[] = [
      {
        id: "quotations",
        title: "Prepare quotations",
        description:
          quotationOrders.length > 0
            ? `${quotationOrders.length} customer request${quotationOrders.length === 1 ? " is" : "s are"} waiting for a final price.`
            : "No quotation is waiting right now.",
        count: quotationOrders.length,
        urgency: quotationOrders.some((order) => orderActionAgeHours(order) >= 12)
          ? "critical"
          : quotationOrders.length > 0
            ? "attention"
            : "normal",
        path: "/admin/orders?focus=quotation",
        icon: FileText,
      },
      {
        id: "payments",
        title: "Review payments",
        description:
          pendingPayments.length > 0
            ? `${pendingPayments.length} uploaded payment proof${pendingPayments.length === 1 ? " needs" : "s need"} verification.`
            : "All uploaded payment proofs are reviewed.",
        count: pendingPayments.length,
        urgency: pendingPayments.some((payment) => hoursSince(payment.createdAt) >= 12)
          ? "critical"
          : pendingPayments.length > 0
            ? "attention"
            : "normal",
        path: "/admin/payments?tab=pending",
        icon: ReceiptText,
      },
      {
        id: "overdue",
        title: "Check delayed orders",
        description:
          overdueOrders.length > 0
            ? `${overdueOrders.length} active order${overdueOrders.length === 1 ? " has" : "s have"} not progressed within the expected time.`
            : "No active order currently looks delayed.",
        count: overdueOrders.length,
        urgency: overdueOrders.length > 0 ? "critical" : "normal",
        path: "/admin/orders?focus=overdue",
        icon: Clock3,
      },
      {
        id: "parcels",
        title: "Handle parcel requests",
        description:
          pendingParcels.length > 0
            ? `${pendingParcels.length} parcel booking${pendingParcels.length === 1 ? " is" : "s are"} waiting for acceptance.`
            : staleParcels.length > 0
              ? `${staleParcels.length} active parcel${staleParcels.length === 1 ? " needs" : "s need"} a status review.`
              : "Parcel requests are up to date.",
        count: pendingParcels.length || staleParcels.length,
        urgency: staleParcels.length > 0 ? "critical" : pendingParcels.length > 0 ? "attention" : "normal",
        path: "/admin/parcel-requests?status=pending",
        icon: Truck,
      },
    ];

    const urgentCount = items.filter((item) => item.count > 0).length;
    const totalActions = items.reduce((sum, item) => sum + item.count, 0);

    return { items, urgentCount, totalActions, nextTrip };
  }, [orders, parcelRequests, parcelTrips, payments]);

  const profitSnapshot = useMemo<ProfitSnapshot>(() => {
    const start = periodStart(profitPeriod);
    const now = new Date();

    return orders.reduce<ProfitSnapshot>(
      (snapshot, order) => {
        if (order.status === "cancelled" || !order.quotation) return snapshot;

        const recognizedAt = quotationRecognitionDate(
          order,
          verifiedPayments,
          profitSettings.verifiedPaymentsOnly,
        );

        if (!recognizedAt || recognizedAt < start || recognizedAt > now) {
          return snapshot;
        }

        const serviceCharge = profitSettings.includeServiceCharge
          ? numericAmount(order.quotation.serviceCharge)
          : 0;
        const deliveryFee = profitSettings.includeDeliveryFee
          ? numericAmount(order.quotation.deliveryFee)
          : 0;

        snapshot.serviceCharge += serviceCharge;
        snapshot.deliveryFee += deliveryFee;
        snapshot.total += serviceCharge + deliveryFee;
        snapshot.orderCount += 1;
        return snapshot;
      },
      {
        total: 0,
        serviceCharge: 0,
        deliveryFee: 0,
        orderCount: 0,
      },
    );
  }, [orders, profitPeriod, profitSettings, verifiedPayments]);

  const revenueData = useMemo(
    () =>
      payments.length
        ? buildRevenueData(payments, selectedPeriod)
        : emptyRevenueData(selectedPeriod),
    [payments, selectedPeriod],
  );

  const pieData = useMemo(() => buildStatusData(orders).slice(0, 6), [orders]);
  const recentOrders = useMemo(() => orders.slice(0, 8), [orders]);
  const topProducts = useMemo(() => buildTopProducts(orders), [orders]);
  const maxProductRevenue = topProducts[0]?.revenue || 1;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">
            Live dashboard from Supabase
          </p>
          {metrics.newCustomersThisMonth > 0 && (
            <p className="mt-0.5 text-xs text-emerald-600">
              {metrics.newCustomersThisMonth} new customer
              {metrics.newCustomersThisMonth === 1 ? "" : "s"} this month
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void loadDashboard(true)}
          disabled={loading || refreshing}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="rounded-xl bg-white p-4 shadow-card md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">Admin Action Centre</h2>
              {!loading && actionCentre.totalActions > 0 && (
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600">
                  {actionCentre.totalActions} action{actionCentre.totalActions === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              Priority work that needs your attention today.
            </p>
          </div>

          {!loading && (
            <div className="w-fit rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium text-neutral-600">
              {actionCentre.totalActions > 0
                ? `${actionCentre.urgentCount} area${actionCentre.urgentCount === 1 ? "" : "s"} need attention`
                : "Everything is under control"}
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {actionCentre.items.map((item) => {
            const Icon = item.icon;
            const active = item.count > 0;
            const iconStyle =
              item.urgency === "critical"
                ? "bg-red-50 text-red-600"
                : item.urgency === "attention"
                  ? "bg-amber-50 text-amber-600"
                  : "bg-emerald-50 text-emerald-600";

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.path)}
                className="group rounded-xl border border-neutral-100 bg-neutral-50/60 p-4 text-left transition hover:border-amber-200 hover:bg-white hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconStyle}`}>
                    <Icon size={18} strokeWidth={2.1} />
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-sm font-bold ${
                      active
                        ? item.urgency === "critical"
                          ? "bg-red-50 text-red-600"
                          : item.urgency === "attention"
                            ? "bg-amber-50 text-amber-600"
                            : "bg-emerald-50 text-emerald-600"
                        : "bg-neutral-100 text-neutral-400"
                    }`}
                  >
                    {loading ? "…" : item.count}
                  </span>
                </div>

                <p className="mt-3 text-sm font-semibold text-gray-900">{item.title}</p>
                <p className="mt-1 min-h-[40px] text-xs leading-5 text-neutral-500">
                  {item.description}
                </p>

                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                  {active ? "Open tasks" : "View section"}
                  <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {actionCentre.nextTrip
              ? `Next active parcel trip: ${tripDate(actionCentre.nextTrip)?.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Thimphu" })}`
              : "No upcoming active parcel trip is scheduled."}
          </span>
          <button
            type="button"
            onClick={() => navigate("/admin/parcels")}
            className="inline-flex items-center gap-1 font-semibold text-amber-600"
          >
            Manage trips <ArrowRight size={14} />
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="rounded-xl bg-white p-4 shadow-card md:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-neutral-500">{card.title}</p>
                  <p className="mt-1 text-xl font-bold text-gray-900 md:text-2xl">
                    {loading ? "..." : card.value}
                  </p>
                  {card.positive !== null && !loading && (
                    <div
                      className={`mt-1 flex items-center gap-1 text-xs font-medium ${
                        card.positive ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {card.positive ? (
                        <ArrowUpRight size={14} />
                      ) : (
                        <ArrowDownRight size={14} />
                      )}
                      {card.change}
                    </div>
                  )}
                  {card.positive === null && !loading && (
                    <p
                      className={`mt-1 text-xs font-medium ${
                        metrics.pendingQuotations > 0
                          ? "text-orange-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {card.change}
                    </p>
                  )}
                </div>
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl md:h-12 md:w-12 ${card.accent}`}
                >
                  <Icon size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-card md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <ReceiptText size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900">
                  Net Profit This Month
                </h3>
                {!businessFinance.installed && !loading && (
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
                    Setup required
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Contribution minus fuel, meals, refunds, handling, and other recorded costs.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/admin/business")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Open Profit & Trips
            <ArrowRight size={16} />
          </button>
        </div>

        {businessFinance.installed ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl bg-emerald-50 px-4 py-3">
                <p className="text-xs font-medium text-emerald-700">Contribution</p>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {loading ? "..." : formatCurrency(businessFinance.contribution)}
                </p>
              </div>
              <div className="rounded-xl bg-rose-50 px-4 py-3">
                <p className="text-xs font-medium text-rose-700">Expenses</p>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {loading ? "..." : formatCurrency(businessFinance.expenses)}
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 px-4 py-3">
                <p className="text-xs font-medium text-blue-700">Net Profit</p>
                <p className={`mt-1 text-lg font-bold ${
                  businessFinance.netProfit >= 0 ? "text-emerald-700" : "text-red-700"
                }`}>
                  {loading ? "..." : formatCurrency(businessFinance.netProfit)}
                </p>
              </div>
              <div className="rounded-xl bg-violet-50 px-4 py-3">
                <p className="text-xs font-medium text-violet-700">Target Progress</p>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {loading ? "..." : `${businessFinance.progressPercent}%`}
                </p>
              </div>
            </div>

            {businessFinance.atRiskTripCount > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-800">
                <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                {businessFinance.atRiskTripCount} planned trip
                {businessFinance.atRiskTripCount === 1 ? "" : "s"} may cost more than the expected contribution.
              </div>
            )}
          </>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-amber-200 bg-amber-50/60 px-4 py-4 text-sm text-amber-800">
            Run the Phase 3A Supabase SQL to activate expense, trip, and net-profit tracking.
          </div>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-card md:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CircleDollarSign size={19} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Estimated Gross Profit
                </h3>
                <p className="text-xs text-neutral-500">
                  Service charge + delivery charge saved in eligible quotations
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {PERIODS.map((period) => (
              <button
                key={period.key}
                type="button"
                onClick={() => setProfitPeriod(period.key)}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                  profitPeriod === period.key
                    ? "bg-emerald-500 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-emerald-700">
                  Gross Profit
                </p>
                <p className="mt-1 text-xl font-bold text-gray-900">
                  {loading ? "..." : formatCurrency(profitSnapshot.total)}
                </p>
              </div>
              <CircleDollarSign size={22} className="text-emerald-600" />
            </div>
          </div>

          <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-neutral-500">
                  Service Charges
                </p>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {loading
                    ? "..."
                    : formatCurrency(profitSnapshot.serviceCharge)}
                </p>
              </div>
              <ReceiptText size={21} className="text-violet-500" />
            </div>
          </div>

          <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-neutral-500">
                  Delivery Charges
                </p>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {loading
                    ? "..."
                    : formatCurrency(profitSnapshot.deliveryFee)}
                </p>
              </div>
              <Truck size={21} className="text-blue-500" />
            </div>
          </div>

          <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-neutral-500">
                  {profitSettings.verifiedPaymentsOnly
                    ? "Paid Orders Counted"
                    : "Quoted Orders Counted"}
                </p>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {loading ? "..." : profitSnapshot.orderCount.toLocaleString()}
                </p>
              </div>
              <ClipboardList size={21} className="text-amber-500" />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {profitSettings.verifiedPaymentsOnly
              ? "Only orders with at least one verified payment are counted."
              : "Profit is estimated from saved quotations even before payment verification."}
          </p>
          <button
            type="button"
            onClick={() => navigate("/admin/settings")}
            className="self-start font-semibold text-emerald-700 hover:text-emerald-800 sm:self-auto"
          >
            Manage profit settings
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-card md:p-5 lg:col-span-2">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <h3 className="text-base font-semibold text-gray-900">
              Verified Collections Overview
            </h3>
            <div className="flex flex-wrap gap-1">
              {PERIODS.map((period) => (
                <button
                  key={period.key}
                  type="button"
                  onClick={() => setSelectedPeriod(period.key)}
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                    selectedPeriod === period.key
                      ? "bg-amber-500 text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-56 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: number) =>
                    `${(value / 1000).toFixed(0)}k`
                  }
                />
                <Tooltip
                  formatter={(value: number | string) => [
                    formatCurrency(Number(value)),
                    "Verified Collection",
                  ]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-card md:p-5">
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            Orders by Status
          </h3>
          {loading ? (
            <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
              <Loader2 size={18} className="mr-2 animate-spin text-amber-500" />
              Loading status...
            </div>
          ) : pieData.length > 0 ? (
            <>
              <div className="h-44 md:h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                      dataKey="count"
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.status} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number | string) => [
                        Number(value),
                        "Orders",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1.5">
                {pieData.slice(0, 5).map((item) => (
                  <div
                    key={item.status}
                    className="flex items-center gap-2 text-xs"
                  >
                    <div
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="flex-1 text-neutral-600">
                      {item.label}
                    </span>
                    <span className="font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center text-center">
              <PackageSearch size={30} className="text-neutral-300" />
              <p className="mt-2 text-sm font-semibold text-neutral-700">
                No orders yet
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                Order status chart will appear here.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-4 shadow-card md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">
              Recent Orders
            </h3>
            <button
              type="button"
              onClick={() => navigate("/admin/orders")}
              className="whitespace-nowrap text-xs font-medium text-amber-600"
            >
              View All →
            </button>
          </div>
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-b border-neutral-100 text-left">
                  <th className="pb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
                    Order
                  </th>
                  <th className="pb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
                    Customer
                  </th>
                  <th className="pb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
                    Status
                  </th>
                  <th className="pb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
                    Total
                  </th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-sm text-neutral-500"
                    >
                      <Loader2
                        size={18}
                        className="mr-2 inline animate-spin text-amber-500"
                      />
                      Loading recent orders...
                    </td>
                  </tr>
                )}

                {!loading && recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center">
                      <p className="text-sm font-semibold text-neutral-700">
                        No recent orders
                      </p>
                      <p className="mt-1 text-xs text-neutral-400">
                        New customer orders will appear here.
                      </p>
                    </td>
                  </tr>
                )}

                {!loading &&
                  recentOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-neutral-50 transition-colors last:border-0 hover:bg-neutral-50"
                    >
                      <td className="py-3 text-sm font-medium text-gray-900">
                        #
                        {order.orderNumber ||
                          order.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="py-3 text-sm text-neutral-600">
                        {orderCustomerName(order)}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={order.status} size="sm" />
                      </td>
                      <td className="py-3 text-sm font-medium">
                        {orderTotal(order) > 0
                          ? formatCurrency(orderTotal(order))
                          : "-"}
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/orders/${order.id}`)}
                          className="p-1.5 text-neutral-400 transition-colors hover:text-amber-600"
                          aria-label="View order"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-card md:p-5">
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            Top Selling Products
          </h3>
          {loading ? (
            <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
              <Loader2 size={18} className="mr-2 animate-spin text-amber-500" />
              Loading products...
            </div>
          ) : topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div key={product.id} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-xs font-bold text-neutral-400">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {product.name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className="h-full rounded-full bg-amber-500"
                          style={{
                            width: `${Math.max(8, (product.revenue / maxProductRevenue) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium">
                      {product.unitsSold.toLocaleString()} sold
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatCompactCurrency(product.revenue)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center text-center">
              <PackageSearch size={30} className="text-neutral-300" />
              <p className="mt-2 text-sm font-semibold text-neutral-700">
                No product sales yet
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                Sold products will appear after orders are submitted.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
