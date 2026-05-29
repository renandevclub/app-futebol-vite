import { generateId } from '../../services/impl/supabase-client.impl.js';
import {
  normalizeTeams,
  TEAM_DEFAULT_STYLES,
} from '../../services/impl/match-normalizer.js';

export function createTeamDraft(name = '', id = null, color = null, icon = null) {
  return {
    id: id || generateId('team'),
    name,
    color,
    icon,
  };
}

export function createTeamDraftsFromTeams(teams = []) {
  return normalizeTeams(teams).map((team) =>
    createTeamDraft(team.name, team.id, team.color, team.icon),
  );
}

export function getTeamsFromDraft(teamDraft = []) {
  return normalizeTeams(
    teamDraft.map((team) => ({
      id: team.id,
      name: team.name,
      color: team.color || null,
      icon: team.icon || null,
    })),
  );
}

export function getTeamDraftColor(team, index = 0) {
  const defaultStyle =
    TEAM_DEFAULT_STYLES[index % TEAM_DEFAULT_STYLES.length] || {
      color: '#10b981',
    };

  return team?.color || defaultStyle.color;
}

export function syncPlayersWithTeams(players = [], teams = []) {
  const teamMap = new Map(teams.map((team) => [team.id, team]));

  return players.map((player) => {
    if (!player?.teamId) return player;

    const team = teamMap.get(player.teamId);
    if (!team) {
      const { teamId, teamName, ...rest } = player;
      return { ...rest, assignmentMode: 'manual' };
    }

    return { ...player, teamName: team.name };
  });
}

export function syncDrawsWithTeams(draws = {}, teams = []) {
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const nextDraws = {};

  Object.entries(draws || {}).forEach(([key, draw]) => {
    const team = teamMap.get(draw?.teamId);
    nextDraws[key] = team ? { ...draw, teamName: team.name } : draw;
  });

  return nextDraws;
}
