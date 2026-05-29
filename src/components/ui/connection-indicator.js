/**
 * @file src/components/ui/connection-indicator.js
 * @description Indicador visual de status da conexão Realtime
 * Integra com RealtimeManager para mostrar:
 *  - 🟢 Conectado
 *  - 🟡 Reconectando
 *  - 🔴 Desconectado
 *
 * Uso:
 *   import { initConnectionIndicator } from '@components/ui/connection-indicator.js';
 *   initConnectionIndicator(); // auto-connect ao RealtimeManager
 */

import { realtimeManager, ConnectionStatus } from '../../services/realtime/realtime-manager.js';

/** @type {HTMLElement|null} */
let indicatorEl = null;

const LABELS = {
  [ConnectionStatus.CONNECTED]: 'Conectado',
  [ConnectionStatus.CONNECTING]: 'Conectando...',
  [ConnectionStatus.RECONNECTING]: 'Reconectando...',
  [ConnectionStatus.DISCONNECTED]: 'Desconectado',
};

function createIndicator() {
  if (indicatorEl) return indicatorEl;

  indicatorEl = document.createElement('div');
  indicatorEl.className = 'fm-connection-dot disconnected';
  indicatorEl.setAttribute('aria-live', 'polite');
  indicatorEl.setAttribute('role', 'status');
  indicatorEl.innerHTML = `
    <span class="fm-connection-dot-indicator"></span>
    <span class="fm-connection-dot-label">Desconectado</span>
  `;

  document.body.appendChild(indicatorEl);
  return indicatorEl;
}

function updateIndicator(status) {
  const el = createIndicator();
  const labelEl = el.querySelector('.fm-connection-dot-label');

  // Remove all status classes
  el.classList.remove('connected', 'connecting', 'reconnecting', 'disconnected', 'visible');
  el.classList.add(status);

  if (labelEl) {
    labelEl.textContent = LABELS[status] || status;
  }

  // Show indicator when not connected
  if (status !== ConnectionStatus.CONNECTED) {
    el.classList.add('visible');
  } else {
    // Show briefly then hide
    el.classList.add('visible');
    setTimeout(() => {
      if (realtimeManager.getStatus() === ConnectionStatus.CONNECTED) {
        el.classList.remove('visible');
      }
    }, 3000);
  }
}

/**
 * Inicializa o indicador de conexão, vinculando ao RealtimeManager.
 * @returns {Function} cleanup — remove o indicador e listener
 */
export function initConnectionIndicator() {
  createIndicator();

  // Sincroniza estado inicial
  updateIndicator(realtimeManager.getStatus());

  // Escuta mudanças
  const unsubscribe = realtimeManager.onStatusChange((status) => {
    updateIndicator(status);
  });

  return () => {
    unsubscribe();
    if (indicatorEl) {
      indicatorEl.remove();
      indicatorEl = null;
    }
  };
}

export default initConnectionIndicator;
