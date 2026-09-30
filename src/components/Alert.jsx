import { useEffect } from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle, X } from 'lucide-react';

const ICONS = { error: AlertCircle, warn: AlertTriangle, info: Info, success: CheckCircle };

export default function Alert({ type = 'info', children, onClose, dismissAfter = 0, className = '' }) {
  const Icon = ICONS[type];

  useEffect(() => {
    if (!onClose || !dismissAfter) return undefined;
    const timer = window.setTimeout(onClose, dismissAfter);
    return () => window.clearTimeout(timer);
  }, [dismissAfter, onClose]);

  return (
    <div className={`alert alert-${type} ${className}`} role="alert">
      <Icon size={15} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 ml-1 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
