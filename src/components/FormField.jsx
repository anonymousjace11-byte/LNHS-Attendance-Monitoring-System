/**
 * Accessible, validated form field wrapper.
 * Renders label → input/select/textarea → hint/error.
 */
export default function FormField({
  label,
  required = false,
  error = '',
  hint = '',
  id,
  children,
  className = '',
}) {
  return (
    <div className={className}>
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      )}
      {children}
      {error && <p className="field-error" role="alert" id={id ? `${id}-error` : undefined}>{error}</p>}
      {!error && hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
