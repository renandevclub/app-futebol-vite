import { getClient } from './supabase.service.js';

export const LIVE_SCORE_TABLES = Object.freeze({
  matches: 'fm_partidas_ao_vivo',
  standings: 'fm_classificacao',
});

export function getLiveScoreClient() {
  return getClient();
}

export async function getActiveLiveScoreMatch(client = getLiveScoreClient()) {
  if (!client) {
    return { data: null, error: new Error('Supabase client unavailable') };
  }

  return client
    .from(LIVE_SCORE_TABLES.matches)
    .select('id')
    .eq('status', 'em-andamento')
    .maybeSingle();
}

export async function getCurrentLiveScoreMatch(client = getLiveScoreClient()) {
  if (!client) {
    return { data: null, error: new Error('Supabase client unavailable') };
  }

  return client
    .from(LIVE_SCORE_TABLES.matches)
    .select('*')
    .eq('status', 'em-andamento')
    .maybeSingle();
}

export async function createLiveScoreMatch(matchPayload, client = getLiveScoreClient()) {
  if (!client) {
    return { data: null, error: new Error('Supabase client unavailable') };
  }

  return client
    .from(LIVE_SCORE_TABLES.matches)
    .insert(matchPayload)
    .select('*')
    .single();
}

export async function updateLiveScoreMatch(matchId, patch, client = getLiveScoreClient()) {
  if (!client) {
    return { data: null, error: new Error('Supabase client unavailable') };
  }

  return client
    .from(LIVE_SCORE_TABLES.matches)
    .update(patch)
    .eq('id', matchId);
}

export async function finishLiveScoreMatch(matchId, client = getLiveScoreClient()) {
  return updateLiveScoreMatch(matchId, {
    status: 'finalizada',
    cronometro_state: { minutos: 0, segundos: 0, rodando: false },
  }, client);
}

export async function getLiveScoreScheduledMatches(client = getLiveScoreClient()) {
  if (!client) {
    return { data: null, error: new Error('Supabase client unavailable') };
  }

  return client
    .from('fm_partidas')
    .select('id,title,date,time,teams')
    .order('date', { ascending: false })
    .limit(20);
}

export async function getLiveScoreScheduledMatch(matchId, client = getLiveScoreClient()) {
  if (!client) {
    return { data: null, error: new Error('Supabase client unavailable') };
  }

  return client
    .from('fm_partidas')
    .select('*')
    .eq('id', matchId)
    .single();
}

export async function getStandingsCompetitions(client = getLiveScoreClient()) {
  if (!client) {
    return { data: null, error: new Error('Supabase client unavailable') };
  }

  const { data, error } = await client
    .from(LIVE_SCORE_TABLES.standings)
    .select('match_id')
    .order('updated_at', { ascending: false });

  if (error || !data) return { data: null, error };

  const matchIds = [...new Set(data.map((row) => row.match_id))];
  const matchTitles = {};

  if (matchIds.length > 0) {
    const { data: matches } = await client
      .from('fm_partidas')
      .select('id, title, date')
      .in('id', matchIds);

    matches?.forEach((match) => {
      matchTitles[match.id] = match.title || `Partida ${match.date || match.id}`;
    });

    const missingIds = matchIds.filter((id) => !matchTitles[id]);
    if (missingIds.length > 0) {
      const { data: liveMatches } = await client
        .from(LIVE_SCORE_TABLES.matches)
        .select('id, time1_nome, time2_nome')
        .in('id', missingIds);

      liveMatches?.forEach((match) => {
        matchTitles[match.id] = `${match.time1_nome} vs ${match.time2_nome}`;
      });
    }
  }

  return {
    data: matchIds.map((id) => ({
      id,
      title: matchTitles[id] || id,
    })),
    error: null,
  };
}

export async function getStandingsByMatch(matchId, client = getLiveScoreClient()) {
  if (!client) {
    return { data: null, error: new Error('Supabase client unavailable') };
  }

  return client
    .from(LIVE_SCORE_TABLES.standings)
    .select('*')
    .eq('match_id', matchId)
    .order('points', { ascending: false })
    .order('wins', { ascending: false })
    .order('goal_difference', { ascending: false })
    .order('goals_for', { ascending: false })
    .order('goals_against', { ascending: true });
}

export async function getLiveScoreHistoryCompetitions(client = getLiveScoreClient()) {
  if (!client) {
    return { data: null, error: new Error('Supabase client unavailable') };
  }

  const { data, error } = await client
    .from(LIVE_SCORE_TABLES.matches)
    .select('id, match_id, time1_nome, time2_nome, updated_at')
    .eq('status', 'finalizada')
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error || !data) return { data: null, error };

  const competitionsById = new Map();
  const matchIds = [];

  data.forEach((match) => {
    const competitionId = match.match_id || match.id;
    if (!competitionsById.has(competitionId)) {
      competitionsById.set(competitionId, {
        id: competitionId,
        matchId: match.match_id,
        matches: [],
        title: null,
      });

      if (match.match_id) matchIds.push(match.match_id);
    }

    competitionsById.get(competitionId).matches.push(match);
  });

  if (matchIds.length > 0) {
    const { data: matches } = await client
      .from('fm_partidas')
      .select('id, title')
      .in('id', [...new Set(matchIds)]);

    matches?.forEach((match) => {
      if (competitionsById.has(match.id)) {
        competitionsById.get(match.id).title = match.title;
      }
    });
  }

  return {
    data: [...competitionsById.values()].map((competition) => {
      const fallbackTitle = `${competition.matches[0].time1_nome} vs ${competition.matches[0].time2_nome}`;
      const title = competition.title || fallbackTitle;
      const matchCount = competition.matches.length;

      return {
        id: competition.id,
        matchId: competition.matchId,
        title,
        matchCount,
        label: `${title} (${matchCount} partida${matchCount > 1 ? 's' : ''})`,
      };
    }),
    error: null,
  };
}

export async function getLiveScoreHistoryDetails(competitionId, client = getLiveScoreClient()) {
  if (!client) {
    return { data: null, error: new Error('Supabase client unavailable') };
  }

  let query = client
    .from(LIVE_SCORE_TABLES.matches)
    .select('*')
    .eq('status', 'finalizada')
    .order('updated_at', { ascending: false })
    .limit(20);

  // Preserves the legacy id-vs-match_id filter contract used by both scoreboards.
  if (competitionId.length === 36 && competitionId.includes('-')) {
    query = query.eq('id', competitionId);
  } else {
    query = query.eq('match_id', competitionId);
  }

  const { data, error } = await query;
  if (error || !data) return { data: null, error };

  let title = '';
  const matchId = data[0]?.match_id;

  if (matchId) {
    const { data: match } = await client
      .from('fm_partidas')
      .select('title')
      .eq('id', matchId)
      .maybeSingle();

    if (match?.title) title = match.title;
  }

  return {
    data: {
      matches: data,
      title,
    },
    error: null,
  };
}

export const liveScoreService = Object.freeze({
  tables: LIVE_SCORE_TABLES,
  getClient: getLiveScoreClient,
  getActiveLiveScoreMatch,
  getCurrentLiveScoreMatch,
  createLiveScoreMatch,
  updateLiveScoreMatch,
  finishLiveScoreMatch,
  getLiveScoreScheduledMatches,
  getLiveScoreScheduledMatch,
  getStandingsCompetitions,
  getStandingsByMatch,
  getLiveScoreHistoryCompetitions,
  getLiveScoreHistoryDetails,
});
