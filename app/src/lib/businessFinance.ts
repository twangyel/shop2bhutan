import { supabase } from '@/lib/supabase';
import {
  fetchAdminOrders,
  fetchAdminPayments,
  type AdminPaymentRecord,
} from '@/lib/customerOrders';
import type { Order } from '@/types';
import type {
  BusinessExpense,
  BusinessExpenseCategory,
  BusinessFinanceData,
  BusinessFinanceSummary,
  BusinessTrip,
  BusinessTripFinancial,
  BusinessTripOrder,
  BusinessTripStatus,
} from '@/types/businessFinance';

type Row = Record<string, unknown>;

type FinanceSettings = {
  includeServiceCharge: boolean;
  includeDeliveryFee: boolean;
  verifiedPaymentsOnly: boolean;
  monthlyTarget: number;
};

const FINANCE_SETTING_KEYS = {
  includeServiceCharge: 'profit_include_service_charge',
  includeDeliveryFee: 'profit_include_delivery_fee',
  verifiedPaymentsOnly: 'profit_verified_payments_only',
  monthlyTarget: 'profit_monthly_target',
} as const;

const DEFAULT_FINANCE_SETTINGS: FinanceSettings = {
  includeServiceCharge: true,
  includeDeliveryFee: true,
  verifiedPaymentsOnly: true,
  monthlyTarget: 10000,
};

export const DEFAULT_BUSINESS_FINANCE_SUMMARY: BusinessFinanceSummary = {
  installed: false,
  month: currentMonthValue(),
  contribution: 0,
  expenses: 0,
  netProfit: 0,
  monthlyTarget: DEFAULT_FINANCE_SETTINGS.monthlyTarget,
  progressPercent: 0,
  eligibleOrderCount: 0,
  plannedTripCount: 0,
  atRiskTripCount: 0,
};

function currentMonthValue() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function numberValue(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function booleanValue(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const normalized = cleanText(value).toLowerCase();
  if (['true', '1', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return fallback;
}

function monthBounds(month: string) {
  const safeMonth = /^\d{4}-\d{2}$/.test(month) ? month : currentMonthValue();
  const [year, monthNumber] = safeMonth.split('-').map(Number);
  const start = new Date(year, monthNumber - 1, 1);
  const end = new Date(year, monthNumber, 1);
  return { month: safeMonth, start, end };
}

function dateValue(value: unknown) {
  const raw = cleanText(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function inMonth(value: unknown, start: Date, end: Date) {
  const date = dateValue(value);
  return Boolean(date && date >= start && date < end);
}

function isMissingFinanceTableError(error: unknown) {
  const row = (error ?? {}) as { code?: string; message?: string };
  const code = cleanText(row.code);
  const message = cleanText(row.message).toLowerCase();

  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('business_trips') ||
    message.includes('business_expenses') ||
    message.includes('business_trip_orders')
  );
}

function mapTrip(row: Row): BusinessTrip {
  return {
    id: cleanText(row.id),
    title: cleanText(row.title) || 'Business trip',
    route: cleanText(row.route),
    tripDate: cleanText(row.trip_date),
    status: (cleanText(row.status) || 'planned') as BusinessTripStatus,
    expectedContribution: numberValue(row.expected_contribution),
    estimatedCost: numberValue(row.estimated_cost),
    notes: cleanText(row.notes),
    parcelTripId: cleanText(row.parcel_trip_id) || null,
    createdBy: cleanText(row.created_by) || null,
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
  };
}

function mapExpense(row: Row): BusinessExpense {
  return {
    id: cleanText(row.id),
    expenseDate: cleanText(row.expense_date),
    category: (cleanText(row.category) || 'miscellaneous') as BusinessExpenseCategory,
    amount: numberValue(row.amount),
    description: cleanText(row.description),
    businessTripId: cleanText(row.business_trip_id) || null,
    orderId: cleanText(row.order_id) || null,
    createdBy: cleanText(row.created_by) || null,
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
  };
}

function mapTripOrder(row: Row): BusinessTripOrder {
  return {
    id: cleanText(row.id),
    businessTripId: cleanText(row.business_trip_id),
    orderId: cleanText(row.order_id),
    contributionAmount: numberValue(row.contribution_amount),
    notes: cleanText(row.notes),
    createdAt: cleanText(row.created_at),
  };
}

async function fetchFinanceSettings(): Promise<FinanceSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key,value')
    .in('key', Object.values(FINANCE_SETTING_KEYS));

  if (error) {
    console.warn('[BusinessFinance] Settings fallback:', error);
    return DEFAULT_FINANCE_SETTINGS;
  }

  const rows = (data ?? []) as Row[];
  const valueFor = (key: string) =>
    rows.find((row) => cleanText(row.key) === key)?.value;

  return {
    includeServiceCharge: booleanValue(
      valueFor(FINANCE_SETTING_KEYS.includeServiceCharge),
      DEFAULT_FINANCE_SETTINGS.includeServiceCharge,
    ),
    includeDeliveryFee: booleanValue(
      valueFor(FINANCE_SETTING_KEYS.includeDeliveryFee),
      DEFAULT_FINANCE_SETTINGS.includeDeliveryFee,
    ),
    verifiedPaymentsOnly: booleanValue(
      valueFor(FINANCE_SETTING_KEYS.verifiedPaymentsOnly),
      DEFAULT_FINANCE_SETTINGS.verifiedPaymentsOnly,
    ),
    monthlyTarget: Math.max(
      0,
      numberValue(valueFor(FINANCE_SETTING_KEYS.monthlyTarget)) ||
        DEFAULT_FINANCE_SETTINGS.monthlyTarget,
    ),
  };
}

function paymentRecognitionDate(payment: AdminPaymentRecord) {
  return (
    dateValue(payment.verifiedAt) ||
    dateValue(payment.createdAt) ||
    dateValue((payment as { submittedAt?: string }).submittedAt)
  );
}

function orderRecognitionDate(
  order: Order,
  verifiedPayments: AdminPaymentRecord[],
  verifiedOnly: boolean,
) {
  if (verifiedOnly) {
    return verifiedPayments
      .filter(
        (payment) =>
          payment.orderId === order.id &&
          cleanText(payment.status).toLowerCase() === 'verified',
      )
      .map(paymentRecognitionDate)
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  }

  return (
    dateValue(order.quotation?.respondedAt) ||
    dateValue(order.quotation?.createdAt) ||
    dateValue(order.updatedAt) ||
    dateValue(order.createdAt)
  );
}

export function estimatedOrderContribution(
  order: Order,
  settings: Pick<
    FinanceSettings,
    'includeServiceCharge' | 'includeDeliveryFee'
  > = DEFAULT_FINANCE_SETTINGS,
) {
  if (!order.quotation || order.status === 'cancelled') return 0;

  const serviceCharge = settings.includeServiceCharge
    ? numberValue(order.quotation.serviceCharge)
    : 0;
  const deliveryFee = settings.includeDeliveryFee
    ? numberValue(order.quotation.deliveryFee)
    : 0;

  return Math.max(0, serviceCharge + deliveryFee);
}

async function fetchFinanceRows() {
  const [tripsResult, expensesResult, tripOrdersResult] = await Promise.all([
    supabase
      .from('business_trips')
      .select('*')
      .order('trip_date', { ascending: false }),
    supabase
      .from('business_expenses')
      .select('*')
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('business_trip_orders')
      .select('*')
      .order('created_at', { ascending: false }),
  ]);

  const firstError =
    tripsResult.error || expensesResult.error || tripOrdersResult.error;
  if (firstError) throw firstError;

  return {
    trips: ((tripsResult.data ?? []) as Row[]).map(mapTrip),
    expenses: ((expensesResult.data ?? []) as Row[]).map(mapExpense),
    tripOrders: ((tripOrdersResult.data ?? []) as Row[]).map(mapTripOrder),
  };
}

function buildTripFinancials(
  trips: BusinessTrip[],
  expenses: BusinessExpense[],
  tripOrders: BusinessTripOrder[],
): BusinessTripFinancial[] {
  return trips.map((trip) => {
    const linkedOrders = tripOrders.filter(
      (link) => link.businessTripId === trip.id,
    );
    const linkedContribution = linkedOrders.reduce(
      (sum, link) => sum + link.contributionAmount,
      0,
    );
    const recordedExpenses = expenses
      .filter((expense) => expense.businessTripId === trip.id)
      .reduce((sum, expense) => sum + expense.amount, 0);
    const netContribution = linkedContribution - recordedExpenses;
    const plannedMargin = trip.expectedContribution - trip.estimatedCost;
    const isAtRisk =
      trip.status !== 'cancelled' &&
      ((trip.status === 'planned' && plannedMargin < 0) ||
        (trip.status !== 'planned' &&
          linkedContribution > 0 &&
          netContribution < 0));

    return {
      ...trip,
      linkedOrderCount: linkedOrders.length,
      linkedContribution,
      recordedExpenses,
      netContribution,
      plannedMargin,
      isAtRisk,
    };
  });
}

export async function fetchBusinessFinanceData(
  requestedMonth = currentMonthValue(),
): Promise<BusinessFinanceData> {
  const { month, start, end } = monthBounds(requestedMonth);

  const [financeRows, orders, payments, settings] = await Promise.all([
    fetchFinanceRows(),
    fetchAdminOrders(),
    fetchAdminPayments(),
    fetchFinanceSettings(),
  ]);

  const tripFinancials = buildTripFinancials(
    financeRows.trips,
    financeRows.expenses,
    financeRows.tripOrders,
  );

  const eligibleOrders = orders.filter((order) => {
    const recognizedAt = orderRecognitionDate(
      order,
      payments,
      settings.verifiedPaymentsOnly,
    );

    return Boolean(
      recognizedAt &&
        recognizedAt >= start &&
        recognizedAt < end &&
        estimatedOrderContribution(order, settings) > 0,
    );
  });

  const contribution = eligibleOrders.reduce(
    (sum, order) => sum + estimatedOrderContribution(order, settings),
    0,
  );
  const monthExpenses = financeRows.expenses
    .filter((expense) => inMonth(expense.expenseDate, start, end))
    .reduce((sum, expense) => sum + expense.amount, 0);
  const netProfit = contribution - monthExpenses;
  const monthlyTarget = settings.monthlyTarget;
  const progressPercent =
    monthlyTarget > 0
      ? Math.max(0, Math.min(999, Math.round((netProfit / monthlyTarget) * 100)))
      : 0;

  const plannedTrips = tripFinancials.filter(
    (trip) => trip.status === 'planned' && inMonth(trip.tripDate, start, end),
  );

  return {
    summary: {
      installed: true,
      month,
      contribution,
      expenses: monthExpenses,
      netProfit,
      monthlyTarget,
      progressPercent,
      eligibleOrderCount: eligibleOrders.length,
      plannedTripCount: plannedTrips.length,
      atRiskTripCount: plannedTrips.filter((trip) => trip.isAtRisk).length,
    },
    trips: tripFinancials,
    expenses: financeRows.expenses,
    tripOrders: financeRows.tripOrders,
  };
}

export async function fetchBusinessFinanceSummary(
  requestedMonth = currentMonthValue(),
  options?: { allowMissing?: boolean },
): Promise<BusinessFinanceSummary> {
  try {
    const data = await fetchBusinessFinanceData(requestedMonth);
    return data.summary;
  } catch (error) {
    if (options?.allowMissing && isMissingFinanceTableError(error)) {
      const { month } = monthBounds(requestedMonth);
      return {
        ...DEFAULT_BUSINESS_FINANCE_SUMMARY,
        month,
      };
    }
    throw error;
  }
}

export async function createBusinessTrip(input: {
  title: string;
  route: string;
  tripDate: string;
  expectedContribution: number;
  estimatedCost: number;
  status?: BusinessTripStatus;
  notes?: string;
  parcelTripId?: string | null;
  createdBy?: string | null;
}) {
  const { data, error } = await supabase
    .from('business_trips')
    .insert({
      title: cleanText(input.title) || 'Business trip',
      route: cleanText(input.route),
      trip_date: input.tripDate,
      status: input.status ?? 'planned',
      expected_contribution: Math.max(0, numberValue(input.expectedContribution)),
      estimated_cost: Math.max(0, numberValue(input.estimatedCost)),
      notes: cleanText(input.notes) || null,
      parcel_trip_id: cleanText(input.parcelTripId) || null,
      created_by: input.createdBy || null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapTrip((data ?? {}) as Row);
}

export async function updateBusinessTripStatus(
  tripId: string,
  status: BusinessTripStatus,
) {
  const { error } = await supabase
    .from('business_trips')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tripId);

  if (error) throw error;
}

export async function deleteBusinessTrip(tripId: string) {
  const { error } = await supabase
    .from('business_trips')
    .delete()
    .eq('id', tripId);

  if (error) throw error;
}

export async function createBusinessExpense(input: {
  expenseDate: string;
  category: BusinessExpenseCategory;
  amount: number;
  description: string;
  businessTripId?: string | null;
  orderId?: string | null;
  createdBy?: string | null;
}) {
  const { data, error } = await supabase
    .from('business_expenses')
    .insert({
      expense_date: input.expenseDate,
      category: input.category,
      amount: Math.max(0, numberValue(input.amount)),
      description: cleanText(input.description),
      business_trip_id: cleanText(input.businessTripId) || null,
      order_id: cleanText(input.orderId) || null,
      created_by: input.createdBy || null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapExpense((data ?? {}) as Row);
}

export async function deleteBusinessExpense(expenseId: string) {
  const { error } = await supabase
    .from('business_expenses')
    .delete()
    .eq('id', expenseId);

  if (error) throw error;
}

export async function linkOrderToBusinessTrip(input: {
  businessTripId: string;
  orderId: string;
  contributionAmount: number;
  notes?: string;
}) {
  const { data, error } = await supabase
    .from('business_trip_orders')
    .upsert(
      {
        business_trip_id: input.businessTripId,
        order_id: input.orderId,
        contribution_amount: Math.max(0, numberValue(input.contributionAmount)),
        notes: cleanText(input.notes) || null,
      },
      { onConflict: 'business_trip_id,order_id' },
    )
    .select('*')
    .single();

  if (error) throw error;
  return mapTripOrder((data ?? {}) as Row);
}

export async function unlinkOrderFromBusinessTrip(linkId: string) {
  const { error } = await supabase
    .from('business_trip_orders')
    .delete()
    .eq('id', linkId);

  if (error) throw error;
}
