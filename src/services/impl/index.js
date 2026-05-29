/**
 * @file src/services/impl/index.js
 * @description Agregador de implementações de serviços profissionais
 */

export * from './supabase-client.service.js';
export * from './auth.service.js';
export * from './match.service.js';
export * from './draw.service.js';
export * from './payment.service.js';
export * from './notification.service.js';

// Namespace para fácil acesso
export const FM_SERVICES = {
  SupabaseClient: require('./supabase-client.service.js'),
  Auth: require('./auth.service.js'),
  Match: require('./match.service.js'),
  Draw: require('./draw.service.js'),
  Payment: require('./payment.service.js'),
  Notification: require('./notification.service.js'),
};
