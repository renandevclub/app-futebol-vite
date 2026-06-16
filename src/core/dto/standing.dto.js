/**
 * @file src/core/dto/standing.dto.js
 * @description DTO e transformação para Standing (Classificação de TIMES por competição)
 * Schema real: fm_classificacao — cada match_id tem sua própria tabela de classificação
 */

/**
 * Transforma dados brutos do Supabase para entidade interna
 * @param {any} rawData
 * @returns {import('../types').FMStanding|null}
 */
export function standingFromSupabase(rawData) {
  if (!rawData) return null;

  return {
    id: rawData.id || '',
    match_id: rawData.match_id || '',
    team_id: rawData.team_id || '',
    team_name: rawData.team_name || '',
    team_color: rawData.team_color || '#60a5fa',
    points: Number(rawData.points || 0),
    wins: Number(rawData.wins || 0),
    draws: Number(rawData.draws || 0),
    losses: Number(rawData.losses || 0),
    goals_for: Number(rawData.goals_for || 0),
    goals_against: Number(rawData.goals_against || 0),
    goal_difference: Number(rawData.goal_difference || 0),
    matches_played: Number(rawData.matches_played || 0),
    created_at: rawData.created_at || null,
    updated_at: rawData.updated_at || null,
  };
}

/**
 * Transforma entidade interna para formato Supabase
 * @param {import('../types').FMStanding} standing
 * @returns {Object}
 */
export function standingToSupabase(standing) {
  return {
    id: standing.id,
    match_id: standing.match_id,
    team_id: standing.team_id,
    team_name: standing.team_name,
    team_color: standing.team_color,
    points: standing.points,
    wins: standing.wins,
    draws: standing.draws,
    losses: standing.losses,
    goals_for: standing.goals_for,
    goals_against: standing.goals_against,
    goal_difference: standing.goal_difference,
    matches_played: standing.matches_played,
  };
}

/**
 * Calcula pontos (3 vitória + 1 empate)
 * @param {number} wins
 * @param {number} draws
 * @returns {number}
 */
export function calculatePoints(wins, draws) {
  return (wins * 3) + (draws * 1);
}

/**
 * Calcula diferença de gols
 * @param {number} goalsFor
 * @param {number} goalsAgainst
 * @returns {number}
 */
export function calculateGoalDifference(goalsFor, goalsAgainst) {
  return goalsFor - goalsAgainst;
}

/**
 * Comparador para sort (descendente por pontos, depois diferença de gols)
 * @param {import('../types').FMStanding} a
 * @param {import('../types').FMStanding} b
 * @returns {number}
 */
export function standingComparator(a, b) {
  if (b.points !== a.points) {
    return b.points - a.points;
  }
  return b.goal_difference - a.goal_difference;
}

/**
 * Formata standing para exibição
 * @param {import('../types').FMStanding} standing
 * @param {number} [position]
 * @returns {Object}
 */
export function formatStandingDisplay(standing, position = null) {
  return {
    position,
    teamId: standing.team_id,
    teamName: standing.team_name,
    teamColor: standing.team_color,
    matches: standing.matches_played,
    wins: standing.wins,
    draws: standing.draws,
    losses: standing.losses,
    goalsFor: standing.goals_for,
    goalsAgainst: standing.goals_against,
    goalDifference: standing.goal_difference,
    points: standing.points,
    winRate: standing.matches_played > 0 
      ? ((standing.wins / standing.matches_played) * 100).toFixed(1)
      : '0.0',
  };
}
