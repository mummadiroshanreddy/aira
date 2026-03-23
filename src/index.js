// ════════════════════════════════
// FILE: src/index.js
// ════════════════════════════════

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './styles/animations.css';
import { ProviderProvider } from './context/ProviderContext';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ARIA CRITICAL FAILURE:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ backgroundColor: '#05050c', color: '#ff2a2a', padding: '40px', fontFamily: 'JetBrains Mono', height: '100vh' }}>
          <h1>SYSTEM FAILURE</h1>
          <p>The Copilot has crashed.</p>
          <pre>{this.state.error?.toString()}</pre>
          <button style={{ padding: '10px 20px', backgroundColor: '#00f0ff', color: '#000', border: 'none', cursor: 'pointer', marginTop: '20px' }} onClick={() => window.location.reload()}>
            REBOOT SYSTEM
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ProviderProvider>
        <App />
      </ProviderProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  });
}
