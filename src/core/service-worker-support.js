export const SERVICE_WORKER_PATH = '/sw.js';

const SCRIPT_CONTENT_TYPE_PATTERN = /\b(?:java|ecma)script\b/i;

export async function checkServiceWorkerScript(path = SERVICE_WORKER_PATH) {
  if (!('serviceWorker' in navigator)) {
    return {
      ok: false,
      reason: 'unsupported',
      status: 0,
      contentType: '',
      isHtml: false,
    };
  }

  try {
    const checkUrl = new URL(path, window.location.origin);
    checkUrl.searchParams.set('fm-sw-check', String(Date.now()));

    const response = await fetch(checkUrl.href, {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    const contentType = response.headers.get('content-type') || '';
    const isScript = SCRIPT_CONTENT_TYPE_PATTERN.test(contentType);
    const isHtml = /\bhtml\b/i.test(contentType);

    return {
      ok: response.ok && isScript,
      reason: response.ok && isScript ? 'ok' : 'invalid-response',
      status: response.status,
      contentType,
      isHtml,
    };
  } catch (error) {
    return {
      ok: false,
      reason: 'fetch-error',
      status: 0,
      contentType: '',
      isHtml: false,
      error,
    };
  }
}

export async function unregisterServiceWorkersForScript(path = SERVICE_WORKER_PATH) {
  if (!('serviceWorker' in navigator)) return;

  const scriptUrl = new URL(path, window.location.origin).href;
  const registrations = await navigator.serviceWorker.getRegistrations();

  await Promise.all(
    registrations
      .filter((registration) => {
        const workerUrls = [
          registration.active?.scriptURL,
          registration.waiting?.scriptURL,
          registration.installing?.scriptURL,
        ];
        return workerUrls.includes(scriptUrl);
      })
      .map((registration) => registration.unregister())
  );
}
