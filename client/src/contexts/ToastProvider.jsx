import { useCallback, useMemo, useRef, useState } from 'react';
import { ToastContext } from './ToastContext';

const DISPLAY_MILLISECONDS = 4500;
const MAX_VISIBLE_TOASTS = 4;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextIdRef = useRef(1);

  const dismissToast = useCallback((toastId) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  // type is 'info', 'success' or 'error'
  const showToast = useCallback(
    (message, type = 'info') => {
      const toastId = nextIdRef.current;
      nextIdRef.current += 1;

      setToasts((current) => [...current, { id: toastId, message, type }].slice(-MAX_VISIBLE_TOASTS));
      setTimeout(() => dismissToast(toastId), DISPLAY_MILLISECONDS);
    },
    [dismissToast],
  );

  // One stable object, so components using useToast() do not re-render every time a toast appears
  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span>{toast.message}</span>
            <button type="button" aria-label="Dismiss" onClick={() => dismissToast(toast.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}