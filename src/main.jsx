import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { startAutoSync } from './sync.js';
import { store } from './store.js';
import { initNative, isNative } from './native.js';
import '@fontsource-variable/geist/wght.css';
import '@fontsource-variable/geist-mono/wght.css';
import './styles.css';

// Set the colour scheme before the first paint so dark mode never flashes light.
document.documentElement.dataset.theme = store.get().settings.dark ? 'dark' : 'light';
createRoot(document.getElementById('root')).render(<App />);
startAutoSync();
initNative();

// Development serves source files that change constantly; the offline cache is for built apps only.
// The Android/iOS apps already ship every file inside the app, so they skip it too.
if (import.meta.env.PROD && !isNative && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
