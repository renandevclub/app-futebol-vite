import { normalizeHexColor } from '../../utils/color.js';
import { escapeHtml } from '../../utils/sanitize.js';

const MANUAL_MATCH_LABEL = '\u2014 Partida manual (sem v\u00ednculo) \u2014';
const MANUAL_TEAM_LABEL = 'Digitar manualmente...';

function createOption(value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

export function renderScheduledMatchOptions(select, matches = []) {
  if (!select) return;

  const options = [createOption('', MANUAL_MATCH_LABEL)];
  const items = Array.isArray(matches) ? matches : [];

  items.forEach((match) => {
    const title = match.title || 'Sem t\u00edtulo';
    options.push(createOption(match.id, `${title} - ${match.date || ''}`));
  });

  select.replaceChildren(...options);
}

export function buildScheduledMatchInfoHtml(match) {
  const players = Array.isArray(match?.players) ? match.players : [];
  const teams = Array.isArray(match?.teams) ? match.teams : [];
  const totalPlayers = players.length;
  const titleHtml = match?.title
    ? `<strong style="color:var(--accent-purple); display:block; margin-bottom:4px;">&#127942; ${escapeHtml(match.title)}</strong>`
    : '';
  const location = match?.location || 'Local n\u00e3o informado';
  const plural = totalPlayers !== 1 ? 'es' : '';
  const confirmedPlural = totalPlayers !== 1 ? 's' : '';
  const teamDetailsHtml = teams.length > 0 && totalPlayers > 0
    ? `
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
        ${teams.map((team) => {
          const count = players.filter((player) => player.teamId === team.id).length;
          const color = normalizeHexColor(team.color, '#3b82f6');

          return `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;background:${color};color:#fff;font-size:0.72rem;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,0.3);">${escapeHtml(team.name)}: ${count}</span>`;
        }).join(' ')}
      </div>`
    : '';

  return `
    ${titleHtml}
    &#128197; ${escapeHtml(match?.date)} &agrave;s ${escapeHtml(match?.time)}
    <br>&#128205; <small>${escapeHtml(location)}</small>
    <br>&#128101; <small><strong>${totalPlayers}</strong> jogador${plural} confirmado${confirmedPlural}</small>
    ${teamDetailsHtml}
  `;
}

export function renderLiveScoreTeamSelects({ selectTime1, selectTime2 }, teams = []) {
  if (!selectTime1 || !selectTime2) return;

  const items = Array.isArray(teams) ? teams : [];
  const manualOption = () => createOption('manual', MANUAL_TEAM_LABEL);

  if (items.length > 0) {
    const teamOptions = items.map((team, index) => createOption(String(index), team.name || `Time ${index + 1}`));
    selectTime1.replaceChildren(...teamOptions.map((option) => option.cloneNode(true)), manualOption());
    selectTime2.replaceChildren(...teamOptions.map((option) => option.cloneNode(true)), manualOption());
    selectTime1.value = '0';
    selectTime2.value = items.length > 1 ? '1' : '0';
    selectTime1.style.display = 'block';
    selectTime2.style.display = 'block';
  } else {
    selectTime1.replaceChildren(manualOption());
    selectTime2.replaceChildren(manualOption());
    selectTime1.style.display = 'none';
    selectTime2.style.display = 'none';
  }

  selectTime1.dispatchEvent(new Event('change'));
  selectTime2.dispatchEvent(new Event('change'));
}

export function getScheduledMatchAutocompleteNames(match) {
  const players = Array.isArray(match?.players) ? match.players : [];
  const teams = Array.isArray(match?.teams) ? match.teams : [];

  return {
    time1: players
      .filter((player) => player.teamId === teams[0]?.id)
      .map((player) => player.username || player.name || ''),
    time2: players
      .filter((player) => player.teamId === teams[1]?.id)
      .map((player) => player.username || player.name || ''),
  };
}
