import { apiRequest } from '../api/client';
import type { AuditLogPage } from './types';

type AuditLogFilters = {
  organizationId?: string;
  user?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

const buildQuery = (filters: AuditLogFilters) => {
  const params = new URLSearchParams();
  if (filters.organizationId) params.set('organizationId', filters.organizationId);
  if (filters.user) params.set('user', filters.user);
  if (filters.action) params.set('action', filters.action);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  return params.toString();
};

export const getAuditLogs = (filters: AuditLogFilters) => {
  const query = buildQuery(filters);
  const path = query ? `/api/audit-logs?${query}` : '/api/audit-logs';
  return apiRequest<AuditLogPage>(path);
};
