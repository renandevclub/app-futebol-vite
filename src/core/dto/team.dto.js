/**
 * @file src/core/dto/team.dto.js
 * @description DTO e transformação para Team
 */

/**
 * Transforma dados brutos do Supabase para entidade interna
 * @param {any} rawData
 * @returns {import('../types').FMTeam|null}
 */
export function teamFromSupabase(rawData) {
  if (!rawData) return null;

  return {
    id: rawData.id || '',
    name: rawData.name || rawData.nome || '',
    position: Number(rawData.position || 0),
    color: rawData.color || '#000000',
    icon: rawData.icon || '⚽',
  };
}

/**
 * Transforma entidade interna para formato Supabase
 * @param {import('../types').FMTeam} team
 * @returns {Object}
 */
export function teamToSupabase(team) {
  return {
    id: team.id,
    name: team.name,
    position: team.position,
    color: team.color,
    icon: team.icon,
  };
}

/**
 * Cores padrão para times
 */
export const DEFAULT_TEAM_COLORS = [
  { color: '#ef4444', icon: '⚽' },  // Vermelho
  { color: '#3b82f6', icon: '🔵' },  // Azul
  { color: '#1c1c2e', icon: '⚫' },  // Preto
  { color: '#10b981', icon: '🟢' },  // Verde
  { color: '#f59e0b', icon: '⭐' },  // Amarelo
  { color: '#8b5cf6', icon: '🟣' },  // Roxo
  { color: '#f97316', icon: '🟠' },  // Laranja
  { color: '#06b6d4', icon: '🔷' },  // Ciano
  { color: '#ec4899', icon: '💗' },  // Rosa
  { color: '#84cc16', icon: '✨' },  // Lima
];

/**
 * Obtém cor padrão para posição
 * @param {number} position (1-indexed)
 * @returns {Object}
 */
export function getDefaultTeamStyle(position) {
  const index = (position - 1) % DEFAULT_TEAM_COLORS.length;
  return DEFAULT_TEAM_COLORS[index];
}

/**
 * Validação básica de Team
 * @param {any} data
 * @returns {{ valid: boolean; errors: string[] }}
 */
export function validateTeam(data) {
  const errors = [];

  if (!data.name || String(data.name).trim().length === 0) {
    errors.push('Nome do time é obrigatório');
  }

  if (!data.id) {
    errors.push('ID do time é obrigatório');
  }

  if (data.position && (data.position < 1 || data.position > 10)) {
    errors.push('Posição do time deve estar entre 1 e 10');
  }

  if (data.color && !/^#[0-9A-F]{6}$/i.test(data.color)) {
    errors.push('Cor deve ser um hex válido (#RRGGBB)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Cria team ID a partir do nome
 * @param {string} name
 * @param {number} [index]
 * @returns {string}
 */
export function createTeamId(name, index = 0) {
  const slug = String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug ? `team_${slug}` : `team_${index + 1}`;
}
