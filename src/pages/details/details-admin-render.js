import { normalizeHexColor } from '../../utils/color.js';
import { escapeHtml } from '../../utils/sanitize.js';

function createAdminButtonElement(text, className, onClick) {
  const button = document.createElement('button');
  button.className = `btn ${className}`;
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}

export function createAdminPlayerManager({ hasTeams, teamOptionsHtml, onAddPlayer }) {
  const playerManager = document.createElement('div');
  playerManager.className = 'admin-player-management';
  const teamSelectHtml = hasTeams
    ? `
      <select id="new-player-team" class="admin-input">
        ${teamOptionsHtml}
      </select>`
    : '';

  playerManager.innerHTML = `
    <h4>Gerenciar Jogadores</h4>
    <div class="add-player-section">
      <input type="text" id="new-player-name" class="admin-input" placeholder="Nome do jogador">
      ${teamSelectHtml}
      <button type="button" class="btn btn-primary" id="add-player-btn">Adicionar Jogador</button>
    </div>`;

  playerManager
    .querySelector('#add-player-btn')
    ?.addEventListener('click', onAddPlayer);

  return playerManager;
}

export function createAdminTeamManager({ teams = [], onEditTeams }) {
  const teamManager = document.createElement('div');
  teamManager.className = 'admin-team-management';
  const teamListHtml = teams.length > 0
    ? teams.map((team) => {
      const color = normalizeHexColor(team.color, '#3b82f6');
      return `<span class="admin-team-pill" style="border-color:${color};">${escapeHtml(team.name)}</span>`;
    }).join('')
    : '<span class="admin-empty-text">Nenhum time cadastrado.</span>';

  teamManager.innerHTML = `
    <h4>Times da Partida</h4>
    <div class="admin-team-list">
      ${teamListHtml}
    </div>
    <button type="button" class="btn btn-secondary" id="edit-teams-btn">Editar Times</button>`;

  teamManager
    .querySelector('#edit-teams-btn')
    ?.addEventListener('click', onEditTeams);

  return teamManager;
}

export function appendAdminStatusControls(container, { match, onProcessVotes, onStatusChange }) {
  if (match.status === 'ENCERRADA' && !match.results_processed) {
    container.appendChild(
      createAdminButtonElement('Apurar Votos e Finalizar', 'btn-confirm', onProcessVotes),
    );
  }

  if (match.status !== 'CONFIRMADA' && match.status !== 'ENCERRADA') {
    container.appendChild(
      createAdminButtonElement('Confirmar Partida', 'btn-confirm', () => onStatusChange('CONFIRMADA')),
    );
  }

  if (match.status !== 'CANCELADA' && match.status !== 'ENCERRADA') {
    container.appendChild(
      createAdminButtonElement('Cancelar Partida', 'btn-cancel', () => onStatusChange('CANCELADA')),
    );
  }

  if (match.status !== 'ENCERRADA') {
    container.appendChild(
      createAdminButtonElement('Encerrar Partida', 'btn-secondary', () => onStatusChange('ENCERRADA')),
    );
  }

  if (['CONFIRMADA', 'CANCELADA', 'ENCERRADA'].includes(match.status)) {
    container.appendChild(
      createAdminButtonElement('Reagendar', 'btn-reschedule', () => onStatusChange('AGENDADA')),
    );
  }
}
