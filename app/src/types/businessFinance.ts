export type BusinessTripStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type BusinessExpenseCategory =
  | 'fuel'
  | 'meals'
  | 'tolls'
  | 'porter'
  | 'refunds'
  | 'packaging'
  | 'delivery'
  | 'miscellaneous';

export type BusinessTrip = {
  id: string;
  title: string;
  route: string;
  tripDate: string;
  status: BusinessTripStatus;
  expectedContribution: number;
  estimatedCost: number;
  notes: string;
  parcelTripId?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BusinessTripOrder = {
  id: string;
  businessTripId: string;
  orderId: string;
  contributionAmount: number;
  notes: string;
  createdAt: string;
};

export type BusinessExpense = {
  id: string;
  expenseDate: string;
  category: BusinessExpenseCategory;
  amount: number;
  description: string;
  businessTripId?: string | null;
  orderId?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BusinessTripFinancial = BusinessTrip & {
  linkedOrderCount: number;
  linkedContribution: number;
  recordedExpenses: number;
  netContribution: number;
  plannedMargin: number;
  isAtRisk: boolean;
};

export type BusinessFinanceSummary = {
  installed: boolean;
  month: string;
  contribution: number;
  expenses: number;
  netProfit: number;
  monthlyTarget: number;
  progressPercent: number;
  eligibleOrderCount: number;
  plannedTripCount: number;
  atRiskTripCount: number;
};

export type BusinessFinanceData = {
  summary: BusinessFinanceSummary;
  trips: BusinessTripFinancial[];
  expenses: BusinessExpense[];
  tripOrders: BusinessTripOrder[];
};
