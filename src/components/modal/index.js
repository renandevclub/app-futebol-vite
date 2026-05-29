function getModal() {
  return window.FMModal || null;
}

export function showModal(options) {
  return getModal()?.show(options);
}

export function confirmModal(options) {
  return getModal()?.confirm(options);
}

export function notifyModal(message, options) {
  return getModal()?.notify(message, options);
}

export const modalComponent = Object.freeze({
  get: getModal,
  show: showModal,
  confirm: confirmModal,
  notify: notifyModal,
});
