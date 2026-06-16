/**
 * Serviço de Ranking Individual
 * 
 * Responsável por buscar dados agregados de pontuação de jogadores.
 * Fórmula de pontos:
 * - Craque (melhor jogador): +10 pontos
 * - Gol marcado: +5 pontos
 * - Partida jogada: +2 pontos
 * - Perna de Pau (pior jogador): -5 pontos
 * - Pagamento pendente: -10 pontos
 */

import { getSupabaseClient } from './supabase.service.js';

/**
 * Busca ranking individual completo ordenado por pontuação
 * @returns {Promise<Array>} Array de jogadores com ranking
 */
export async function getIndividualRanking() {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('fm_ranking_individual')
      .select('*')
      .order('total_points', { ascending: false })
      .order('username', { ascending: true });

    if (error) {
      console.error('Erro ao buscar ranking individual:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Erro ao buscar ranking individual:', err);
    return [];
  }
}

/**
 * Busca top N jogadores do ranking
 * @param {number} limit - Quantidade de jogadores a retornar
 * @returns {Promise<Array>} Array de top jogadores
 */
export async function getTopPlayers(limit = 10) {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('fm_ranking_individual')
      .select('*')
      .order('total_points', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erro ao buscar top players:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Erro ao buscar top players:', err);
    return [];
  }
}

/**
 * Busca dados de ranking de um jogador específico
 * @param {string} username - Username do jogador
 * @returns {Promise<Object|null>} Dados de ranking do jogador
 */
export async function getPlayerRankingStats(username) {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('fm_ranking_individual')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error) {
      console.error(`Erro ao buscar ranking de ${username}:`, error);
      return null;
    }

    return data;
  } catch (err) {
    console.error(`Erro ao buscar ranking de ${username}:`, err);
    return null;
  }
}

/**
 * Busca ranking com filtro por busca de texto
 * @param {string} searchTerm - Termo de busca (username ou full_name)
 * @param {number} limit - Máximo de resultados
 * @returns {Promise<Array>} Array de jogadores que correspondem à busca
 */
export async function searchRankingByPlayer(searchTerm, limit = 20) {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('fm_ranking_individual')
      .select('*')
      .or(`username.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`)
      .order('total_points', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erro ao buscar ranking por termo:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Erro ao buscar ranking por termo:', err);
    return [];
  }
}

/**
 * Busca estatísticas de uma posição de ranking
 * @param {number} position - Posição do ranking (1-based)
 * @returns {Promise<Object|null>} Dados do jogador na posição
 */
export async function getPlayerAtRankPosition(position) {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('fm_ranking_individual')
      .select('*')
      .eq('rank_position', position)
      .maybeSingle();

    if (error) {
      console.error(`Erro ao buscar jogador na posição ${position}:`, error);
      return null;
    }

    return data;
  } catch (err) {
    console.error(`Erro ao buscar jogador na posição ${position}:`, err);
    return null;
  }
}

/**
 * Busca ranking de um jogador próximo (vizinhos no ranking)
 * @param {string} username - Username do jogador
 * @param {number} rangeAboveBelow - Quantos acima e abaixo incluir
 * @returns {Promise<Array>} Array com jogador e vizinhos
 */
export async function getPlayerRankingContext(username, rangeAboveBelow = 2) {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    // Primeiro, busca posição do jogador
    const { data: playerData, error: playerError } = await client
      .from('fm_ranking_individual')
      .select('rank_position')
      .eq('username', username)
      .maybeSingle();

    if (playerError || !playerData) {
      console.error(`Jogador ${username} não encontrado:`, playerError);
      return [];
    }

    const position = playerData.rank_position;
    const startPos = Math.max(1, position - rangeAboveBelow);
    const endPos = position + rangeAboveBelow;

    // Busca jogadores no intervalo
    const { data, error } = await client
      .from('fm_ranking_individual')
      .select('*')
      .gte('rank_position', startPos)
      .lte('rank_position', endPos)
      .order('rank_position', { ascending: true });

    if (error) {
      console.error('Erro ao buscar contexto de ranking:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Erro ao buscar contexto de ranking:', err);
    return [];
  }
}

/**
 * Busca estatísticas agregadas do ranking
 * @returns {Promise<Object>} Estatísticas globais
 */
export async function getRankingStats() {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('fm_ranking_individual')
      .select('total_points, gols_count, craque_count, perna_pau_count');

    if (error) {
      console.error('Erro ao buscar estatísticas de ranking:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return {
        totalPlayers: 0,
        highestScore: 0,
        lowestScore: 0,
        avgScore: 0,
        totalGols: 0,
        totalCraques: 0,
      };
    }

    const points = data.map(p => p.total_points);
    const totalGols = data.reduce((sum, p) => sum + (p.gols_count || 0), 0);
    const totalCraques = data.reduce((sum, p) => sum + (p.craque_count || 0), 0);

    return {
      totalPlayers: data.length,
      highestScore: Math.max(...points),
      lowestScore: Math.min(...points),
      avgScore: Math.round(points.reduce((a, b) => a + b, 0) / data.length),
      totalGols,
      totalCraques,
    };
  } catch (err) {
    console.error('Erro ao buscar estatísticas de ranking:', err);
    return null;
  }
}

/**
 * Monitora mudanças em tempo real no ranking
 * @param {Function} onUpdate - Callback quando há mudanças
 * @returns {Function} Função para unsubscribe
 */
export function subscribeToRankingUpdates(onUpdate) {
  const client = getSupabaseClient();
  if (!client) {
    console.warn('Supabase cliente não disponível');
    return () => {};
  }

  const subscription = client
    .channel('fm_ranking_individual_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'fm_ranking_individual',
      },
      (payload) => {
        onUpdate(payload);
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(subscription);
  };
}

export default {
  getIndividualRanking,
  getTopPlayers,
  getPlayerRankingStats,
  searchRankingByPlayer,
  getPlayerAtRankPosition,
  getPlayerRankingContext,
  getRankingStats,
  subscribeToRankingUpdates,
};
