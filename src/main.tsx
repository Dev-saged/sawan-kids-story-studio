import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { hydrateApiKey } from './services/apiKey';
import ErrorBoundary from './components/common/ErrorBoundary';
import { initMobileAudioUnlock } from './services/mobileAudio';

// تهيئة فك قفل الصوت التلقائي للهواتف الذكية
initMobileAudioUnlock();

const SelfTest = lazy(() => import('./components/SelfTest'));

// نسترجع المفتاح المحفوظ (إن وُجد) قبل أول عرض كي لا تبدأ الطلبات بلا مفتاح
hydrateApiKey().finally(() => {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        {window.location.hash === '#test' ? (
          <Suspense fallback={null}>
            <SelfTest />
          </Suspense>
        ) : (
          <App />
        )}
      </ErrorBoundary>
    </React.StrictMode>
  );
});

// PWA: في الإنتاج فقط وخارج الإطارات (معاينة AI Studio)
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.top === window.self) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => {
      for (const reg of regs) {
        reg.unregister().catch(() => undefined);
      }
    })
    .catch(() => undefined);
}

