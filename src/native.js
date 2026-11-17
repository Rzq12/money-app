// Glue for the Android and iOS builds (Capacitor). On the web every export here is a no-op
// or falls back to the browser behaviour, so the same bundle runs in both places.
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'web' | 'android' | 'ios'

// Open dialogs register their close function here so the Android back button closes the top one.
const dialogs = [];
export function pushDialog(close) {
  dialogs.push(close);
  return () => { const i = dialogs.lastIndexOf(close); if (i >= 0) dialogs.splice(i, 1); };
}

const blobToBase64 = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1] || '');
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});

// WebViews ignore <a download>, so native builds write the file to the cache and open the share sheet.
export async function saveFile(blob, name) {
  if (!isNative) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return;
  }
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const { uri } = await Filesystem.writeFile({ path: name, data: await blobToBase64(blob), directory: Directory.Cache });
  try { await Share.share({ title: name, files: [uri] }); } catch { /* user dismissed the share sheet */ }
}

// Status bar colours follow the in-app light/dark setting.
export async function setStatusBar(dark) {
  if (!isNative) return;
  const { StatusBar, Style } = await import('@capacitor/status-bar');
  try {
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    if (platform === 'android') await StatusBar.setBackgroundColor({ color: dark ? '#000000' : '#fafafa' });
  } catch { /* not supported on this OS version */ }
}

export async function initNative() {
  if (!isNative) return;
  document.documentElement.classList.add('native', `native-${platform}`);
  const { App } = await import('@capacitor/app');
  App.addListener('backButton', () => {
    if (dialogs.length) { dialogs[dialogs.length - 1](); return; }
    const path = location.hash.replace(/^#\/?/, '');
    if (path && window.history.length > 1) window.history.back();
    else if (path) location.hash = '#/';
    else App.minimizeApp();
  });
}
