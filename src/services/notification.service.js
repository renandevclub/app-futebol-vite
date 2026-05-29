export function getNotificationService() {
  return window.FMNotifications || null;
}

export function notify(type, payload) {
  const service = getNotificationService();
  const handler = service?.[type];
  if (typeof handler !== 'function') return Promise.resolve(null);
  return handler(payload);
}

export const notificationService = Object.freeze({
  get: getNotificationService,
  notify,
});
