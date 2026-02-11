import { apiRequest } from '../api/client';
import type { BillingSummary, Invoice, PaymentMethod, Plan } from './types';

export const getPlans = () => apiRequest<Plan[]>('/api/billing/plans');

export const getBillingSummary = (organizationId?: string) => {
  const params = new URLSearchParams();
  if (organizationId) {
    params.set('organizationId', organizationId);
  }
  const path = params.toString() ? `/api/billing/summary?${params.toString()}` : '/api/billing/summary';
  return apiRequest<BillingSummary>(path);
};

export const updateSubscription = (payload: { organizationId: string; planId: string; billingCycle: string }) =>
  apiRequest<BillingSummary>('/api/billing/subscribe', { method: 'POST', body: payload });

export const getInvoices = (organizationId?: string) => {
  const params = new URLSearchParams();
  if (organizationId) {
    params.set('organizationId', organizationId);
  }
  const path = params.toString() ? `/api/billing/invoices?${params.toString()}` : '/api/billing/invoices';
  return apiRequest<Invoice[]>(path);
};

export const getPaymentMethods = (organizationId?: string) => {
  const params = new URLSearchParams();
  if (organizationId) {
    params.set('organizationId', organizationId);
  }
  const path = params.toString() ? `/api/billing/payment-methods?${params.toString()}` : '/api/billing/payment-methods';
  return apiRequest<PaymentMethod[]>(path);
};

export const addPaymentMethod = (payload: {
  organizationId: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}) => apiRequest<PaymentMethod[]>('/api/billing/payment-methods', { method: 'POST', body: payload });
