import { normalizeHexColor } from '../../utils/color.js';
import { escapeHtml } from '../../utils/sanitize.js';

const TOTAL_SCRATCH_CARDS = 9;
const NEUTRAL_MESSAGES = [
  'Tente outro!',
  'Quase lá...',
  'Não foi dessa vez!',
  'Continue tentando!',
  'Tente de novo!',
  'Próxima será!',
];

export function buildExistingScratchResultHtml({ teams = [], selectedTeamName, getScratchColor }) {
  return `
    <div class="scratch-header">
      <h3 class="scratch-title">Sorteio de Times</h3>
      <p class="scratch-subtitle">Voc&ecirc; j&aacute; revelou seu time!</p>
    </div>
    <div class="scratch-cards-grid scratch-grid-result">
      ${teams.map((team) => {
        const isChosen = team.name === selectedTeamName;
        const color = getScratchColor(team.color);
        const teamColor = normalizeHexColor(team.color, '#10b981');

        return `
          <div class="scratch-card ${isChosen ? 'chosen revealed' : 'revealed not-chosen'}" style="--card-color: ${color.hex}; --card-rgb: ${color.rgb};">
            <div class="scratch-card-inner">
              <div class="scratch-card-content">
                <span class="scratch-team-dot" style="background: ${teamColor};"></span>
                <span class="scratch-team-name">${escapeHtml(team.name)}</span>
                ${isChosen ? '<span class="scratch-chosen-label">SEU TIME!</span>' : ''}
              </div>
            </div>
          </div>`;
      }).join('')}
    </div>
    <div class="scratch-result-banner">
      <span>Seu time: <strong>${escapeHtml(selectedTeamName)}</strong></span>
    </div>
    <p class="scratch-auto-confirm">Voc&ecirc; j&aacute; est&aacute; vinculado a este time.</p>
  `;
}

export function buildFourthTeamJoinHtml(fourthTeam) {
  const color = normalizeHexColor(fourthTeam?.color, '#10b981');

  return `
    <div class="scratch-header">
      <h3 class="scratch-title">Sorteio Encerrado</h3>
      <p class="scratch-subtitle">Os 3 primeiros times j&aacute; est&atilde;o completos (7 jogadores cada).<br>As novas vagas s&atilde;o para o <strong>${escapeHtml(fourthTeam?.name)}</strong>.</p>
    </div>
    <div style="text-align: center; margin: 25px 0;">
      <button class="btn btn-primary" id="btn-join-fourth-team" style="background: ${color}; border-color: ${color}; width: 100%; font-size: 1.1rem; padding: 14px;">
        Entrar no ${escapeHtml(fourthTeam?.name)}
      </button>
    </div>
  `;
}

export function createScratchSlots(drawTeams = [], getScratchColor) {
  const teamSlots = drawTeams.map((team) => ({
    type: 'team',
    team,
    color: getScratchColor(team.color),
  }));
  const neutralCount = Math.max(0, TOTAL_SCRATCH_CARDS - drawTeams.length);
  const usedColorValues = teamSlots.map((slot) => slot.color.hex);
  let neutralColorIdx = 0;
  const neutralSlots = [];

  for (let i = 0; i < neutralCount; i += 1) {
    const neutralColor = getScratchColor(neutralColorIdx);
    if (usedColorValues.includes(neutralColor.hex)) {
      neutralColorIdx += 1;
    }
    neutralSlots.push({
      type: 'neutral',
      team: null,
      color: getScratchColor(neutralColorIdx),
      message: NEUTRAL_MESSAGES[i % NEUTRAL_MESSAGES.length],
    });
    neutralColorIdx += 1;
  }

  return [...teamSlots, ...neutralSlots].sort(() => Math.random() - 0.5);
}

export function buildScratchCardsHtml({ drawTeams = [], slots = [], availableLinha = 18, availableGoleiro = 3, selectedType = 'linha' }) {
  const disableLinha = availableLinha === 0;
  const disableGoleiro = availableGoleiro === 0;

  return `
    <div class="scratch-header">
      <h3 class="scratch-title">Sorteio de Times</h3>
      <p class="scratch-subtitle">Escolha sua posi&ccedil;&atilde;o antes de sortear:</p>
      
      <div class="draw-type-selector" id="scratch-draw-type-selector">
        <button type="button" class="draw-type-btn ${selectedType === 'linha' ? 'active' : ''}" data-type="linha" ${disableLinha ? 'disabled' : ''}>
          <span class="draw-type-icon">⚽</span>
          <span class="draw-type-label">Jogador de Linha</span>
          <span class="draw-type-badge">${availableLinha} vaga${availableLinha !== 1 ? 's' : ''}</span>
        </button>
        <button type="button" class="draw-type-btn ${selectedType === 'goleiro' ? 'active' : ''}" data-type="goleiro" ${disableGoleiro ? 'disabled' : ''}>
          <span class="draw-type-icon">🧤</span>
          <span class="draw-type-label">Goleiro</span>
          <span class="draw-type-badge">${availableGoleiro} vaga${availableGoleiro !== 1 ? 's' : ''}</span>
        </button>
      </div>
    </div>
    <div class="scratch-cards-grid scratch-grid-9">
      ${slots.map((slot, index) => {
        const isTeam = slot.type === 'team';
        const teamId = isTeam ? slot.team.id : '';
        const teamName = isTeam ? slot.team.name : '';
        const neutralMsg = !isTeam ? slot.message : '';
        const teamColor = isTeam ? normalizeHexColor(slot.team.color, '#10b981') : '';

        return `
          <div class="scratch-card covered"
               data-type="${escapeHtml(slot.type)}"
               data-team-id="${escapeHtml(teamId)}"
               data-team-name="${escapeHtml(teamName)}"
               data-neutral-msg="${escapeHtml(neutralMsg)}"
               data-index="${index}"
               style="--card-color: ${slot.color.hex}; --card-rgb: ${slot.color.rgb};">
            <div class="scratch-card-inner">
              <div class="scratch-card-cover">
                <div class="scratch-shimmer"></div>
                <span class="scratch-question">?</span>
                <span class="scratch-hint">Raspe aqui</span>
              </div>
              <div class="scratch-card-content">
                ${isTeam
                  ? `<span class="scratch-team-dot" style="background: ${teamColor};"></span><span class="scratch-team-name">${escapeHtml(teamName)}</span>`
                  : `<span class="scratch-neutral-icon">&times;</span><span class="scratch-neutral-msg">${escapeHtml(neutralMsg)}</span>`}
              </div>
            </div>
          </div>`;
      }).join('')}
    </div>
    <div class="scratch-footer-hint">
      ${drawTeams.length} time${drawTeams.length > 1 ? 's' : ''} escondido${drawTeams.length > 1 ? 's' : ''} entre 9 cart&otilde;es &mdash; boa sorte!
    </div>
  `;
}

export function buildScratchTeamContentHtml(team) {
  const teamColor = normalizeHexColor(team?.color, '#10b981');

  return `
    <span class="scratch-team-dot" style="background: ${teamColor};"></span>
    <span class="scratch-team-name">${escapeHtml(team?.name)}</span>
  `;
}

export function buildScratchChosenContentHtml(teamName, color = '#10b981') {
  const teamColor = normalizeHexColor(color, '#10b981');

  return `
    <span class="scratch-team-dot" style="background: ${teamColor};"></span>
    <span class="scratch-team-name">${escapeHtml(teamName)}</span>
    <span class="scratch-chosen-label">SEU TIME!</span>
  `;
}

export function buildScratchResultBannerHtml(teamName) {
  return `
    <div class="scratch-result-banner animated">
      <span>Seu time: <strong>${escapeHtml(teamName)}</strong></span>
    </div>
  `;
}
