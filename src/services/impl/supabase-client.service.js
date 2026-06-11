/**
 * @file src/services/impl/supabase-client.service.js
 * @description Gerenciamento do cliente Supabase
 * Centraliza a inicialização e singleton do cliente
 */

import { FM_CONFIG } from '../../core/config.js';

let client = null;
let isUnavailable = false;
let initPromise = null;

/**
 * Inicializa o cliente Supabase (singleton)
 * @returns {Promise<any>}
 */
export async function initSupabaseClient() {
  if (initPromise) return initPromise;
  
  initPromise = _doInit();
  return initPromise;
}

async function _doInit() {
  if (client) return client;
  if (typeof window !== 'undefined' && window.supabaseClient) {
    client = window.supabaseClient;
    return client;
  }
  if (isUnavailable) return null;

  try {
    if (typeof window === 'undefined' || !window.supabase?.createClient) {
      throw new Error('Supabase não disponível');
    }

    const { url, publishableKey } = FM_CONFIG.supabase;
    if (!url || !publishableKey) {
      throw new Error('Supabase config ausente');
    }

    client = window.supabase.createClient(url, publishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    });
    
    // Expõe globalmente para compatibilidade com código legado
    window.supabaseClient = client;

    // Listener global para capturar redirecionamento de recuperação de senha (PASSWORD_RECOVERY)
    if (typeof window !== 'undefined') {
      client.auth.onAuthStateChange((event, session) => {
        console.log('[Supabase Client] Evento Auth:', event);
        if (event === 'PASSWORD_RECOVERY') {
          const path = window.location.pathname;
          if (!path.endsWith('reset-password.html') && !path.endsWith('redefinir-senha')) {
            console.log('[Supabase Client] PASSWORD_RECOVERY fora da página de reset. Redirecionando...');
            const targetUrl = new URL('/pages/reset-password.html', window.location.origin);
            targetUrl.search = window.location.search;
            targetUrl.hash = window.location.hash;
            window.location.replace(targetUrl.toString());
          }
        }
      });
    }

    return client;
  } catch (error) {
    console.error('[SupabaseClient] Erro ao inicializar:', error);
    isUnavailable = true;
    return null;
  }
}

/**
 * Obtém o cliente Supabase (já inicializado)
 * @returns {any|null}
 */
export function getSupabaseClient() {
  if (isUnavailable) return null;
  if (!client && typeof window !== 'undefined' && window.supabaseClient) {
    client = window.supabaseClient;
  }
  return client || null;
}

/**
 * Executa operação com o cliente Supabase
 * @param {Function} operation - async (client) => result
 * @param {any} fallbackValue - Valor padrão se falhar
 * @returns {Promise<any>}
 */
export async function runSupabaseOperation(operation, fallbackValue = null) {
  const supabaseClient = getSupabaseClient();
  
  if (!supabaseClient) {
    return fallbackValue;
  }

  try {
    return await operation(supabaseClient);
  } catch (error) {
    console.warn('[SupabaseClient] Operação falhou, usando fallback:', error);
    return fallbackValue;
  }
}

/**
 * Verifica se Supabase está disponível
 * @returns {boolean}
 */
export function isSupabaseAvailable() {
  return !isUnavailable && client !== null;
}

/**
 * Redefine o cliente (para testes)
 */
export function resetSupabaseClient() {
  client = null;
  isUnavailable = false;
  initPromise = null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[SupabaseClientService] Rede restabelecida. Resetando flag de indisponibilidade.');
    isUnavailable = false;
    initPromise = null;
    initSupabaseClient().catch(err => {
      console.warn('[SupabaseClientService] Erro ao re-inicializar cliente no online:', err);
    });
  });
}
