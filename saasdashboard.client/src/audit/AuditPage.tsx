import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { Button, Input, Select, Table, Toast } from '../components/ui';
import { getAuditLogs } from './api';
import type { AuditLogItem } from './types';
import { getAccessToken, getSessionUser } from '../auth/session';
import { getOrganizations } from '../organizations/api';
import type { Organization } from '../organizations/types';

const pageSizeOptions = [
  { label: '10 / page', value: '10' },
  { label: '20 / page', value: '20' },
  { label: '50 / page', value: '50' },
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

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function AuditPage() {
  const sessionUser = getSessionUser();
  const isAdmin = sessionUser?.role === 'Admin';
  const [organizationId, setOrganizationId] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [exportError, setExportError] = useState<string | null>(null);

  const organizationsQuery = useQuery({
    queryKey: ['organizations', 'audit'],
    queryFn: () => getOrganizations(false),
    enabled: isAdmin,
  });

  useEffect(() => {
    if (!isAdmin) return;
    if (organizationId) return;
    if (organizationsQuery.data?.length) {
      setOrganizationId(organizationsQuery.data[0].id);
    }
  }, [isAdmin, organizationId, organizationsQuery.data]);

  useEffect(() => {
    setPage(1);
  }, [organizationId, userFilter, actionFilter, fromDate, toDate, pageSize]);

  const query = useMemo(
    () => ({
      organizationId: isAdmin ? organizationId : undefined,
      user: userFilter.trim() || undefined,
      action: actionFilter.trim() || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
      page,
      pageSize,
    }),
    [actionFilter, fromDate, isAdmin, organizationId, page, pageSize, toDate, userFilter],
  );

  const auditQuery = useQuery({
    queryKey: ['audit-logs', query],
    queryFn: () => getAuditLogs(query),
    enabled: isAdmin ? Boolean(organizationId) : true,
    placeholderData: (previous) => previous,
  });

  const organizationOptions = (organizationsQuery.data ?? []).map((org: Organization) => ({
    label: org.name,
    value: org.id,
  }));

  const totalCount = auditQuery.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const rangeStart = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(totalCount, safePage * pageSize);

  useEffect(() => {
    if (!auditQuery.data) return;
    if (safePage !== page) {
      setPage(safePage);
    }
  }, [auditQuery.data, page, safePage]);

  const columns = useMemo(
    () => [
      {
        key: 'time',
        header: 'Time',
        render: (item: AuditLogItem) => formatDateTime(item.time),
      },
      {
        key: 'user',
        header: 'User',
        render: (item: AuditLogItem) => item.user,
      },
      {
        key: 'action',
        header: 'Action',
        render: (item: AuditLogItem) => item.action,
      },
    ],
    [],
  );

  const handleExport = async () => {
    setExportError(null);
    try {
      const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
      const params = new URLSearchParams();
      if (isAdmin && organizationId) params.set('organizationId', organizationId);
      if (userFilter.trim()) params.set('user', userFilter.trim());
      if (actionFilter.trim()) params.set('action', actionFilter.trim());
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      const url = params.toString() ? `${baseUrl}/api/audit-logs/export?${params.toString()}` : `${baseUrl}/api/audit-logs/export`;
      const token = getAccessToken();
      const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (!response.ok) {
        throw new Error(`Export failed (${response.status}).`);
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      setExportError(parseError(error));
    }
  };

  return (
    <section className="page">
      <div className="audit-header">
        <div>
          <h1>Audit logs & activity</h1>
          <p>Track actions across users and systems.</p>
        </div>
        <div className="audit-actions">
          <Button type="button" variant="secondary" onClick={handleExport} disabled={auditQuery.isLoading}>
            Export CSV
          </Button>
        </div>
      </div>

      {auditQuery.isError ? (
        <Toast title="Unable to load audit logs" variant="error">
          <span>{parseError(auditQuery.error)}</span>
        </Toast>
      ) : null}

      {exportError ? (
        <Toast title="Export failed" variant="error" onClose={() => setExportError(null)}>
          <span>{exportError}</span>
        </Toast>
      ) : null}

      <div className="audit-filters">
        {isAdmin ? (
          <Select
            label="Organization"
            value={organizationId}
            options={organizationOptions}
            onChange={(event) => setOrganizationId(event.target.value)}
          />
        ) : null}
        <Input
          label="User"
          placeholder="Search by username"
          value={userFilter}
          onChange={(event) => setUserFilter(event.target.value)}
        />
        <Input
          label="Action"
          placeholder="Search by action"
          value={actionFilter}
          onChange={(event) => setActionFilter(event.target.value)}
        />
        <Input
          label="From"
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
        />
        <Input
          label="To"
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
        />
        <Select
          label="Page size"
          value={String(pageSize)}
          options={pageSizeOptions}
          onChange={(event) => setPageSize(Number(event.target.value))}
        />
      </div>

      <div className="audit-summary">
        <span>
          {totalCount === 0 ? 'No audit logs found.' : `Showing ${rangeStart}-${rangeEnd} of ${totalCount}`}
        </span>
        <span>Page {safePage} of {totalPages}</span>
      </div>

      <Table
        columns={columns}
        data={auditQuery.data?.items ?? []}
        emptyMessage={auditQuery.isLoading ? 'Loading audit logs…' : 'No audit logs'}
      />

      <div className="audit-pagination">
        <Button
          variant="secondary"
          type="button"
          disabled={safePage <= 1 || auditQuery.isLoading}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          type="button"
          disabled={safePage >= totalPages || auditQuery.isLoading}
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
        >
          Next
        </Button>
      </div>
    </section>
  );
}
