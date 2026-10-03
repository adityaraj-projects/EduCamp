import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import './styles/globals.css';
import { registerSW } from 'virtual:pwa-register';

// Auto-register service worker for PWA offline shell capability
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[EduCamp PWA] New version available.');
  },
  onOfflineReady() {
    console.log('[EduCamp PWA] App ready to work offline.');
  },
});

const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
