import { hexToRgbObject, normalizeHexColor } from '../../utils/color.js';
import { formatDateBR } from '../../utils/date.js';
import { formatCurrencyBRL } from '../../utils/format.js';
import { escapeHtml } from '../../utils/sanitize.js';

export const TEAMLESS_LABEL = 'Sem Time';

export const ACCORDION_CHEVRON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

export function splitPlayersByStatus(players = []) {
  return {
    confirmedPlayers: players.filter(
      (player) => player.status !== 'withdrew' && player.status !== 'removed',
    ),
    withdrawnPlayers: players.filter((player) => player.status === 'withdrew'),
  };
}

export function groupPlayersByTeam(players, getPlayerTeamLabel) {
  return players.reduce((groups, player) => {
    const teamLabel = getPlayerTeamLabel(player) || TEAMLESS_LABEL;
    if (!groups[teamLabel]) groups[teamLabel] = [];
    groups[teamLabel].push(player);
    return groups;
  }, {});
}

export function sortTeamLabels(teamLabels) {
  return [...teamLabels].sort((a, b) => {
    if (a === TEAMLESS_LABEL) return 1;
    if (b === TEAMLESS_LABEL) return -1;
    return a.localeCompare(b);
  });
}

export function getTeamAccordionVisual({ teamLabel, teamPlayers, getTeamById }) {
  let teamColor = '#64748b';

  if (teamLabel !== TEAMLESS_LABEL) {
    const samplePlayer = teamPlayers.find((player) => player.teamId);
    if (samplePlayer?.teamId) {
      const teamData = getTeamById(samplePlayer.teamId);
      if (teamData?.color) teamColor = teamData.color;
    } else {
      teamColor = '#3b82f6';
    }
  }

  const rgb = hexToRgbObject(teamColor);

  return {
    accordionStyle: `border-left: 4px solid ${teamColor}; background: rgba(${rgb.r},${rgb.g},${rgb.b},0.04);`,
    headerStyle: `background: linear-gradient(90deg, #101524 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35) 100%); border-radius: 12px 12px 0 0; border-bottom: 1px solid rgba(255,255,255,0.05);`,
  };
}

export function buildTeamMetaHtml(teamPlayers, playerFee) {
  const paidCount = teamPlayers.filter((player) => player.paid).length;
  const pendingCount = teamPlayers.length - paidCount;
  const pendingValue = pendingCount * playerFee;

  if (pendingCount > 0) {
    return `${teamPlayers.length} jogadores <span class="acc-dot"></span> ${formatCurrencyBRL(pendingValue)} pendente`;
  }

  return `${teamPlayers.length} jogadores <span class="acc-dot"></span> Todos pagos <i class="fas fa-check-double text-accent ml-1"></i>`;
}

export function buildTeamAccordionHeaderHtml({
  teamLabel,
  teamPlayers,
  metaHtml,
}) {
  let countTextHtml = `${teamPlayers.length}`;
  if (teamLabel !== TEAMLESS_LABEL) {
    const linhaCount = teamPlayers.filter((p) => p.drawType === 'linha' || !p.drawType || p.drawType === '').length;
    const goleiroCount = teamPlayers.filter((p) => p.drawType === 'goleiro').length;
    countTextHtml = `<span class="team-acc-counts-split">${linhaCount}L &bull; ${goleiroCount}G</span>`;
  }

  return `
    <div class="team-acc-info">
      <div class="team-acc-name">${escapeHtml(teamLabel)}</div>
      <div class="team-acc-meta">${metaHtml}</div>
    </div>
    <div class="team-acc-right">
      <div class="team-acc-count">${countTextHtml}</div>
      <div class="team-acc-chevron">${ACCORDION_CHEVRON_SVG}</div>
    </div>
  `;
}

export function buildWithdrawnAccordionHeaderHtml(withdrawnCount) {
  const label = withdrawnCount > 1 ? 'jogadores' : 'jogador';

  return `
    <div class="team-acc-icon text-danger-icon"><i class="fas fa-user-minus"></i></div>
    <div class="team-acc-info">
      <div class="team-acc-name text-danger-title">Desistentes</div>
      <div class="team-acc-meta">${withdrawnCount} ${label}</div>
    </div>
    <div class="team-acc-right">
      <div class="team-acc-count bg-danger-badge">${withdrawnCount}</div>
      <div class="team-acc-chevron">${ACCORDION_CHEVRON_SVG}</div>
    </div>
  `;
}

export function getMatchLocationLink(location) {
  const locationMaps = {
    'Prime Fut 7': 'https://maps.app.goo.gl/FH2FMGaBdBUtdhUT6',
    'Society Do Chocolate': 'https://maps.app.goo.gl/vBnBYdzPNnCQ7msW7',
    Chocolate: 'https://maps.app.goo.gl/vBnBYdzPNnCQ7msW7',
  };

  return locationMaps[location] || null;
}

function getMatchStatusBadgeStyle(status) {
  switch (status) {
    case 'CONFIRMADA':
      return 'background: rgba(0, 255, 135, 0.12); color: #00ff87; border: 1px solid rgba(0, 255, 135, 0.25);';
    case 'AGENDADA':
      return 'background: rgba(0, 210, 255, 0.12); color: #00d2ff; border: 1px solid rgba(0, 210, 255, 0.25);';
    case 'CANCELADA':
      return 'background: rgba(255, 51, 102, 0.12); color: #ff3366; border: 1px solid rgba(255, 51, 102, 0.25);';
    case 'ENCERRADA':
      return 'background: rgba(148, 163, 184, 0.12); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.25);';
    default:
      return 'background: rgba(255,255,255,0.06); color: white; border: 1px solid rgba(255,255,255,0.12);';
  }
}

function buildTeamsSummaryHtml(teams = []) {
  if (!teams.length) return '';

  const scratchBadge = teams.length >= 3
    ? '<span class="scratch-enabled-badge"><i class="fas fa-ticket-alt"></i> Sorteio ativo</span>'
    : '';
  const teamChipsHtml = teams.map((team) => {
    const color = normalizeHexColor(team.color, '#3b82f6');

    return `<span class="match-team-chip" style="background: rgba(255, 255, 255, 0.03); border: 1px solid ${color}50; color: #f8fafc;"><span class="team-dot" style="background: ${color}; box-shadow: 0 0 8px ${color};"></span>${escapeHtml(team.name)}</span>`;
  }).join('');

  return `
    <div class="match-teams-summary">
      <div class="match-teams-summary-header">
        <strong>Times da partida</strong>
        ${scratchBadge}
      </div>
      <div class="match-team-chips">
        ${teamChipsHtml}
      </div>
    </div>
  `;
}

export function buildMatchDetailsInfoHtml(match, teams = []) {
  const formattedDate = formatDateBR(match?.date);
  const locationLink = getMatchLocationLink(match?.location);
  const statusBadgeStyle = getMatchStatusBadgeStyle(match?.status);
  const locationCursor = locationLink ? 'pointer' : 'default';
  const locationUrl = escapeHtml(locationLink || '');
  const mapLinkHtml = locationLink
    ? `<a href="${locationUrl}" target="_blank" class="location-map-link"><i class="fas fa-external-link-alt text-xs mr-1"></i> Ver no Mapa</a>`
    : '';

  const titleHtml = match?.title
    ? `<div class="match-details-title-container"><h2 class="match-details-title">${escapeHtml(match.title)}</h2></div>`
    : '';

  return `
    ${titleHtml}
    <div class="match-card-header">
      <h3>Informações da Partida</h3>
      <span class="match-status-pill" style="${statusBadgeStyle}">${escapeHtml(match?.status)}</span>
    </div>

    <div class="match-info-grid-details">
      <div class="info-metric-card">
        <div class="info-metric-icon"><i class="far fa-calendar-alt"></i></div>
        <div class="info-metric-data">
          <p class="info-metric-label">Data</p>
          <p class="info-metric-value">${escapeHtml(formattedDate)}</p>
        </div>
      </div>

      <div class="info-metric-card">
        <div class="info-metric-icon"><i class="far fa-clock"></i></div>
        <div class="info-metric-data">
          <p class="info-metric-label">Horário</p>
          <p class="info-metric-value">${escapeHtml(match?.time)}h</p>
        </div>
      </div>

      <div class="info-metric-card">
        <div class="info-metric-icon"><i class="fas fa-wallet text-accent"></i></div>
        <div class="info-metric-data">
          <p class="info-metric-label">Valor Coleta</p>
          <p class="info-metric-value text-accent">${formatCurrencyBRL(match?.playerFee)}</p>
        </div>
      </div>

      <div class="info-metric-card">
        <div class="info-metric-icon location-icon" style="cursor: ${locationCursor};" data-location-url="${locationUrl}"><i class="fas fa-map-marker-alt"></i></div>
        <div class="info-metric-data">
          <p class="info-metric-label">Local</p>
          <p class="info-metric-value location-name">${escapeHtml(match?.location)}</p>
          ${mapLinkHtml}
        </div>
      </div>
    </div>

    <div class="match-notes-panel">
      <strong><i class="fas fa-info-circle mr-1"></i> Observações:</strong>
      <p>${escapeHtml(match?.notes || 'Nenhuma observação.')}</p>
    </div>
    ${buildTeamsSummaryHtml(teams)}
  `;
}

export function buildFinancialSummaryHtml(match) {
  const activePlayers = (match?.players || []).filter(
    (player) => player.status !== 'withdrew' && player.status !== 'removed',
  );
  const totalPlayers = activePlayers.length;
  const paidPlayers = activePlayers.filter((player) => player.paid).length;
  const totalValue = totalPlayers * Number(match?.playerFee || 0);
  const collectedValue = paidPlayers * Number(match?.playerFee || 0);
  const percentPlayers = totalPlayers > 0 ? (paidPlayers / totalPlayers) * 100 : 0;
  const percentValue = totalValue > 0 ? (collectedValue / totalValue) * 100 : 0;

  return `
    <div class="match-info-grid-details">
      <div class="info-metric-card flex-col">
        <div class="financial-card-header">
          <span class="financial-icon-wrap bg-blue-glow"><i class="fas fa-users"></i></span>
          <span class="financial-label">Pagantes</span>
        </div>
        <div class="financial-data-wrap">
          <div class="financial-value-row">
            <span class="financial-value-main">${paidPlayers}</span>
            <span class="financial-value-sub">/ ${totalPlayers}</span>
          </div>
        </div>
        <div class="financial-progress-bar">
          <div class="financial-progress-fill bg-blue" style="width: ${percentPlayers}%;"></div>
        </div>
      </div>

      <div class="info-metric-card flex-col">
        <div class="financial-card-header">
          <span class="financial-icon-wrap bg-green-glow"><i class="fas fa-dollar-sign"></i></span>
          <span class="financial-label">Arrecadado</span>
        </div>
        <div class="financial-data-wrap">
          <div class="financial-value-row">
            <span class="financial-value-main text-accent">${formatCurrencyBRL(collectedValue)}</span>
          </div>
          <div class="financial-target-text">
            de ${formatCurrencyBRL(totalValue)}
          </div>
        </div>
        <div class="financial-progress-bar">
          <div class="financial-progress-fill bg-green" style="width: ${percentValue}%;"></div>
        </div>
      </div>
    </div>
  `;
}

function buildPaymentStatusHtml(player) {
  return player.paid
    ? '<span class="payment-status paid" title="Pagamento confirmado"><i class="fas fa-check-circle mr-1"></i> Pago</span>'
    : '<span class="payment-status unpaid" title="Pagamento pendente"><i class="fas fa-exclamation-circle mr-1"></i> Pendente</span>';
}

function buildDetailsButtonHtml({ isAdmin, username }) {
  if (!isAdmin) return '';

  const safeUsername = escapeHtml(username);
  return `<button class="btn-details" data-username="${safeUsername}" title="Ver detalhes"><i class="fas fa-eye"></i> <span class="details-text">Opções</span></button>`;
}

function buildWhatsappButtonHtml({ isAdmin, playerPhone, username }) {
  if (!isAdmin) return '';

  if (playerPhone) {
    return `<div class="info-item"><button class="btn btn-whatsapp-player" data-phone="${escapeHtml(playerPhone)}" data-username="${escapeHtml(username)}" title="Enviar mensagem via WhatsApp"><i class="fab fa-whatsapp"></i> WhatsApp</button></div>`;
  }

  return '<div class="info-item"><span class="no-phone-info"><i class="fas fa-phone-slash mr-1"></i> Sem celular</span></div>';
}

function buildTeamBadgeHtml({ hasTeams, isWithdrawn, teamLabel, playerTeam }) {
  if (!hasTeams || isWithdrawn) return '';

  const safeTeamLabel = escapeHtml(teamLabel || TEAMLESS_LABEL);
  const style = playerTeam
    ? `background: ${playerTeam.color}; color: #fff; border-color: ${playerTeam.color}; text-shadow: 0 1px 2px rgba(0,0,0,0.3);`
    : '';

  return `<span class="player-team-badge ${teamLabel ? '' : 'unassigned'}" style="${style}"><span class="team-dot" style="background: #fff; opacity: 0.5;"></span>${safeTeamLabel}</span>`;
}

function buildTeamControlHtml({
  isAdmin,
  hasTeams,
  isWithdrawn,
  teamLabel,
  username,
  teamOptionsHtml,
}) {
  if (isAdmin && hasTeams && !isWithdrawn) {
    return `<div class="info-item team-control-item">
      <span class="info-label">Time:</span>
      <select class="player-team-select" data-username="${escapeHtml(username)}">
        ${teamOptionsHtml}
      </select>
    </div>`;
  }

  if (!isWithdrawn && teamLabel) {
    return `<div class="info-item"><span class="info-label">Time:</span><span class="info-value">${escapeHtml(teamLabel)}</span></div>`;
  }

  return '';
}

function buildWithdrawInfoHtml(player) {
  if (player.status !== 'withdrew') return '';

  const reasonHtml = player.withdrawReason
    ? `<div class="info-item withdraw-info">
      <span class="info-label"><i class="fas fa-comment-dots mr-1"></i> Motivo:</span>
      <span class="info-value">${escapeHtml(player.withdrawReason)}</span>
    </div>`
    : '';

  const withdrawnAtHtml = player.withdrawnAt
    ? `<div class="info-item withdraw-info">
      <span class="info-label"><i class="far fa-clock mr-1"></i> Quando:</span>
      <span class="info-value">${escapeHtml(new Date(player.withdrawnAt).toLocaleString('pt-BR'))}</span>
    </div>`
    : '';

  return `
    <div class="info-item withdraw-info">
      <span class="info-label"><i class="fas fa-exclamation-triangle mr-1"></i> Status:</span>
      <span class="info-value withdrew">Desistiu da partida</span>
    </div>
    ${reasonHtml}
    ${withdrawnAtHtml}
  `;
}

export function buildPlayerItemHtml({
  player,
  isAdmin,
  playerPhone,
  finalFee,
  teamLabel,
  playerTeam,
  hasTeams,
  teamOptionsHtml,
  hasDrawLocked,
  scratchEnabled,
}) {
  const isWithdrawn = player.status === 'withdrew';
  const safeUsername = escapeHtml(player.username);
  const paymentStatus = buildPaymentStatusHtml(player);
  const detailsButton = buildDetailsButtonHtml({ isAdmin, username: player.username });
  const whatsappButton = buildWhatsappButtonHtml({
    isAdmin,
    playerPhone,
    username: player.username,
  });
  const teamBadge = buildTeamBadgeHtml({
    hasTeams,
    isWithdrawn,
    teamLabel,
    playerTeam,
  });
  const teamControl = buildTeamControlHtml({
    isAdmin,
    hasTeams,
    isWithdrawn,
    teamLabel,
    username: player.username,
    teamOptionsHtml,
  });
  const withdrawInfo = buildWithdrawInfoHtml(player);
  const statusBadgeHtml = isWithdrawn
    ? '<span class="player-status-badge withdrew" title="Jogador desistiu"><i class="fas fa-user-minus mr-1"></i>Desistiu</span>'
    : '';
  const receiptStatusHtml = player.receiptSent
    ? '<span class="receipt-status" title="Comprovante de pagamento enviado"><i class="fas fa-file-invoice-dollar"></i></span>'
    : '';
  const positionBadgeHtml = player.drawType === 'goleiro'
    ? '<span class="player-position-badge goalkeeper" title="Goleiro"><span class="position-icon">🧤</span>Goleiro</span>'
    : '';
  const paidValueHtml = isWithdrawn
    ? ''
    : formatCurrencyBRL(finalFee);
  const paymentInfoText = player.paid ? 'Pago' : 'Não Pago';
  const receiptInfoText = player.receiptSent
    ? 'Enviado'
    : 'Não Enviado';
  const releaseDrawButton =
    isAdmin && scratchEnabled && hasDrawLocked && !isWithdrawn
      ? `<div class="info-item"><button class="btn btn-secondary btn-release-draw" data-username="${safeUsername}" title="Liberar novo sorteio para este jogador"><i class="fas fa-undo-alt mr-1"></i> Liberar Sorteio</button></div>`
      : '';
  const removeButton = isAdmin
    ? `<div class="info-item"><button class="btn btn-danger btn-remove-player" data-username="${safeUsername}" title="Remover jogador"><i class="fas fa-user-times"></i> Remover Jogador</button></div>`
    : '';

  return `
    <div class="player-info">
      <span class="player-name${isWithdrawn ? ' withdrawn-name' : ''}">${safeUsername}</span>
      ${positionBadgeHtml}
      ${statusBadgeHtml}
      ${teamBadge}
      ${receiptStatusHtml}
    </div>
    <div class="player-item-right">
      <strong class="final-fee">${paidValueHtml}</strong>
      ${isWithdrawn ? '' : paymentStatus}
      ${detailsButton}
    </div>
    <div class="player-details" id="details-${safeUsername}" style="display: none;">
      <div class="details-content">
        <h4>Gerenciar Jogador: ${safeUsername}</h4>
        <div class="payment-info">
          ${withdrawInfo}
          <div class="info-item">
            <span class="info-label">Status Pagamento:</span>
            <span class="info-value ${player.paid ? 'paid' : 'unpaid'}">${paymentInfoText}</span>
            ${isAdmin ? `<button class="admin-icon payment-icon" data-username="${safeUsername}" data-type="payment" title="Alterar status do pagamento"><i class="fas fa-coins text-accent"></i></button>` : ''}
          </div>
          <div class="info-item">
            <span class="info-label">Comprovante Pix:</span>
            <span class="info-value ${player.receiptSent ? 'sent' : 'not-sent'}">${receiptInfoText}</span>
            ${isAdmin ? `<button class="admin-icon receipt-icon" data-username="${safeUsername}" data-type="receipt" title="Alterar status do comprovante"><i class="fas fa-receipt text-accent"></i></button>` : ''}
          </div>
          ${teamControl}
          ${whatsappButton}
          ${releaseDrawButton}
          ${removeButton}
        </div>
      </div>
    </div>
  `;
}
