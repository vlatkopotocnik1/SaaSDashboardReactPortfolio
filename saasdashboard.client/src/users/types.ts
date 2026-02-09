export type UserRole = string;

export type User = {
  id: string;
  username: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
  teamId: string;
  teamName: string;
};

export type PagedResponse<T> = {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
};
