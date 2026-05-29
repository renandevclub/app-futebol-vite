/**
 * @file src/services/impl/match.service.js
 * @description Gerenciamento de partidas
 * Lógica de CRUD de matches e operações associadas
 */

import { getSupabaseClient, runSupabaseOperation } from './supabase-client.service.js';
import { matchFromSupabase, matchToSupabase, validateMatch } from '../../core/dto/match.dto.js';
import { isCurrentUserAdmin } from './auth.service.js';

/**
 * Lista todas as partidas
 * @returns {Promise<any[]>}
 */
export async function listMatches() {
  return runSupabaseOperation(
    async (client) => {
      const { data, error } = await client
        .from('fm_partidas')
        .select('*')
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (error) throw error;

      return (data || []).map(matchFromSupabase);
    },
    []
  );
}

/**
 * Obtém uma partida por ID
 * @param {string} matchId
 * @returns {Promise<any|null>}
 */
export async function getMatchById(matchId) {
  return runSupabaseOperation(
    async (client) => {
      const { data, error } = await client
        .from('fm_partidas')
        .select('*')
        .eq('id', matchId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // 404 é ok
      
      return data ? matchFromSupabase(data) : null;
    },
    null
  );
}

/**
 * Cria nova partida
 * @param {any} match - Dados da partida
 * @returns {Promise<any|null>}
 */
export async function createMatch(match) {
  if (!isCurrentUserAdmin()) {
    throw new Error('Apenas administradores podem criar partidas');
  }

  // Valida dados
  const validation = validateMatch(match);
  if (!validation.valid) {
    throw new Error(`Validação falhou: ${validation.errors.join(', ')}`);
  }

  return runSupabaseOperation(
    async (client) => {
      const payload = matchToSupabase(match);
      
      const { data, error } = await client
        .from('fm_partidas')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      return matchFromSupabase(data);
    },
    null
  );
}

/**
 * Atualiza partida existente
 * @param {string} matchId
 * @param {any} updates
 * @returns {Promise<any|null>}
 */
export async function updateMatch(matchId, updates) {
  if (!isCurrentUserAdmin()) {
    throw new Error('Apenas administradores podem atualizar partidas');
  }

  return runSupabaseOperation(
    async (client) => {
      const { data, error } = await client
        .from('fm_partidas')
        .update(updates)
        .eq('id', matchId)
        .select()
        .single();

      if (error) throw error;

      return matchFromSupabase(data);
    },
    null
  );
}

/**
 * Atualiza roster (lista de jogadores) de match
 * @param {string} matchId
 * @param {any} roster
 * @returns {Promise<boolean>}
 */
export async function updateMatchRoster(matchId, roster) {
  if (!isCurrentUserAdmin()) {
    throw new Error('Apenas administradores podem atualizar roster');
  }

  return runSupabaseOperation(
    async (client) => {
      const { error } = await client
        .from('fm_partidas')
        .update({ roster })
        .eq('id', matchId);

      if (error) throw error;

      return true;
    },
    false
  );
}

/**
 * Deleta partida
 * @param {string} matchId
 * @returns {Promise<boolean>}
 */
export async function deleteMatch(matchId) {
  if (!isCurrentUserAdmin()) {
    throw new Error('Apenas administradores podem deletar partidas');
  }

  return runSupabaseOperation(
    async (client) => {
      const { error } = await client
        .from('fm_partidas')
        .delete()
        .eq('id', matchId);

      if (error) throw error;

      return true;
    },
    false
  );
}

/**
 * Atualiza score/placar de match
 * @param {string} matchId
 * @param {Object} score - { team_1_score, team_2_score }
 * @returns {Promise<any|null>}
 */
export async function updateMatchScore(matchId, score) {
  if (!isCurrentUserAdmin()) {
    throw new Error('Apenas administradores podem atualizar placar');
  }

  return runSupabaseOperation(
    async (client) => {
      const { data, error } = await client
        .from('fm_partidas')
        .update(score)
        .eq('id', matchId)
        .select()
        .single();

      if (error) throw error;

      return matchFromSupabase(data);
    },
    null
  );
}

/**
 * Player se inscreve em partida
 * @param {string} matchId
 * @param {string} playerId
 * @returns {Promise<boolean>}
 */
export async function joinMatch(matchId, playerId) {
  return runSupabaseOperation(
    async (client) => {
      const { error } = await client
        .from('fm_sorteios_jogadores')
        .insert({
          match_id: matchId,
          player_id: playerId,
          status: 'pending',
        });

      if (error) throw error;

      return true;
    },
    false
  );
}

/**
 * Player se retira de partida
 * @param {string} matchId
 * @param {string} playerId
 * @returns {Promise<boolean>}
 */
export async function leaveMatch(matchId, playerId) {
  return runSupabaseOperation(
    async (client) => {
      const { error } = await client
        .from('fm_sorteios_jogadores')
        .delete()
        .eq('match_id', matchId)
        .eq('player_id', playerId);

      if (error) throw error;

      return true;
    },
    false
  );
}
