export type Plan = {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  isPopular: boolean;
};

export type UsageSummary = {
  seatsUsed: number;
  seatsLimit: number;
  storageUsedGb: number;
  storageLimitGb: number;
  apiCallsUsed: number;
  apiCallsLimit: number;
};

export type BillingSummary = {
  organizationId: string;
  organizationName: string;
  currentPlan: Plan;
  status: string;
  billingCycle: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  usage: UsageSummary;
};

export type Invoice = {
  id: string;
  number: string;
  issuedAt: string;
  dueAt: string;
  paidAt?: string | null;
  amount: number;
  currency: string;
  status: string;
  periodStart: string;
  periodEnd: string;
};

export type PaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
};
