export type AuditLogItem = {
  id: string;
  time: string;
  user: string;
  action: string;
};

export type AuditLogPage = {
  items: AuditLogItem[];
  totalCount: number;
};
