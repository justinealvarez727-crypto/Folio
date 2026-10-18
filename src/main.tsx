import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { initPerformanceMonitoring, installGlobalErrorHandlers } from './lib/perf';
import { toast } from './stores/toastStore';
import './styles/index.css';

installGlobalErrorHandlers();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker: offline support + non-disruptive updates (never reload while someone is mid-chapter).
const updateSW = registerSW({
  onNeedRefresh() {
    toast.info('A new version of Folio is ready.', {
      duration: 0,
      action: { label: 'Update', onClick: () => void updateSW(true) },
    });
  },
  onOfflineReady() {
    toast.success('Folio is ready to use offline.');
  },
});

initPerformanceMonitoring();
