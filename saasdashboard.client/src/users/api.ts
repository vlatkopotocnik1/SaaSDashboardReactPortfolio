import { apiRequest } from '../api/client';
import type { PagedResponse, User, UserRole } from './types';

export type UsersQuery = {
  page: number;
  pageSize: number;
  search?: string;
  role?: UserRole;
  organizationId?: string;
  teamId?: string;
};

export type CreateUserPayload = {
  username: string;
  role: UserRole;
  password: string;
  organizationId: string;
  teamId: string;
};

export type UpdateUserPayload = {
  username: string;
  role: UserRole;
  password?: string;
  organizationId: string;
  teamId: string;
};

export const getUsers = (query: UsersQuery) => {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.search) {
    params.set('search', query.search);
  }
  if (query.role) {
    params.set('role', query.role);
  }
  if (query.organizationId) {
    params.set('organizationId', query.organizationId);
  }
  if (query.teamId) {
    params.set('teamId', query.teamId);
  }

  const path = `/api/users?${params.toString()}`;
  return apiRequest<PagedResponse<User>>(path);
};

export const createUser = (payload: CreateUserPayload) => {
  return apiRequest<User>('/api/users', {
    method: 'POST',
    body: payload,
  });
};

export const updateUser = (id: string, payload: UpdateUserPayload) => {
  return apiRequest<User>(`/api/users/${id}`, {
    method: 'PUT',
    body: payload,
  });
};

export const deleteUser = (id: string) => {
  return apiRequest<void>(`/api/users/${id}`, {
    method: 'DELETE',
  });
};
