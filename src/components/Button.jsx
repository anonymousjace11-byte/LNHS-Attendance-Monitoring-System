import { forwardRef } from 'react';
import walkingStudentAnimation from '../imports/walking-student.gif';

/**
 * Unified Button with skew-fill hover animation.
 * variant: 'primary' | 'secondary' | 'outline' | 'destructive'
 * size:    'sm' | 'md' | 'lg'
 * solid:   boolean – use solid filled style (no animation, for critical actions)
 */
const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    solid = false,
    className = '',
    disabled = false,
    loading = false,
    type = 'button',
    onClick,
    ...rest
  },
  ref
) {
  const base = solid ? 'btn-solid' : 'btn';
  const variantAliases = {
    primary: 'primary',
    secondary: 'secondary',
    outline: 'outline',
    destructive: 'destructive',
    success: 'secondary',
    ghost: 'secondary',
    gold: 'outline',
    danger: 'destructive',
    dark: 'primary',
  };
  const variantClass = `btn-${variantAliases[variant] || 'primary'}`;
  const sizeClass = size !== 'md' ? `btn-${size}` : '';

  return (
    <button
      ref={ref}
      type={type}
      className={[base, variantClass, sizeClass, loading && 'btn-loading', className].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      onClick={onClick}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span className="btn-loading-indicator" role="status" aria-label="In progress">
          <img src={walkingStudentAnimation} alt="" aria-hidden="true" />
        </span>
      )}
      {children}
    </button>
  );
});

export default Button;
