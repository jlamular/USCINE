import { useContext } from 'react';
import { ToastContext } from '../contexts/ToastContext';

export function useToast() {
  const context = useContext(ToastContext);

  if (context === null) {
    throw new Error('useToast must be used inside a ToastProvider.');
  }

  return context;
}