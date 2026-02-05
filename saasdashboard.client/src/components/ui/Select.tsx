import type { SelectHTMLAttributes } from 'react';

type SelectOption = {
  label: string;
  value: string;
};

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  helperText?: string;
  options: SelectOption[];
};

export function Select({ label, helperText, options, className, ...props }: SelectProps) {
  return (
    <label className={['ui-field', className].filter(Boolean).join(' ')}>
      {label ? <span className="ui-label">{label}</span> : null}
      <select className="ui-select" {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helperText ? <span className="ui-helper">{helperText}</span> : null}
    </label>
  );
}
