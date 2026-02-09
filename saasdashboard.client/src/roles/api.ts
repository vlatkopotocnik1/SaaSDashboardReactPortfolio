import { apiRequest } from '../api/client';
import type { Permission, Role } from './types';

export type RolePayload = {
  name: string;
  description?: string;
  permissionKeys: string[];
};

export const getRoles = () => apiRequest<Role[]>('/api/roles');

export const getPermissions = () => apiRequest<Permission[]>('/api/roles/permissions');

export const createRole = (payload: RolePayload) =>
  apiRequest<Role>('/api/roles', { method: 'POST', body: payload });

export const updateRole = (id: string, payload: RolePayload) =>
  apiRequest<Role>(`/api/roles/${id}`, { method: 'PUT', body: payload });

export const deleteRole = (id: string) =>
  apiRequest<void>(`/api/roles/${id}`, { method: 'DELETE' });
