import type { InputHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  helperText?: string;
  error?: string;
};

export function Input({ label, helperText, error, className, ...props }: InputProps) {
  return (
    <label className={['ui-field', className].filter(Boolean).join(' ')}>
      {label ? <span className="ui-label">{label}</span> : null}
      <input className="ui-input" {...props} />
      {error ? <span className="ui-error">{error}</span> : null}
      {!error && helperText ? <span className="ui-helper">{helperText}</span> : null}
    </label>
  );
}
