import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="ui-emptystate">
      <div className="ui-emptystate-title">{title}</div>
      {description ? <div className="ui-helper">{description}</div> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}
