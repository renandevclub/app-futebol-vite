import {
  normalizeTeamDraws,
  normalizeTeamKey,
  normalizeTeams,
} from '../../services/match.service.js';
import { escapeHtml } from '../../utils/sanitize.js';

export const SCRATCH_COLORS = Object.freeze([
  { hex: '#f59e0b', rgb: '245,158,11' },
  { hex: '#8b5cf6', rgb: '139,92,246' },
  { hex: '#f97316', rgb: '249,115,22' },
  { hex: '#06b6d4', rgb: '6,182,212' },
  { hex: '#ec4899', rgb: '236,72,153' },
  { hex: '#84cc16', rgb: '132,204,22' },
]);

export function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return '107,114,128';

  const sanitized = hex.replace('#', '').trim();
  if (sanitized.length === 3) {
    const [r, g, b] = sanitized.split('');
    return `${parseInt(r + r, 16)},${parseInt(g + g, 16)},${parseInt(b + b, 16)}`;
  }

  if (sanitized.length !== 6) return '107,114,128';

  const intVal = parseInt(sanitized, 16);
  const r = (intVal >> 16) & 255;
  const g = (intVal >> 8) & 255;
  const b = intVal & 255;
  return `${r},${g},${b}`;
}

export function getScratchColor(colorHexOrIndex) {
  if (typeof colorHexOrIndex === 'string') {
    return { hex: colorHexOrIndex, rgb: hexToRgb(colorHexOrIndex) };
  }

  const index = Number.isInteger(colorHexOrIndex) ? colorHexOrIndex : 0;
  return SCRATCH_COLORS[index % SCRATCH_COLORS.length];
}

export function getMatchTeams(match) {
  return normalizeTeams(match?.teams || []);
}

export function isScratchCardEnabled(match) {
  return getMatchTeams(match).length >= 3;
}

export function getDrawKey(username) {
  return normalizeTeamKey(username);
}

export function getCurrentUserDraw(match, user) {
  const draws = normalizeTeamDraws(match?.teamDraws || match?.team_draws || {});
  return draws[getDrawKey(user?.username)] || null;
}

export function getTeamById(match, teamId) {
  return getMatchTeams(match).find((team) => team.id === teamId) || null;
}

export function getPlayerTeamLabel(match, player) {
  if (player?.teamName) return player.teamName;
  const team = getTeamById(match, player?.teamId);
  return team?.name || '';
}

export function getMatchPlayer(match, username) {
  const usernameKey = getDrawKey(username);
  return (
    (match?.players || []).find(
      (player) => getDrawKey(player?.username) === usernameKey,
    ) || null
  );
}

export function playerCanDrawAgain(match, player) {
  return Boolean(
    player && isScratchCardEnabled(match) && !getPlayerTeamLabel(match, player),
  );
}

export function createTeamOptions(match, selectedTeamId = '') {
  const options = ['<option value="">Sem time</option>'];

  getMatchTeams(match).forEach((team) => {
    const selected = team.id === selectedTeamId ? 'selected' : '';
    options.push(
      `<option value="${escapeHtml(team.id)}" ${selected}>${escapeHtml(team.name)}</option>`,
    );
  });

  return options.join('');
}
