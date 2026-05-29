/**
 * @file src/core/dto/user.dto.js
 * @description DTO e transformação para User
 * Desacopla dados brutos do Supabase da lógica de negócio
 */

import { USER_ROLES } from '../../shared/constants/roles.js';

/**
 * Transforma dados brutos do Supabase para entidade interna
 * @param {any} rawData - Dados brutos da API
 * @param {any} [authUser] - Dados do Supabase Auth (opcional)
 * @returns {import('../types').FMUser|null}
 */
export function userFromSupabase(rawData, authUser = null) {
  if (!rawData) return null;

  return {
    id: rawData.id || rawData.auth_id || '',
    auth_id: rawData.auth_id || rawData.id || '',
    username: rawData.username || authUser?.user_metadata?.username || 'Jogador',
    full_name: rawData.full_name || authUser?.user_metadata?.name || 'Jogador',
    phone: rawData.phone || null,
    role: rawData.role || USER_ROLES.player,
    email: rawData.email || authUser?.email || null,
    created_at: rawData.created_at || authUser?.created_at || null,
  };
}

/**
 * Transforma entidade interna para formato Supabase
 * @param {import('../types').FMUser} user
 * @returns {Object}
 */
export function userToSupabase(user) {
  return {
    id: user.id,
    auth_id: user.auth_id,
    username: user.username,
    full_name: user.full_name,
    phone: user.phone,
    role: user.role,
    email: user.email,
  };
}

/**
 * Enriquece user com dados adicionais
 * @param {import('../types').FMUser} user
 * @param {any} stats - Stats do player
 * @param {any} paymentStatus - Status de pagamento
 * @returns {Object}
 */
export function enrichUserProfile(user, stats = null, paymentStatus = null) {
  return {
    ...user,
    stats: stats || {
      total_matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
    },
    paymentStatus: paymentStatus || null,
  };
}

/**
 * Validação básica de User
 * @param {any} data
 * @returns {{ valid: boolean; errors: string[] }}
 */
export function validateUser(data) {
  const errors = [];

  if (!data.username || String(data.username).trim().length < 3) {
    errors.push('Username deve ter pelo menos 3 caracteres');
  }

  if (!data.role || !Object.values(USER_ROLES).includes(data.role)) {
    errors.push('Role inválido');
  }

  // Valida email se fornecido
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Email inválido');
  }

  // Valida telefone se fornecido (simples)
  if (data.phone && !/^\d+$/.test(data.phone.replace(/[^\d]/g, ''))) {
    errors.push('Telefone inválido');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Obtém label de role em português
 * @param {string} role
 * @returns {string}
 */
export function getRoleLabel(role) {
  const labels = {
    [USER_ROLES.player]: 'Jogador',
    [USER_ROLES.admin]: 'Administrador',
    [USER_ROLES.visitor]: 'Visitante',
  };
  return labels[role] || role;
}
