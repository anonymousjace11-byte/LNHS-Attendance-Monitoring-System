import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, footer, maxWidth = '480px', className = '' }) {
  const dialogRef = useRef(null);

  // Trap focus and close on Escape
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const prev = document.activeElement;
    el.focus();

    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      prev?.focus();
    };
  }, [onClose]);

  return (
    <div
      className={`modal-overlay animate-fade-in ${className ? `${className}-overlay` : ''}`}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={dialogRef}
        className={`modal animate-fade-in ${className}`}
        style={{ maxWidth }}
        tabIndex={-1}
      >
        <div className="modal-header">
          <span className="modal-title" id="modal-title">{title}</span>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
