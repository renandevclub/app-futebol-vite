import { normalizeTeams } from '../../services/match.service.js';
import { normalizeHexColor } from '../../utils/color.js';
import { formatCurrencyBRL } from '../../utils/format.js';
import { escapeHtml } from '../../utils/sanitize.js';

export function buildDashboardEmptyMatchesHtml() {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">&#9917;</div>
      <h3>Nenhuma partida agendada</h3>
      <p>Assim que o administrador agendar uma nova partida, ela aparecer&aacute; aqui.</p>
    </div>`;
}

export function getDashboardLocationLink(location) {
  const locationMaps = {
    'Prime Fut 7': 'https://maps.app.goo.gl/FH2FMGaBdBUtdhUT6',
    'Society Do Chocolate': 'https://maps.app.goo.gl/vBnBYdzPNnCQ7msW7',
    Chocolate: 'https://maps.app.goo.gl/vBnBYdzPNnCQ7msW7',
  };

  return locationMaps[location] || null;
}

export function getDashboardMatchDateTime(match) {
  return new Date(`${match.date}T${match.time}`);
}

export function formatDashboardMatchDate(matchDate) {
  const formattedDate = matchDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
}

function buildTeamsPreviewHtml(match) {
  const teams = normalizeTeams(match.teams || []);
  if (!teams.length) return '';

  const teamChipsHtml = teams.map((team) => {
    const color = normalizeHexColor(team.color, '#3b82f6');

    return `<span class="match-team-chip" style="background: rgba(255, 255, 255, 0.03); border: 1px solid ${color}50; color: #f8fafc;"><span class="team-dot" style="background: ${color}; box-shadow: 0 0 8px ${color};"></span>${escapeHtml(team.name)}</span>`;
  }).join('');

  return `
    <div class="match-teams-preview"><i class="fas fa-sitemap mr-1"></i> ${teams.length} time(s) cadastrado(s)${teams.length >= 3 ? ' • Sorteio ativo' : ''}</div>
    <div class="match-team-chips">
      ${teamChipsHtml}
    </div>`;
}

function buildCountdownHtml({ match, matchDateTime, now }) {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const timeDiff = matchDateTime.getTime() - now;
  const isUrgent = timeDiff > 0 && timeDiff < oneDayMs;

  if (matchDateTime.getTime() <= now || match.status === 'CANCELADA') return '';

  return `
    <div class="match-countdown-wrap">
      <span class="countdown-badge ${isUrgent ? 'urgent' : ''}" id="countdown-${escapeHtml(match.id)}"><i class="far fa-hourglass-half mr-1"></i> Calculando...</span>
    </div>`;
}

export function buildDashboardMatchCardHtml({
  match,
  formattedDate,
  matchDateTime,
  isAdmin,
  showPaymentButton,
  now = Date.now(),
}) {
  const statusClass = `status-${String(match.status || '').toLowerCase()}`;
  const locationLink = getDashboardLocationLink(match.location);
  const locationIconHtml = locationLink
    ? `<span class="location-icon text-accent" data-location-url="${escapeHtml(locationLink)}" style="cursor: pointer; margin-left: 6px;" title="Ver localização no Google Maps"><i class="fas fa-external-link-alt text-xs"></i></span>`
    : '';
  const deleteButtonHtml = isAdmin
    ? `<button class="btn btn-danger delete-button has-ripple" data-match-id="${escapeHtml(match.id)}"><i class="fas fa-trash-alt"></i> Excluir</button>`
    : '';
  const editButtonHtml = isAdmin
    ? `<button class="btn btn-secondary edit-button has-ripple" data-match-id="${escapeHtml(match.id)}"><i class="fas fa-edit"></i> Editar</button>`
    : '';
  const whatsappButtonHtml = `<button class="btn btn-whatsapp whatsapp-button has-ripple" data-match-id="${escapeHtml(match.id)}"><i class="fab fa-whatsapp"></i> WhatsApp</button>`;
  const paymentButtonHtml = showPaymentButton
    ? '<button class="btn btn-primary payment-button has-ripple" data-payment-button><i class="fas fa-credit-card"></i> Pagar Partida</button>'
    : '';

  return `
    <div class="match-card-inner">
      <div class="match-card-header">
        <span class="match-date">${escapeHtml(formattedDate)}</span>
        <span class="status-pill ${statusClass}">${escapeHtml(match.status)}</span>
      </div>
      <div class="match-card-body">
        <div class="match-info-grid">
          <span class="match-info-item"><i class="fas fa-map-marker-alt text-accent"></i> <span><strong>${escapeHtml(match.location)}</strong>${locationIconHtml}</span></span>
          <span class="match-info-item"><i class="far fa-clock text-accent"></i> <span>${escapeHtml(match.time)}h</span></span>
          <span class="match-info-item"><i class="fas fa-wallet text-accent"></i> <span>${formatCurrencyBRL(match.playerFee)}</span></span>
          <span class="match-info-item"><i class="fas fa-users text-accent"></i> <span>${(match.players || []).length} confirmados</span></span>
        </div>
        ${buildTeamsPreviewHtml(match)}
      </div>
      ${buildCountdownHtml({ match, matchDateTime, now })}
      <div class="match-card-footer">
        ${isAdmin ? `
          <div class="match-admin-actions">
            ${editButtonHtml}
            ${deleteButtonHtml}
          </div>
        ` : ''}
        <div class="match-user-actions">
          ${whatsappButtonHtml}
          <button class="btn btn-primary details-button has-ripple" data-match-id="${escapeHtml(match.id)}"><i class="fas fa-info-circle"></i> Detalhes</button>
        </div>
        ${paymentButtonHtml ? `
          <div class="match-payment-action">
            ${paymentButtonHtml}
          </div>
        ` : ''}
      </div>
    </div>`;
}
