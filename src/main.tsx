import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const SelfTest = lazy(() => import('./components/SelfTest'));

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {window.location.hash === '#test' ? (
      <Suspense fallback={null}>
        <SelfTest />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>
);

// PWA: في الإنتاج فقط وخارج الإطارات (معاينة AI Studio)
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.top === window.self) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
