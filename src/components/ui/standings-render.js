import { normalizeHexColor } from '../../utils/color.js';
import { escapeHtml } from '../../utils/sanitize.js';

function createOption(value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

export function renderStandingsCompetitionOptions(
  select,
  competitions = [],
  {
    defaultLabel = '\u2014 Escolha uma competi\u00e7\u00e3o \u2014',
    emptyLabel = '\u2014 Nenhuma competi\u00e7\u00e3o dispon\u00edvel \u2014',
  } = {},
) {
  if (!select) return false;

  // TextContent preserves labels safely while avoiding duplicated option markup.
  const options = [];
  const items = Array.isArray(competitions) ? competitions : [];

  if (!items.length) {
    options.push(createOption('', emptyLabel));
    select.replaceChildren(...options);
    return false;
  }

  options.push(createOption('', defaultLabel));
  items.forEach(({ id, title }) => {
    options.push(createOption(id, title || 'Competi\u00e7\u00e3o sem t\u00edtulo'));
  });

  select.replaceChildren(...options);
  return true;
}

export function formatGoalDifferenceHtml(goalDifference = 0) {
  const value = Number(goalDifference || 0);

  if (value > 0) {
    return `<span class="standings-gd-positive">+${value}</span>`;
  }

  if (value < 0) {
    return `<span class="standings-gd-negative">${value}</span>`;
  }

  return '<span class="standings-gd-zero">0</span>';
}

export function buildStandingsTableHtml(
  standings = [],
  {
    wrapperClass,
    tableClass,
    positionMode = 'badge',
  } = {},
) {
  const rows = standings.map((standing, index) => {
    const position = index + 1;
    const rowClass = position === 1 ? 'top-1' : '';
    const teamColor = normalizeHexColor(standing.team_color);
    const positionHtml =
      positionMode === 'badge'
        ? `<span class="standings-pos">${position}&ordm;</span>`
        : `${position}&ordm;`;

    return `
      <tr class="${rowClass}">
        <td>${positionHtml}</td>
        <td><span class="standings-team-pill" style="background:${teamColor}">${escapeHtml(standing.team_name)}</span></td>
        <td><span class="standings-pts">${standing.points}</span></td>
        <td>${standing.matches_played || 0}</td>
        <td>${standing.wins || 0}</td>
        <td>${standing.draws || 0}</td>
        <td>${standing.losses || 0}</td>
        <td>${standing.goals_for || 0}</td>
        <td>${standing.goals_against || 0}</td>
        <td>${formatGoalDifferenceHtml(standing.goal_difference || 0)}</td>
      </tr>`;
  }).join('');

  return `
    <div class="${wrapperClass}">
      <table class="${tableClass}">
        <thead>
          <tr>
            <th>#</th>
            <th>Time</th>
            <th>P</th>
            <th>J</th>
            <th>V</th>
            <th>E</th>
            <th>D</th>
            <th>GP</th>
            <th>GC</th>
            <th>SG</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;
}
