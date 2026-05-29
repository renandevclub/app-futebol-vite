/**
 * @file src/stores/reactive-store.js
 * @description Base para stores reativos
 * Implementa padrão observable simples (sem Pinia/Zustand)
 */

/**
 * Cria um store reativo
 * @param {Object} initialState
 * @returns {Object}
 */
export function createStore(initialState = {}) {
  let state = { ...initialState };
  const subscribers = new Set();

  /**
   * Se inscreve para mudanças
   * @param {Function} callback
   * @returns {Function} unsubscribe
   */
  function subscribe(callback) {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  }

  /**
   * Notifica todos os subscribers
   */
  function notify() {
    subscribers.forEach(callback => callback(state));
  }

  /**
   * Obtém estado atual
   */
  function getState() {
    return { ...state };
  }

  /**
   * Obtém valor específico
   */
  function get(key) {
    return state[key];
  }

  /**
   * Atualiza estado
   */
  function setState(updates) {
    state = { ...state, ...updates };
    notify();
  }

  /**
   * Define valor específico
   */
  function set(key, value) {
    state[key] = value;
    notify();
  }

  /**
   * Reseta para estado inicial
   */
  function reset() {
    state = { ...initialState };
    notify();
  }

  /**
   * Limpa subscribers
   */
  function clear() {
    subscribers.clear();
  }

  return {
    subscribe,
    getState,
    get,
    setState,
    set,
    reset,
    clear,
  };
}

/**
 * Hook para observar mudanças de um store
 * @param {Object} store
 * @param {Function} onUpdate
 * @returns {Function} cleanup
 */
export function watchStore(store, onUpdate) {
  return store.subscribe(onUpdate);
}

/**
 * Hook para obter valor reativo de um store
 * @param {Object} store
 * @param {string} key
 * @param {any} [defaultValue]
 * @returns {Proxy}
 */
export function useStoreValue(store, key, defaultValue = null) {
  return new Proxy({}, {
    get() {
      return store.get(key) ?? defaultValue;
    },
  });
}
