import { generateId } from './supabase-client.impl.js';

export const TEAM_DEFAULT_STYLES = [
    { color: '#ef4444', icon: '⚽' },
    { color: '#3b82f6', icon: '🔵' },
    { color: '#1c1c2e', icon: '⚫' },
    { color: '#10b981', icon: '🟢' },
    { color: '#f59e0b', icon: '⭐' },
    { color: '#8b5cf6', icon: '🟣' },
    { color: '#f97316', icon: '🟠' },
    { color: '#06b6d4', icon: '🔷' },
    { color: '#ec4899', icon: '💗' },
    { color: '#84cc16', icon: '✨' }
];

export function normalizeTeamKey(value) {
    return String(value || '').trim().toLowerCase();
}

export function createTeamId(name, index = 0) {
    const slug = normalizeTeamKey(name)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return slug ? `team_${slug}` : generateId(`team_${index + 1}`);
}

export function normalizeTeams(teams) {
    if (!Array.isArray(teams)) return [];

    const seenIds = new Set();
    return teams
        .map((team, index) => {
            const source = typeof team === 'string' ? { name: team } : (team || {});
            const name = String(source.name || source.nome || '').trim();
            if (!name) return null;

            let id = String(source.id || createTeamId(name, index)).trim();
            if (seenIds.has(id)) {
                id = `${id}_${index + 1}`;
            }
            seenIds.add(id);

            const position = index + 1;
            const defaultStyle = TEAM_DEFAULT_STYLES[(position - 1) % TEAM_DEFAULT_STYLES.length];

            return {
                id,
                name,
                position,
                color: source.color || defaultStyle.color,
                icon: source.icon || defaultStyle.icon
            };
        })
        .filter(Boolean);
}

export function normalizeTeamDraws(draws) {
    return draws && typeof draws === 'object' && !Array.isArray(draws) ? draws : {};
}

export function normalizeMatchFromSupabase(row) {
    if (!row) return null;

    return {
        id: row.id,
        title: row.title || '',
        date: row.date,
        time: row.time,
        location: row.location,
        playerFee: Number(row.player_fee || 0),
        notes: row.notes || '',
        status: row.status || 'AGENDADA',
        players: row.players || [],
        teams: normalizeTeams(row.teams || []),
        teamDraws: normalizeTeamDraws(row.team_draws || {}),
        votes: row.votes || { best_player: [], worst_player: [] },
        financial_summary: row.financial_summary || { expenses: [] },
        results_processed: Boolean(row.results_processed),
        voting_deadline: row.voting_deadline
    };
}

export function normalizeMatchToSupabase(match) {
    return {
        id: match.id,
        title: match.title || '',
        date: match.date,
        time: match.time,
        location: match.location,
        player_fee: Number(match.playerFee || match.player_fee || 0),
        notes: match.notes || '',
        status: match.status || 'AGENDADA',
        players: match.players || [],
        teams: normalizeTeams(match.teams || []),
        team_draws: normalizeTeamDraws(match.teamDraws || match.team_draws || {}),
        votes: match.votes || { best_player: [], worst_player: [] },
        financial_summary: match.financial_summary || { expenses: [] },
        results_processed: Boolean(match.results_processed),
        voting_deadline: match.voting_deadline || null
    };
}
