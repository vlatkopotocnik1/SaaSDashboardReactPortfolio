import type { PropsWithChildren, ReactNode } from 'react';

type ModalProps = PropsWithChildren<{
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  actions?: ReactNode;
}>;

export function Modal({ isOpen, title, onClose, actions, children }: ModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="ui-modal-overlay" role="presentation" onClick={onClose}>
      <div className="ui-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="ui-modal-header">
          <span>{title}</span>
          <button className="ui-button ui-button--ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="ui-modal-body">{children}</div>
        {actions ? <div className="ui-modal-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
