import { escapeHtml } from '../../utils/sanitize.js';

export function buildAdminGoalsListHtml(goals = []) {
  const items = Array.isArray(goals) ? goals : [];

  return items.map((goal) => (
    `<li>&#9917; (${escapeHtml(goal.minuto)}) ${escapeHtml(goal.jogador)}</li>`
  )).join('') || '<li style="color:var(--text-muted)">Nenhum gol</li>';
}

export function buildAdminCardsListHtml(redCards = [], yellowCards = []) {
  const cards = [
    ...(Array.isArray(redCards) ? redCards.map((card) => ({ ...card, tipo: 'vermelho' })) : []),
    ...(Array.isArray(yellowCards) ? yellowCards.map((card) => ({ ...card, tipo: 'amarelo' })) : []),
  ];

  return cards.map((card) => {
    const icon = card.tipo === 'vermelho' ? '&#128997;' : '&#128993;';

    return `
      <li class="adm-cartao-item ${card.tipo}">
        ${icon} (${escapeHtml(card.minuto)}) ${escapeHtml(card.jogador)}
      </li>`;
  }).join('') || '<li style="color:var(--text-muted)">Nenhum cart&atilde;o</li>';
}

export function buildAdminSubstitutionsListHtml(substitutions = [], teamNames = {}) {
  const items = Array.isArray(substitutions) ? substitutions : [];

  return items.map((substitution) => {
    const teamName = substitution.time === 'time1'
      ? teamNames.time1 || 'Time 1'
      : teamNames.time2 || 'Time 2';

    return `
      <div class="adm-sub-item">
        <span class="adm-sub-time">${escapeHtml(teamName)}</span>
        <span class="adm-sub-minuto">${escapeHtml(substitution.minuto)}'</span>
        <span class="adm-sub-players">${escapeHtml(substitution.sai)} <i class="fas fa-arrow-right"></i> ${escapeHtml(substitution.entra)}</span>
      </div>`;
  }).join('') || '<div class="adm-empty-msg">Nenhuma substitui&ccedil;&atilde;o ainda</div>';
}

export function buildAdminCustomEventsListHtml(events = []) {
  const items = Array.isArray(events) ? events : [];

  return items.map((event) => `
    <li class="adm-evento-item">
      <span class="adm-evento-minuto">${escapeHtml(event.minuto)}'</span>
      <span class="adm-evento-desc">${escapeHtml(event.descricao)}</span>
    </li>
  `).join('') || '<li style="color:var(--text-muted)">Nenhum evento personalizado</li>';
}
