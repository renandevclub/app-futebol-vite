/**
 * @file src/hooks/use-realtime-channel.js
 * @description Facade compatível com a API antiga, agora usando o RealtimeManager
 * centralizado que provê heartbeat, reconexão e gestão de canais.
 *
 * Compatibilidade:
 *   Código que usava `createRealtimeSubscription({ channelName, postgresChanges, onStatus })`
 *   continua funcionando exatamente igual. A diferença é que agora os canais são
 *   gerenciados centralmente com reconexão automática.
 */

import { realtimeManager } from '../services/realtime/realtime-manager.js';

/**
 * Cria uma subscription Realtime gerenciada.
 *
 * @param {Object} opts
 * @param {string} opts.channelName - Nome único do canal
 * @param {Array<{table: string, event?: string, schema?: string, filter?: string, handler: Function}>} opts.postgresChanges
 * @param {Function} [opts.onStatus] - Callback (status) => void
 * @param {Object} [opts.client] - Ignorado (usa o client do RealtimeManager)
 * @returns {{ channel: Object|null, unsubscribe: Function }}
 */
export function createRealtimeSubscription(opts = {}) {
  const { channelName, postgresChanges = [], onStatus } = opts;

  if (!channelName) {
    return { channel: null, unsubscribe: async () => {} };
  }

  return realtimeManager.createChannel(channelName, postgresChanges, { onStatus });
}

// Re-exporta status para quem quiser observar
export { ConnectionStatus } from '../services/realtime/realtime-manager.js';
