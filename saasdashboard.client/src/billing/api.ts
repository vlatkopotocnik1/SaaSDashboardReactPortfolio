import { apiRequest } from '../api/client';
import type { BillingSummary, Invoice, PaymentMethod, Plan } from './types';

export const getPlans = () => apiRequest<Plan[]>('/api/billing/plans');

export const getBillingSummary = () => apiRequest<BillingSummary>('/api/billing/summary');

export const updateSubscription = (payload: { organizationId: string; planId: string; billingCycle: string }) =>
  apiRequest<BillingSummary>('/api/billing/subscribe', { method: 'POST', body: payload });

export const getInvoices = () => apiRequest<Invoice[]>('/api/billing/invoices');

export const getPaymentMethods = () => apiRequest<PaymentMethod[]>('/api/billing/payment-methods');

export const addPaymentMethod = (payload: {
  organizationId: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}) => apiRequest<PaymentMethod[]>('/api/billing/payment-methods', { method: 'POST', body: payload });
