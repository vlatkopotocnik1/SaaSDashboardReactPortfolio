import type { PropsWithChildren } from 'react';

type ToastVariant = 'info' | 'success' | 'warning' | 'error';

type ToastProps = PropsWithChildren<{
  title: string;
  variant?: ToastVariant;
  onClose?: () => void;
}>;

const variantIcon: Record<ToastVariant, string> = {
  info: 'i',
  success: 'ok',
  warning: '!',
  error: 'x',
};

export function Toast({ title, variant = 'info', onClose, children }: ToastProps) {
  return (
    <div className="ui-toast" role="status">
      <span aria-hidden="true">{variantIcon[variant]}</span>
      <div>
        <div className="ui-toast-title">{title}</div>
        {children ? <div>{children}</div> : null}
      </div>
      {onClose ? (
        <button className="ui-button ui-button--ghost" type="button" onClick={onClose}>
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
