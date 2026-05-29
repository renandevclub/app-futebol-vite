/**
 * @file src/services/realtime/realtime-manager.js
 * @description Realtime Manager — gerencia conexões Supabase Realtime com
 * heartbeat, reconexão automática e gestão centralizada de canais.
 *
 * Problemas resolvidos:
 *  1. Múltiplos arquivos criando channels sem coordenação
 *  2. Sem heartbeat → conexões fantasmas
 *  3. Sem reconexão automática em caso de queda
 *  4. unsubscribe() não limpa referências → memory leak
 *  5. Sem indicador visual de status de conexão
 *
 * Uso:
 *   import { realtimeManager } from '@services/realtime/realtime-manager.js';
 *   const channel = realtimeManager.createChannel('matches', [
 *     { table: 'fm_partidas', handler: (payload) => { ... } }
 *   ]);
 *   channel.unsubscribe();
 */

import { getSupabaseClient } from '../../services/impl/supabase-client.service.js';

// --- Constantes ---
const HEARTBEAT_INTERVAL = 30_000; // 30 segundos
const RECONNECT_DELAY_MIN = 1_000; // 1 segundo inicial
const RECONNECT_DELAY_MAX = 30_000; // 30 segundos máximo
const RECONNECT_BACKOFF = 2; // exponencial
const CONNECTION_STATUS_EVENT = 'fm:connection-status';

/**
 * Estados de conexão possíveis
 * @enum {string}
 */
export const ConnectionStatus = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
};

/** @type {RealtimeManager|null} */
let instance = null;

/**
 * Gerenciador centralizado de conexões Realtime.
 *
 * Responsabilidades:
 *  - Criar e rastrear canais
 *  - Heartbeat para detectar desconexões
 *  - Reconexão automática com backoff exponencial
 *  - Emitir eventos de status de conexão
 *  - Limpeza de recursos (destroy)
 */
class RealtimeManager {
  constructor() {
    /**
     * Mapa de canais ativos: channelName → { channel, subscriptions[], cleanup }
     * @type {Map<string, Object>}
     */
    this._channels = new Map();

    /** @type {ConnectionStatus} */
    this._status = ConnectionStatus.DISCONNECTED;

    /** @type {number|null} */
    this._heartbeatTimer = null;

    /** @type {number} */
    this._reconnectAttempts = 0;

    /** @type {number|null} */
    this._reconnectTimer = null;

    /** @type {boolean} */
    this._destroyed = false;

    /** @type {Function|null} */
    this._statusListener = null;

    // Bind interno
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
  }

  // ==========================================================================
  // API PÚBLICA
  // ==========================================================================

  /**
   * Cria um novo canal Realtime gerenciado.
   *
   * @param {string} channelName - Nome único do canal
   * @param {Array<{table: string, event?: string, schema?: string, filter?: string, handler: Function}>} subscriptions
   * @param {Object} [opts={}]
   * @param {Function} [opts.onStatus] - Callback para mudanças de status do canal
   * @returns {{ channel: Object|null, unsubscribe: Function }}
   */
  createChannel(channelName, subscriptions = [], opts = {}) {
    if (this._destroyed) {
      console.warn('[RealtimeManager] Manager destroyed, cannot create channel.');
      return { channel: null, unsubscribe: () => {} };
    }

    // Se já existe, limpa antes
    if (this._channels.has(channelName)) {
      this._cleanupChannel(channelName);
    }

    const client = getSupabaseClient();
    if (!client) {
      console.warn(`[RealtimeManager] No Supabase client, deferring channel "${channelName}".`);
      return { channel: null, unsubscribe: () => this._cleanupChannel(channelName) };
    }

    const channel = client.channel(channelName);

    // Registrar subscriptions
    const cleanupFns = [];
    for (const sub of subscriptions) {
      if (!sub.table || typeof sub.handler !== 'function') continue;

      const filter = sub.filter ? { filter: sub.filter } : {};
      channel.on(
        'postgres_changes',
        {
          event: sub.event || '*',
          schema: sub.schema || 'public',
          table: sub.table,
          ...filter,
        },
        sub.handler
      );

      cleanupFns.push(() => {
        // Supabase remove listeners internamente ao remover o canal
      });
    }

    // Status listener interno
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this._status = ConnectionStatus.CONNECTED;
        this._reconnectAttempts = 0;
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        this._scheduleReconnect(channelName);
      } else if (status === 'TIMED_OUT') {
        this._status = ConnectionStatus.DISCONNECTED;
      }

      this._emitConnectionStatus();

      if (typeof opts.onStatus === 'function') {
        opts.onStatus(status);
      }
    });

    // Armazenar metadados
    this._channels.set(channelName, {
      channel,
      subscriptions,
      cleanupFns,
      onStatus: opts.onStatus || null,
    });

    // Iniciar heartbeat se for o primeiro canal
    if (this._channels.size === 1) {
      this._startHeartbeat();
    }

    return {
      channel,
      unsubscribe: () => this._cleanupChannel(channelName),
    };
  }

  /**
   * Remove um canal específico.
   * @param {string} channelName
   */
  removeChannel(channelName) {
    this._cleanupChannel(channelName);

    // Se não há mais canais, para o heartbeat
    if (this._channels.size === 0) {
      this._stopHeartbeat();
    }
  }

  /**
   * Remove todos os canais e para o gerenciador.
   */
  destroy() {
    this._destroyed = true;
    this._stopHeartbeat();
    this._clearReconnectTimer();

    for (const name of this._channels.keys()) {
      this._cleanupChannel(name);
    }

    this._channels.clear();
    this._status = ConnectionStatus.DISCONNECTED;
    this._emitConnectionStatus();

    document.removeEventListener('visibilitychange', this._onVisibilityChange);

    console.log('[RealtimeManager] Destroyed.');
  }

  /**
   * Reconecta todos os canais ativos.
   */
  reconnectAll() {
    if (this._destroyed) return;

    this._status = ConnectionStatus.RECONNECTING;
    this._emitConnectionStatus();

    const channelDefs = [];
    for (const [name, meta] of this._channels) {
      channelDefs.push({
        name,
        subscriptions: meta.subscriptions,
        onStatus: meta.onStatus,
      });
    }

    // Limpa todos os canais antigos
    this._channels.clear();

    // Recria todos
    for (const def of channelDefs) {
      this.createChannel(def.name, def.subscriptions, { onStatus: def.onStatus });
    }

    console.log(`[RealtimeManager] Reconnected ${channelDefs.length} channel(s).`);
  }

  /**
   * Retorna o status atual da conexão.
   * @returns {ConnectionStatus}
   */
  getStatus() {
    return this._status;
  }

  /**
   * Registra um listener global para mudanças de status de conexão.
   * O evento 'fm:connection-status' é disparado no window.
   * @param {Function} callback - (status: ConnectionStatus) => void
   * @returns {Function} unsubscribe
   */
  onStatusChange(callback) {
    const handler = (event) => {
      if (event.detail?.status) {
        callback(event.detail.status);
      }
    };
    window.addEventListener(CONNECTION_STATUS_EVENT, handler);
    return () => window.removeEventListener(CONNECTION_STATUS_EVENT, handler);
  }

  // ==========================================================================
  // INTERNAL
  // ==========================================================================

  /**
   * Limpa um canal específico: unsubscribe + remove listeners.
   * @param {string} channelName
   */
  _cleanupChannel(channelName) {
    const meta = this._channels.get(channelName);
    if (!meta) return;

    try {
      if (meta.channel) {
        const client = getSupabaseClient();
        if (client) {
          client.removeChannel(meta.channel).catch((err) => {
            console.warn(`[RealtimeManager] Error removing channel "${channelName}":`, err.message);
          });
        }
      }
    } catch (err) {
      console.warn(`[RealtimeManager] Cleanup error for "${channelName}":`, err);
    }

    // Executa cleanup functions
    for (const fn of meta.cleanupFns || []) {
      try { fn(); } catch (_) { /* silent */ }
    }

    this._channels.delete(channelName);
  }

  /**
   * Agenda reconexão de um canal com backoff exponencial.
   * @param {string} channelName
   */
  _scheduleReconnect(channelName) {
    if (this._destroyed) return;

    const meta = this._channels.get(channelName);
    if (!meta) return;

    this._reconnectAttempts++;

    const delay = Math.min(
      RECONNECT_DELAY_MIN * Math.pow(RECONNECT_BACKOFF, this._reconnectAttempts - 1),
      RECONNECT_DELAY_MAX
    );

    this._status = ConnectionStatus.RECONNECTING;
    this._emitConnectionStatus();

    console.log(`[RealtimeManager] Reconnecting channel "${channelName}" in ${delay}ms (attempt #${this._reconnectAttempts})...`);

    this._clearReconnectTimer();
    this._reconnectTimer = setTimeout(() => {
      if (this._destroyed) return;
      this.reconnectAll();
    }, delay);
  }

  /**
   * Inicia o heartbeat periódico.
   */
  _startHeartbeat() {
    if (this._heartbeatTimer) return;

    this._heartbeatTimer = setInterval(() => {
      const client = getSupabaseClient();
      if (!client) {
        this._status = ConnectionStatus.DISCONNECTED;
        this._emitConnectionStatus();
        return;
      }

      // Verifica se há canais ativos
      let allOk = true;
      for (const [, meta] of this._channels) {
        if (!meta.channel || meta.channel.state !== 'joined') {
          allOk = false;
          break;
        }
      }

      if (!allOk && this._channels.size > 0) {
        this._status = ConnectionStatus.DISCONNECTED;
        this._emitConnectionStatus();
      }
    }, HEARTBEAT_INTERVAL);

    // Listener visibility change para reconectar ao voltar
    document.addEventListener('visibilitychange', this._onVisibilityChange);

    console.log('[RealtimeManager] Heartbeat started.');
  }

  /**
   * Para o heartbeat.
   */
  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
      console.log('[RealtimeManager] Heartbeat stopped.');
    }
  }

  _clearReconnectTimer() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  /**
   * Emite evento de status de conexão no window.
   */
  _emitConnectionStatus() {
    window.dispatchEvent(
      new CustomEvent(CONNECTION_STATUS_EVENT, {
        detail: { status: this._status, timestamp: Date.now() },
      })
    );
  }

  /**
   * Reconecta ao voltar para a aba (se estava desconectado).
   */
  _onVisibilityChange() {
    if (document.visibilityState === 'visible' && this._status === ConnectionStatus.DISCONNECTED) {
      console.log('[RealtimeManager] Tab visible, reconnecting...');
      this.reconnectAll();
    }
  }
}

/**
 * Obtém a instância singleton do RealtimeManager.
 * @returns {RealtimeManager}
 */
export function getRealtimeManager() {
  if (!instance) {
    instance = new RealtimeManager();
  }
  return instance;
}

/**
 * Alias curto para uso em módulos.
 */
export const realtimeManager = getRealtimeManager();

export default realtimeManager;
