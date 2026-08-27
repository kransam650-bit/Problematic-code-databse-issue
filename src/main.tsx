/**
 * CathData 2026
 * Copyright (c) 2026 Dr Bharat S Sambyal. All rights reserved.
 * Developed for clinical records management and cardiology analytics.
 */

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA Service Worker for zero-latency offline loading
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegistered(r) {
      console.log('PWA Service Worker registered successfully:', r);
    },
    onRegisterError(error) {
      console.error('PWA Service Worker registration failed:', error);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
