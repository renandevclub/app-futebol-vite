/**
 * @file src/components/ui/toast.js
 * @description Sistema de Toast Notification — estilo premium FIFA/Sofascore
 * Suporta: success, error, warning, info, loading
 * 
 * Uso:
 *   import { toast } from '@components/ui/toast.js';
 *   toast.success("Pagamento confirmado!");
 *   toast.error("Erro ao salvar");
 *   toast.loading("Carregando partidas...");
 *
 * Também expõe ao window.FMToast para compatibilidade com código legado.
 */

import { createElement } from './component.js';

/** @type {HTMLElement|null} */
let container = null;

const TOAST_DURATION = 4000;
const TOAST_MAX = 5;

/** @type {HTMLElement[]} */
let activeToasts = [];

const ICONS = {
  success: '<span style="color:#34d399">&#10003;</span>',
  error: '<span style="color:#f87171">&#10007;</span>',
  warning: '<span style="color:#fbbf24">&#9888;</span>',
  info: '<span style="color:#60a5fa">&#9432;</span>',
  loading: '<span class="fm-spinner" style="width:16px;height:16px;border-width:2px"></span>',
};

function ensureContainer() {
  if (container) return container;
  container = createElement('div', {
    id: 'fm-toast-container',
    attrs: {
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'false',
    },
  });
  document.body.appendChild(container);
  return container;
}

function removeToast(el) {
  el.classList.add('fm-toast-exit');
  el.addEventListener('animationend', () => {
    el.remove();
    activeToasts = activeToasts.filter(t => t !== el);
  }, { once: true });
}

/**
 * Exibe um toast.
 * @param {string} message
 * @param {Object} [opts={}]
 * @param {'success'|'error'|'warning'|'info'|'loading'} [opts.type='info']
 * @param {number} [opts.duration=4000] - ms, 0 = permanente
 * @returns {HTMLElement} O elemento do toast (para dismiss manual)
 */
export function showToast(message, opts = {}) {
  const type = opts.type || 'info';
  const duration = opts.duration ?? TOAST_DURATION;

  ensureContainer();

  // Limite de toasts
  while (activeToasts.length >= TOAST_MAX) {
    removeToast(activeToasts[0]);
  }

  const el = createElement('div', {
    classes: ['fm-toast', `fm-toast-${type}`],
    attrs: { role: 'alert' },
    html: `
      <span class="fm-toast-icon">${ICONS[type] || ICONS.info}</span>
      <span class="fm-toast-message">${escapeHtml(message)}</span>
      <button class="fm-toast-close" aria-label="Fechar">&times;</button>
    `,
  });

  const closeBtn = el.querySelector('.fm-toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => removeToast(el));
  }

  container.appendChild(el);
  activeToasts.push(el);

  // Auto-remove
  if (duration > 0 && type !== 'loading') {
    setTimeout(() => {
      if (el.isConnected) removeToast(el);
    }, duration);
  }

  // Trigger animation
  requestAnimationFrame(() => el.classList.add('fm-toast-visible'));

  return el;
}

/** Dismiss a specific toast */
export function dismissToast(el) {
  if (el && el.isConnected) removeToast(el);
}

/** Dismiss all toasts */
export function dismissAll() {
  for (const el of [...activeToasts]) {
    removeToast(el);
  }
}

/** Shorthand helpers */
export const toast = {
  success: (msg, opts) => showToast(msg, { ...opts, type: 'success' }),
  error: (msg, opts) => showToast(msg, { ...opts, type: 'error' }),
  warning: (msg, opts) => showToast(msg, { ...opts, type: 'warning' }),
  info: (msg, opts) => showToast(msg, { ...opts, type: 'info' }),
  loading: (msg, opts) => showToast(msg, { ...opts, type: 'loading', duration: 0 }),
  dismiss: dismissToast,
  dismissAll,
};

/** Expose global for legacy compatibility */
if (typeof window !== 'undefined') {
  window.FMToast = toast;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export default toast;
