import { escapeHtml } from '../../utils/sanitize.js';

const EMPTY_GOALS_HTML = '<div class="pav-event-item" style="color:var(--pav-text-muted)">&mdash;</div>';

export function buildPublicGoalsListHtml(goals = []) {
  const items = Array.isArray(goals) ? goals : [];

  return items.map((goal) => `
    <div class="pav-event-item">
      <span class="pav-event-time">${escapeHtml(goal.minuto)}</span>
      <span>&#9917;</span>
      <span class="pav-event-name">${escapeHtml(goal.jogador)}</span>
    </div>
  `).join('') || EMPTY_GOALS_HTML;
}

export function buildPublicCardsListHtml(redCards = [], yellowCards = []) {
  const cards = [
    ...(Array.isArray(redCards) ? redCards.map((card) => ({ ...card, tipo: 'vermelho' })) : []),
    ...(Array.isArray(yellowCards) ? yellowCards.map((card) => ({ ...card, tipo: 'amarelo' })) : []),
  ];

  return cards.map((card) => {
    const icon = card.tipo === 'vermelho' ? '&#128997;' : '&#128993;';

    return `
      <div class="pav-event-item cartao">
        <span class="pav-event-time">${escapeHtml(card.minuto)}</span>
        <span>${icon}</span>
        <span class="pav-event-name">${escapeHtml(card.jogador)}</span>
      </div>
    `;
  }).join('');
}
