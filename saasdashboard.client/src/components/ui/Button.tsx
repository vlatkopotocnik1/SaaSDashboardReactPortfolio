import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClassMap: Record<ButtonVariant, string> = {
  primary: 'ui-button--primary',
  secondary: 'ui-button--secondary',
  ghost: 'ui-button--ghost',
};

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  const classes = ['ui-button', variantClassMap[variant], className].filter(Boolean).join(' ');
  return <button className={classes} {...props} />;
}
