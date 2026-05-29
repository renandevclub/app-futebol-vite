import { formatShortDateBR } from '../../utils/date.js';
import { normalizeHexColor } from '../../utils/color.js';
import { escapeHtml } from '../../utils/sanitize.js';

const HISTORY_VARIANTS = {
  admin: {
    itemClass: 'adm-hist-item',
    itemStyle: 'margin-bottom:16px;',
    dateBadgeClass: 'adm-hist-date-badge',
    matchClass: 'adm-hist-match',
    teamClass: 'adm-hist-team',
    scoreBoxClass: 'adm-hist-score-box',
    mutedColor: 'var(--text-muted)',
    secondaryColor: 'var(--text-secondary)',
    titleStyle: 'font-size:1rem;color:var(--text-main);',
    winnerWeight: true,
  },
  public: {
    itemClass: 'pav-historico-item',
    itemStyle: '',
    dateBadgeClass: 'pav-historico-date-badge',
    matchClass: 'pav-historico-match',
    teamClass: 'pav-historico-team',
    scoreBoxClass: 'pav-historico-score-box',
    mutedColor: 'var(--pav-text-muted)',
    secondaryColor: 'var(--pav-text-secondary)',
    titleStyle: 'font-size:1rem;',
    winnerWeight: false,
  },
};

function getHistoryVariant(variant) {
  return HISTORY_VARIANTS[variant] || HISTORY_VARIANTS.public;
}

function getScore(value) {
  const score = Number(value || 0);
  return Number.isFinite(score) ? score : 0;
}

function groupGoals(events = []) {
  const goalsByPlayer = new Map();

  events.forEach((event) => {
    const key = event.jogador || 'Jogador';
    if (!goalsByPlayer.has(key)) {
      goalsByPlayer.set(key, { jogador: key, gols: 0, minutos: [] });
    }

    const entry = goalsByPlayer.get(key);
    entry.gols += 1;
    entry.minutos.push(event.minuto);
  });

  return [...goalsByPlayer.values()];
}

function renderScorers(scorers, teamColor, mutedColor) {
  if (!scorers.length) {
    return `<span style="color:${mutedColor};font-size:0.78rem;">&mdash;</span>`;
  }

  return scorers.map((scorer) => {
    const minutes = scorer.minutos.map((minute) => escapeHtml(minute)).join(', ');

    return `
      <div style="display:inline-flex;align-items:center;gap:4px;margin:2px 4px;padding:3px 8px;background:${teamColor};color:#fff;border-radius:12px;font-size:0.72rem;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,0.3);">
        &#9917; ${scorer.gols}x ${escapeHtml(scorer.jogador)}
        <span style="opacity:0.7;font-weight:400;">(${minutes})</span>
      </div>`;
  }).join('');
}

function renderCards(redCards, yellowCards, teamKey, mutedColor) {
  const red = (redCards[teamKey] || []).map((card) => (
    `<span style="display:inline-flex;align-items:center;gap:2px;margin:1px 3px;font-size:0.7rem;">&#128997; ${escapeHtml(card.jogador)} (${escapeHtml(card.minuto)})</span>`
  )).join('');
  const yellow = (yellowCards[teamKey] || []).map((card) => (
    `<span style="display:inline-flex;align-items:center;gap:2px;margin:1px 3px;font-size:0.7rem;">&#128993; ${escapeHtml(card.jogador)} (${escapeHtml(card.minuto)})</span>`
  )).join('');

  return red + yellow || `<span style="color:${mutedColor};font-size:0.7rem;">Nenhum</span>`;
}

function buildCompetitionTitleHtml(title, variantConfig) {
  if (!title) return '';

  return `
    <div style="text-align:center;margin-bottom:20px;padding:12px;background:rgba(245,158,11,0.08);border-radius:12px;border:1px solid rgba(245,158,11,0.15);">
      <i class="fas fa-trophy" style="color:#f59e0b;margin-right:6px;"></i>
      <strong style="${variantConfig.titleStyle}">${escapeHtml(title)}</strong>
    </div>`;
}

export function buildLiveScoreHistoryHtml(partidas = [], competicaoTitulo = '', { variant = 'public' } = {}) {
  const config = getHistoryVariant(variant);
  const matches = Array.isArray(partidas) ? partidas : [];
  const html = matches.map((partida) => {
    const date = new Date(partida.updated_at);
    const formattedDate = formatShortDateBR(date);
    const formattedTime = Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const team1Color = normalizeHexColor(partida.time1_color);
    const team2Color = normalizeHexColor(partida.time2_color, '#fb7185');
    const team1Score = getScore(partida.time1_gols);
    const team2Score = getScore(partida.time2_gols);
    const team1Won = team1Score > team2Score;
    const team2Won = team2Score > team1Score;
    const tied = team1Score === team2Score;
    const winnerWeight1 = config.winnerWeight && team1Won ? 'font-weight:800;' : '';
    const winnerWeight2 = config.winnerWeight && team2Won ? 'font-weight:800;' : '';
    const goals = partida.gols_registrados || { time1: [], time2: [] };
    const redCards = partida.cartoes_vermelhos_registrados || { time1: [], time2: [] };
    const yellowCards = partida.cartoes_amarelos_registrados || { time1: [], time2: [] };
    const team1Name = escapeHtml(partida.time1_nome || 'Time 1');
    const team2Name = escapeHtml(partida.time2_nome || 'Time 2');
    const itemStyle = config.itemStyle ? ` style="${config.itemStyle}"` : '';
    const resultBadge = tied
      ? '<span style="background:rgba(251,191,36,0.15);color:#fbbf24;padding:3px 10px;border-radius:20px;font-size:0.7rem;font-weight:700;">EMPATE</span>'
      : '';

    // Keep all repeated match-history markup in one module while controllers own data loading.
    return `
      <div class="${config.itemClass}"${itemStyle}>
        <div class="${config.dateBadgeClass}">
          <i class="far fa-calendar-alt"></i> ${formattedDate} <span class="time-muted">${formattedTime}</span>
          ${resultBadge}
        </div>
        <div class="${config.matchClass}">
          <div class="${config.teamClass} left ${team1Won ? 'winner' : ''}" style="background:${team1Color};color:#fff;border-radius:20px;padding:4px 10px;text-shadow:0 1px 2px rgba(0,0,0,0.3);${winnerWeight1}">
            <span class="team-name">${team1Name}</span>
          </div>
          <div class="${config.scoreBoxClass}">
            <span class="score-badge s1 ${team1Won ? 'winner' : ''}" style="color:${team1Won ? team1Color : config.secondaryColor}">${team1Score}</span>
            <span class="sep">&times;</span>
            <span class="score-badge s2 ${team2Won ? 'winner' : ''}" style="color:${team2Won ? team2Color : config.secondaryColor}">${team2Score}</span>
          </div>
          <div class="${config.teamClass} right ${team2Won ? 'winner' : ''}" style="background:${team2Color};color:#fff;border-radius:20px;padding:4px 10px;text-shadow:0 1px 2px rgba(0,0,0,0.3);${winnerWeight2}">
            <span class="team-name">${team2Name}</span>
          </div>
        </div>

        <div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <div style="font-size:0.7rem;font-weight:700;color:${config.mutedColor};text-transform:uppercase;margin-bottom:6px;">
                &#9917; Gols - ${team1Name}
              </div>
              ${renderScorers(groupGoals(goals.time1 || []), team1Color, config.mutedColor)}
            </div>
            <div>
              <div style="font-size:0.7rem;font-weight:700;color:${config.mutedColor};text-transform:uppercase;margin-bottom:6px;">
                &#9917; Gols - ${team2Name}
              </div>
              ${renderScorers(groupGoals(goals.time2 || []), team2Color, config.mutedColor)}
            </div>
          </div>
        </div>

        <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <div style="font-size:0.7rem;font-weight:700;color:${config.mutedColor};text-transform:uppercase;margin-bottom:4px;">
                &#128993;&#128997; Cart&otilde;es - ${team1Name}
              </div>
              ${renderCards(redCards, yellowCards, 'time1', config.mutedColor)}
            </div>
            <div>
              <div style="font-size:0.7rem;font-weight:700;color:${config.mutedColor};text-transform:uppercase;margin-bottom:4px;">
                &#128993;&#128997; Cart&otilde;es - ${team2Name}
              </div>
              ${renderCards(redCards, yellowCards, 'time2', config.mutedColor)}
            </div>
          </div>
        </div>
      </div>`;
  }).join('');

  return buildCompetitionTitleHtml(competicaoTitulo, config) + html;
}
