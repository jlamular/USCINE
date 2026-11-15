import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { AuthProvider } from './contexts/AuthProvider.jsx';
import { ToastProvider } from './contexts/ToastProvider.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </ToastProvider>
  </StrictMode>,
);