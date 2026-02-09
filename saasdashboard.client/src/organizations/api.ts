import { apiRequest } from '../api/client';
import type { Organization, OrganizationDetail, TeamSummary } from './types';

export type OrganizationPayload = {
  name: string;
};

export type TeamPayload = {
  name: string;
};

export const getOrganizations = (includeTeams = false) => {
  const params = new URLSearchParams();
  if (includeTeams) {
    params.set('includeTeams', 'true');
  }
  const path = params.toString() ? `/api/organizations?${params.toString()}` : '/api/organizations';
  return apiRequest<Organization[]>(path);
};

export const getOrganization = (id: string) => {
  return apiRequest<OrganizationDetail>(`/api/organizations/${id}`);
};

export const createOrganization = (payload: OrganizationPayload) => {
  return apiRequest<Organization>(`/api/organizations`, { method: 'POST', body: payload });
};

export const updateOrganization = (id: string, payload: OrganizationPayload) => {
  return apiRequest<Organization>(`/api/organizations/${id}`, { method: 'PUT', body: payload });
};

export const deleteOrganization = (id: string) => {
  return apiRequest<void>(`/api/organizations/${id}`, { method: 'DELETE' });
};

export const createTeam = (organizationId: string, payload: TeamPayload) => {
  return apiRequest<TeamSummary>(`/api/organizations/${organizationId}/teams`, { method: 'POST', body: payload });
};

export const updateTeam = (id: string, payload: TeamPayload) => {
  return apiRequest<TeamSummary>(`/api/organizations/teams/${id}`, { method: 'PUT', body: payload });
};

export const deleteTeam = (id: string) => {
  return apiRequest<void>(`/api/organizations/teams/${id}`, { method: 'DELETE' });
};
