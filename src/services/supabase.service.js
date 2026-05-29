/**
 * @file src/services/supabase.service.js
 * @description Serviço Supabase refatorado
 * Re-exporta implementações profissionais mantendo compatibilidade com código legado
 */

import {
  initSupabaseClient,
  getSupabaseClient as _getSupabaseClientImpl,
  runSupabaseOperation,
} from './impl/supabase-client.service.js';

/**
 * Inicializa Supabase (nova API)
 */
export async function ensureSupabaseReady() {
  return initSupabaseClient();
}

/**
 * Obtém cliente Supabase
 */
export function getClient() {
  return _getSupabaseClientImpl();
}

/**
 * Executa operação Supabase
 */
export async function runQuery(operation, fallbackValue) {
  return runSupabaseOperation(operation, fallbackValue);
}

/**
 * Compatibilidade: Re-exporta como antes
 * Mantém código antigo funcionando
 */
export async function initDB() {
  return ensureSupabaseReady();
}

export async function runSupabaseQuery(operation, fallbackValue) {
  return runQuery(operation, fallbackValue);
}

export function getSupabaseClient() {
  return getClient();
}

/**
 * Serviço congelado (imutável)
 */
export const supabaseService = Object.freeze({
  ensureReady: ensureSupabaseReady,
  getClient,
  runQuery,
  initDB,
  runSupabaseQuery,
  getSupabaseClient,
});
