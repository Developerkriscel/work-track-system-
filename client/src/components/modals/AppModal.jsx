import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export function AppModal({ children, onClose, title, width = '720px' }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return createPortal(
    <div className="app-modal-layer" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="app-modal-layer__backdrop" aria-label="Close dialog" onClick={onClose} />
      <div className="app-modal" style={{ maxWidth: width }}>
        <div className="app-modal__header">
          <div>
            <h2 className="app-modal__title">{title}</h2>
          </div>
          <button type="button" className="app-modal__close" onClick={onClose} aria-label="Close dialog">
            x
          </button>
        </div>
        <div className="app-modal__body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
