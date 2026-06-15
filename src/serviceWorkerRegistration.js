const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

export function register(config) {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);
    if (publicUrl.origin !== window.location.origin) return;

    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;
      if (isLocalhost) {
        checkValidServiceWorker(swUrl, config);
      } else {
        registerValidSW(swUrl, config);
      }
    });
  }
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker.register(swUrl).then(registration => {
    registration.onupdatefound = () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.onstatechange = () => {
        if (installing.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            if (config?.onUpdate) config.onUpdate(registration);
          } else {
            if (config?.onSuccess) config.onSuccess(registration);
          }
        }
      };
    };
  }).catch(err => console.error('Service worker registration failed:', err));
}

function checkValidServiceWorker(swUrl, config) {
  fetch(swUrl, { headers: { 'Service-Worker': 'script' } }).then(response => {
    const contentType = response.headers.get('content-type');
    if (response.status === 404 || (contentType && contentType.includes('text/html'))) {
      navigator.serviceWorker.ready.then(reg => reg.unregister()).then(() => window.location.reload());
    } else {
      registerValidSW(swUrl, config);
    }
  }).catch(() => console.log('No internet — app running offline.'));
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => reg.unregister()).catch(console.error);
  }
}
