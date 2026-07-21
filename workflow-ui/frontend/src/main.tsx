import React from 'react';
import ReactDOM from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './styles.css';
import { App } from './App';

const ignoredResizeObserverMessages = new Set([
  'ResizeObserver loop completed with undelivered notifications.',
  'ResizeObserver loop limit exceeded',
]);

window.addEventListener('error', (event) => {
  if (ignoredResizeObserverMessages.has(event.message)) {
    event.stopImmediatePropagation();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : '';
  if (ignoredResizeObserverMessages.has(message)) {
    event.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
