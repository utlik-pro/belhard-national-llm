import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import 'highlight.js/styles/vs2015.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log errors to console (could be sent to monitoring service)
        console.error('App Error:', error);
        console.error('Component Stack:', errorInfo.componentStack);
      }}
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
