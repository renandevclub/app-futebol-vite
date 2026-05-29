/**
 * @file src/core/dto/match.dto.js
 * @description DTO e transformação para Match
 * Desacopla dados brutos do Supabase da lógica de negócio
 * Schema real: fm_matches — inclui teams, team_draws, votes, financial_summary, etc.
 */

/**
 * Transforma dados brutos do Supabase para entidade interna
 * @param {any} rawData - Dados brutos da API
 * @returns {import('../types').FMMatch|null}
 */
export function matchFromSupabase(rawData) {
  if (!rawData) return null;

  return {
    id: rawData.id || '',
    name: rawData.name || '',
    title: rawData.title || 'Sem título',
    date: rawData.date || '',
    time: rawData.time || '',
    location: rawData.location || 'Local indefinido',
    player_fee: Number(rawData.player_fee || 0),
    notes: rawData.notes || '',
    status: rawData.status || 'AGENDADA',
    players: rawData.players || [],
    teams: rawData.teams || [],
    team_draws: rawData.team_draws || {},
    votes: rawData.votes || { best_player: [], worst_player: [] },
    financial_summary: rawData.financial_summary || { expenses: [] },
    voting_deadline: rawData.voting_deadline || null,
    results_processed: Boolean(rawData.results_processed),
    created_at: rawData.created_at || null,
    updated_at: rawData.updated_at || null,
  };
}

/**
 * Transforma entidade interna para formato Supabase
 * @param {import('../types').FMMatch} match
 * @returns {Object}
 */
export function matchToSupabase(match) {
  return {
    id: match.id,
    name: match.name,
    title: match.title,
    date: match.date,
    time: match.time,
    location: match.location,
    player_fee: Number(match.player_fee || 0),
    notes: match.notes,
    status: match.status,
    players: match.players,
    teams: match.teams,
    team_draws: match.team_draws,
    votes: match.votes,
    financial_summary: match.financial_summary,
    voting_deadline: match.voting_deadline,
    results_processed: match.results_processed,
  };
}

/**
 * Transforma lista de times brutos para entidades
 * @param {any[]} teamsRaw
 * @returns {import('../types').FMTeam[]}
 */
export function teamsFromSupabase(teamsRaw) {
  return normalizeTeams(teamsRaw);
}

/**
 * Validação básica de Match (sem Zod/Yup)
 * @param {any} data
 * @returns {{ valid: boolean; errors: string[] }}
 */
export function validateMatch(data) {
  const errors = [];

  if (!data.title || String(data.title).trim().length === 0) {
    errors.push('Título é obrigatório');
  }

  if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.push('Data inválida (YYYY-MM-DD)');
  }

  if (!data.time || !/^\d{2}:\d{2}$/.test(data.time)) {
    errors.push('Hora inválida (HH:mm)');
  }

  if (Number(data.player_fee) < 0) {
    errors.push('Taxa não pode ser negativa');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
