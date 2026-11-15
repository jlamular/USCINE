import { Component } from 'react';

class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // In a bigger project this is where you would send the error to a monitoring service
    console.error('Unexpected error in the interface:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <h1 className="brand">Something went wrong</h1>
          <p className="muted">
            An unexpected error stopped this page. Your videos and messages are safe. Going back to the dashboard
            usually fixes it.
          </p>

          {/* A full page load, which also clears the error state */}
          <button className="button" type="button" onClick={() => window.location.assign('/dashboard')}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;