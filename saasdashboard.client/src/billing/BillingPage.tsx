import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { Button, Input, Modal, Select, Table, Toast } from '../components/ui';
import { addPaymentMethod, getBillingSummary, getInvoices, getPaymentMethods, getPlans, updateSubscription } from './api';
import type { Invoice, PaymentMethod } from './types';
import { getAccessToken, getSessionUser } from '../auth/session';
import { getOrganizations } from '../organizations/api';
import type { Organization } from '../organizations/types';

const billingCycleOptions = [
  { label: 'Monthly billing', value: 'Monthly' },
  { label: 'Yearly billing', value: 'Yearly' },
];

const cardBrandOptions = [
  { label: 'Visa', value: 'Visa' },
  { label: 'Mastercard', value: 'Mastercard' },
  { label: 'American Express', value: 'Amex' },
  { label: 'Discover', value: 'Discover' },
];

const parseError = (error: unknown) => {
  if (error instanceof ApiError) {
    const message = (error.payload as { message?: string } | undefined)?.message;
    return message ?? `Request failed (${error.status}).`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong.';
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const formatUsage = (used: number, limit: number) => `${used.toLocaleString()} / ${limit.toLocaleString()}`;

export function BillingPage() {
  const queryClient = useQueryClient();
  const sessionUser = getSessionUser();
  const isAdmin = sessionUser?.role === 'Admin';
  const [billingCycle, setBillingCycle] = useState<'Monthly' | 'Yearly'>('Monthly');
  const [error, setError] = useState<string | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentBrand, setPaymentBrand] = useState('Visa');
  const [paymentLast4, setPaymentLast4] = useState('');
  const [paymentExpMonth, setPaymentExpMonth] = useState(12);
  const [paymentExpYear, setPaymentExpYear] = useState(new Date().getFullYear() + 2);
  const [paymentDefault, setPaymentDefault] = useState(true);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  const plansQuery = useQuery({ queryKey: ['billing', 'plans'], queryFn: getPlans });
  const organizationsQuery = useQuery({
    queryKey: ['organizations', 'billing'],
    queryFn: () => getOrganizations(false),
    enabled: isAdmin,
  });
  const summaryQuery = useQuery({
    queryKey: ['billing', 'summary', isAdmin ? selectedOrgId : 'self'],
    queryFn: () => getBillingSummary(isAdmin ? selectedOrgId : undefined),
    enabled: isAdmin ? Boolean(selectedOrgId) : true,
  });
  const invoicesQuery = useQuery({
    queryKey: ['billing', 'invoices', isAdmin ? selectedOrgId : 'self'],
    queryFn: () => getInvoices(isAdmin ? selectedOrgId : undefined),
    enabled: isAdmin ? Boolean(selectedOrgId) : true,
  });
  const paymentMethodsQuery = useQuery({
    queryKey: ['billing', 'payment-methods', isAdmin ? selectedOrgId : 'self'],
    queryFn: () => getPaymentMethods(isAdmin ? selectedOrgId : undefined),
    enabled: isAdmin ? Boolean(selectedOrgId) : true,
  });

  const summary = summaryQuery.data;
  const plans = plansQuery.data ?? [];

  const currentPlanId = summary?.currentPlan.id ?? '';
  const organizationId = (isAdmin ? selectedOrgId : summary?.organizationId) ?? '';
  const organizationOptions = (organizationsQuery.data ?? []).map((org: Organization) => ({
    label: org.name,
    value: org.id,
  }));

  const availableOrgId = organizationId || summary?.organizationId || '';

  useEffect(() => {
    if (!isAdmin) return;
    if (selectedOrgId) return;
    if (organizationsQuery.data?.length) {
      setSelectedOrgId(organizationsQuery.data[0].id);
    }
  }, [isAdmin, organizationsQuery.data, selectedOrgId]);

  const selectMutation = useMutation({
    mutationFn: updateSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      setError(null);
    },
    onError: (err) => setError(parseError(err)),
  });

  const paymentMutation = useMutation({
    mutationFn: addPaymentMethod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'payment-methods'] });
      setIsPaymentModalOpen(false);
      setPaymentError(null);
    },
    onError: (err) => setPaymentError(parseError(err)),
  });

  const usageItems = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: 'Seats',
        used: summary.usage.seatsUsed,
        limit: summary.usage.seatsLimit,
      },
      {
        label: 'Storage (GB)',
        used: summary.usage.storageUsedGb,
        limit: summary.usage.storageLimitGb,
      },
      {
        label: 'API calls',
        used: summary.usage.apiCallsUsed,
        limit: summary.usage.apiCallsLimit,
      },
    ];
  }, [summary]);


  const paymentColumns = useMemo(
    () => [
      {
        key: 'method',
        header: 'Method',
        render: (method: PaymentMethod) => `${method.brand} •••• ${method.last4}`,
      },
      {
        key: 'expires',
        header: 'Expires',
        render: (method: PaymentMethod) => `${String(method.expMonth).padStart(2, '0')}/${method.expYear}`,
      },
      {
        key: 'default',
        header: 'Default',
        render: (method: PaymentMethod) => (method.isDefault ? 'Yes' : 'No'),
      },
    ],
    [],
  );

  const planPerks: Record<string, string[]> = {
    Starter: ['Up to 10 seats', 'Basic analytics', 'Community support'],
    Growth: ['Up to 50 seats', 'Advanced analytics', 'Priority support'],
    Enterprise: ['Unlimited seats', 'Custom roles', 'Dedicated CSM'],
  };

  const downloadInvoice = useCallback(async (invoice: Invoice) => {
    try {
      const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
      const token = getAccessToken();
      const params = new URLSearchParams();
      if (isAdmin && selectedOrgId) {
        params.set('organizationId', selectedOrgId);
      }
      const downloadUrl = params.toString()
        ? `${baseUrl}/api/billing/invoices/${invoice.id}/download?${params.toString()}`
        : `${baseUrl}/api/billing/invoices/${invoice.id}/download`;
      const response = await fetch(downloadUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) {
        throw new Error(`Download failed (${response.status}).`);
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${invoice.number}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(parseError(err));
    }
  }, [isAdmin, selectedOrgId]);

  const invoiceColumns = useMemo(
    () => [
      {
        key: 'number',
        header: 'Invoice',
        render: (invoice: Invoice) => invoice.number,
      },
      {
        key: 'period',
        header: 'Period',
        render: (invoice: Invoice) =>
          `${formatDate(invoice.periodStart)} - ${formatDate(invoice.periodEnd)}`,
      },
      {
        key: 'amount',
        header: 'Amount',
        render: (invoice: Invoice) => `${invoice.currency} ${invoice.amount.toFixed(2)}`,
      },
      {
        key: 'status',
        header: 'Status',
        render: (invoice: Invoice) => invoice.status,
      },
      {
        key: 'download',
        header: '',
        render: (invoice: Invoice) => (
          <Button variant="ghost" type="button" onClick={() => downloadInvoice(invoice)}>
            Download
          </Button>
        ),
      },
    ],
    [downloadInvoice],
  );

  return (
    <section className="page">
      {isAdmin ? (
        <div className="billing-org-banner">
          <div className="billing-org-banner-text">
            <div className="billing-org-banner-title">Organization billing</div>
            <div className="billing-org-banner-subtitle">Choose the organization to manage billing, plans, and invoices.</div>
          </div>
          <Select
            label="Organization"
            value={selectedOrgId}
            options={organizationOptions}
            onChange={(event) => setSelectedOrgId(event.target.value)}
          />
        </div>
      ) : null}

      <div className="billing-header">
        <div>
          <h1>Billing & plans</h1>
          <p>Plan selector, usage summary, and subscription status.</p>
        </div>
        <div className="billing-controls">
          <Select
            label="Billing cycle"
            value={billingCycle}
            options={billingCycleOptions}
            onChange={(event) => setBillingCycle(event.target.value as 'Monthly' | 'Yearly')}
          />
        </div>
      </div>

      {summaryQuery.isError ? (
        <Toast title="Unable to load billing summary" variant="error">
          <span>{parseError(summaryQuery.error)}</span>
        </Toast>
      ) : null}

      {plansQuery.isError ? (
        <Toast title="Unable to load plans" variant="error">
          <span>{parseError(plansQuery.error)}</span>
        </Toast>
      ) : null}

      {summary ? (
        <div className="billing-status">
          <div>
            <h2>{summary.organizationName}</h2>
            <p>
              Status: <strong>{summary.status}</strong>
              {summary.cancelAtPeriodEnd ? ' (cancels at period end)' : ''}
            </p>
          </div>
          <div className="billing-status-meta">
            <div>Current plan: {summary.currentPlan.name}</div>
            <div>
              Renewal: {formatDate(summary.currentPeriodEnd)} · Cycle: {summary.billingCycle}
            </div>
          </div>
        </div>
      ) : null}

      <div className="billing-plans">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const price = billingCycle === 'Yearly' ? plan.priceYearly : plan.priceMonthly;
          const perks = planPerks[plan.name] ?? ['Custom limits', 'Standard support'];
          return (
            <div
              key={plan.id}
              className={[
                'plan-card',
                plan.isPopular ? 'plan-card--popular' : '',
                isCurrent ? 'plan-card--current' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {plan.isPopular ? <span className="plan-badge">Popular</span> : null}
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
              <ul className="plan-perks">
                {perks.map((perk) => (
                  <li key={perk}>{perk}</li>
                ))}
              </ul>
              <div className="plan-price">
                ${price}
                <span>/ {billingCycle === 'Yearly' ? 'year' : 'month'}</span>
              </div>
              <Button
                variant={isCurrent ? 'secondary' : 'primary'}
                type="button"
                disabled={!availableOrgId || selectMutation.isPending}
                onClick={() => {
                  setError(null);
                  if (!availableOrgId) return;
                  selectMutation.mutate({ organizationId: availableOrgId, planId: plan.id, billingCycle });
                }}
              >
                {isCurrent ? 'Current plan' : 'Select plan'}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="billing-usage">
        <div className="billing-usage-header">
          <h3>Usage summary</h3>
          {summary ? <span>Period ends {formatDate(summary.currentPeriodEnd)}</span> : null}
        </div>
        <div className="billing-usage-grid">
          {usageItems.map((item) => {
            const percent = item.limit === 0 ? 0 : Math.min(100, Math.round((item.used / item.limit) * 100));
            return (
              <div key={item.label} className="usage-card">
                <div className="usage-card-header">
                  <span>{item.label}</span>
                  <span>{formatUsage(item.used, item.limit)}</span>
                </div>
                <div className="usage-bar">
                  <div className="usage-bar-fill" style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="billing-secondary">
        <div className="billing-card">
          <div className="billing-card-header">
            <h3>Payment methods</h3>
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setPaymentError(null);
                setPaymentBrand('Visa');
                setPaymentLast4('');
                setPaymentExpMonth(12);
                setPaymentExpYear(new Date().getFullYear() + 2);
                setPaymentDefault(true);
                setIsPaymentModalOpen(true);
              }}
            >
              Add method
            </Button>
          </div>
          {paymentMethodsQuery.isError ? (
            <Toast title="Unable to load payment methods" variant="error">
              <span>{parseError(paymentMethodsQuery.error)}</span>
            </Toast>
          ) : null}
          <Table
            columns={paymentColumns}
            data={paymentMethodsQuery.data ?? []}
            emptyMessage="No payment methods yet."
          />
        </div>
        <div className="billing-card">
          <div className="billing-card-header">
            <h3>Invoice history</h3>
          </div>
          {invoicesQuery.isError ? (
            <Toast title="Unable to load invoices" variant="error">
              <span>{parseError(invoicesQuery.error)}</span>
            </Toast>
          ) : null}
          <Table
            columns={invoiceColumns}
            data={invoicesQuery.data ?? []}
            emptyMessage="No invoices yet."
          />
        </div>
      </div>

      {error ? (
        <Toast title="Billing update failed" variant="error" onClose={() => setError(null)}>
          <span>{error}</span>
        </Toast>
      ) : null}

      <Modal
        isOpen={isPaymentModalOpen}
        title="Add payment method"
        onClose={() => {
          if (paymentMutation.isPending) return;
          setIsPaymentModalOpen(false);
          setPaymentError(null);
        }}
      >
        <div className="billing-form">
          <Select
            label="Card brand"
            value={paymentBrand}
            options={cardBrandOptions}
            onChange={(event) => setPaymentBrand(event.target.value)}
          />
          <Input
            label="Last 4 digits"
            placeholder="4242"
            value={paymentLast4}
            onChange={(event) => setPaymentLast4(event.target.value.replace(/\D/g, '').slice(0, 4))}
            error={paymentError ?? undefined}
          />
          <div className="billing-form-row">
            <Input
              label="Exp month"
              type="number"
              min={1}
              max={12}
              value={paymentExpMonth}
              onChange={(event) => setPaymentExpMonth(Number(event.target.value))}
            />
            <Input
              label="Exp year"
              type="number"
              min={new Date().getFullYear()}
              max={new Date().getFullYear() + 15}
              value={paymentExpYear}
              onChange={(event) => setPaymentExpYear(Number(event.target.value))}
            />
          </div>
          <label className="billing-checkbox">
            <input
              type="checkbox"
              checked={paymentDefault}
              onChange={(event) => setPaymentDefault(event.target.checked)}
            />
            Set as default
          </label>
          <div className="billing-form-actions">
            <Button
              type="button"
              disabled={paymentMutation.isPending || !availableOrgId || paymentLast4.length !== 4}
              onClick={() => {
                if (!availableOrgId) return;
                setPaymentError(null);
                paymentMutation.mutate({
                  organizationId: availableOrgId,
                  brand: paymentBrand.trim(),
                  last4: paymentLast4,
                  expMonth: paymentExpMonth,
                  expYear: paymentExpYear,
                  isDefault: paymentDefault,
                });
              }}
            >
              {paymentMutation.isPending ? 'Saving…' : 'Save method'}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
