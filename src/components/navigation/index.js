export function refreshNavigationState() {
  if (typeof window.updateNavigationState === 'function') {
    window.updateNavigationState();
  }
}

export const navigationComponent = Object.freeze({
  refreshState: refreshNavigationState,
});
