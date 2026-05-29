/**
 * @file src/stores/index.js
 * @description Agregador de stores reativos
 */

export * from './reactive-store.js';
export * from './session-store.js';
export * from './match.store.js';
export * from './draw.store.js';
export * from './notification.store.js';

/**
 * Namespace para acesso centralizado
 */
export const FM_STORES = {
  Reactive: require('./reactive-store.js'),
  Session: require('./session-store.js'),
  Match: require('./match.store.js'),
  Draw: require('./draw.store.js'),
  Notification: require('./notification.store.js'),
};
