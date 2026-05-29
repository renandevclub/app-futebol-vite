/**
 * @file src/services/impl/auth.service.js
 * @description Gerenciamento de autenticação
 * Centraliza lógica de login, logout e verificação de acesso
 */

import { getSupabaseClient, initSupabaseClient, runSupabaseOperation } from './supabase-client.service.js';
import { getStoredUser, setStoredUser, clearStoredUser } from '../../stores/session-store.js';
import { userFromSupabase } from '../../core/dto/user.dto.js';
import { isAdminRole, isVisitorRole } from '../../shared/constants/roles.js';

/**
 * Faz login com email e password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<any>} - User session
 */
export async function loginWithPassword(email, password) {
  await initSupabaseClient();

  return runSupabaseOperation(async (client) => {
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      throw new Error(`Erro ao fazer login: ${error.message}`);
    }

    if (!data.session) {
      throw new Error('Sessão não retornada');
    }

    return {
      session: data.session,
      user: data.user,
    };
  }, null);
}

/**
 * Faz logout
 * @returns {Promise<boolean>}
 */
export async function logout() {
  const client = getSupabaseClient();

  if (!client) {
    // Limpa sessão local mesmo se Supabase indisponível
    clearCurrentUser();
    return true;
  }

  try {
    const { error } = await client.auth.signOut();
    if (error) {
      console.error('Erro ao fazer logout:', error);
    }
    clearCurrentUser();
    return true;
  } catch (error) {
    console.error('Erro crítico no logout:', error);
    clearCurrentUser();
    return false;
  }
}

/**
 * Obtém usuário atual (session storage)
 * @returns {any|null}
 */
export function getCurrentUser() {
  return getStoredUser();
}

/**
 * Verifica se usuário atual é admin
 * @returns {boolean}
 */
export function isCurrentUserAdmin() {
  const user = getCurrentUser();
  return isAdminRole(user?.role);
}

/**
 * Verifica se usuário atual é visitante
 * @returns {boolean}
 */
export function isCurrentUserVisitor() {
  const user = getCurrentUser();
  return isVisitorRole(user?.role);
}

/**
 * Define usuário atual
 * @param {any} user
 */
export function setCurrentUser(user) {
  setStoredUser(user);
}

/**
 * Limpa usuário atual
 */
export function clearCurrentUser() {
  clearStoredUser();
}

/**
 * Verifica acesso com role requerida
 * @param {string} [requiredRole] - Role requerida
 * @returns {Promise<any|null>}
 */
export async function checkAccess(requiredRole = null) {
  await initSupabaseClient();
  const client = getSupabaseClient();

  if (!client) {
    console.warn('[AuthService] Supabase indisponível para checkAccess');
    return null;
  }

  try {
    const { data: { user }, error } = await client.auth.getUser();

    if (error || !user) {
      return null;
    }

    // Fetch profile
    const { data: profile, error: profileError } = await client
      .from('fm_perfis')
      .select('*')
      .eq('auth_id', user.id)
      .single();

    if (profileError) {
      console.error('Erro ao buscar perfil:', profileError);
      return null;
    }

    // Se role requerida, verifica
    if (requiredRole && profile.role !== requiredRole) {
      return null;
    }

    // Enriquece profile com dados de auth
    const enrichedProfile = userFromSupabase(profile, user);
    
    // Armazena no session storage
    setCurrentUser(enrichedProfile);

    return enrichedProfile;
  } catch (error) {
    console.error('[AuthService] Erro ao verificar acesso:', error);
    return null;
  }
}

/**
 * Verifica se deve redirecionar para login
 * @returns {boolean}
 */
export function shouldRedirectToLogin() {
  return !getCurrentUser();
}

/**
 * Obtém sessão atual do Supabase Auth
 * @returns {Promise<any|null>}
 */
export async function getCurrentSession() {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    return session;
  } catch (error) {
    console.error('[AuthService] Erro ao obter sessão:', error);
    return null;
  }
}
