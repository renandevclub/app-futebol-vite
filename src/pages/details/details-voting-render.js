import { isVisitorRole } from '../../shared/constants/roles.js';
import { normalizeTeamKey } from '../../services/match.service.js';
import { escapeHtml } from '../../utils/sanitize.js';

export function findVoteWinner(votes = []) {
  if (!Array.isArray(votes) || votes.length === 0) return null;

  const voteCounts = votes.reduce((acc, vote) => {
    acc[vote.candidate] = (acc[vote.candidate] || 0) + 1;
    return acc;
  }, {});
  const sortedVotes = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);

  return sortedVotes.length > 0
    ? { name: sortedVotes[0][0], count: sortedVotes[0][1] }
    : null;
}

export function buildVoteWinnerHtml(winner, type) {
  if (!winner) return '<p class="no-votes">Nenhum voto registrado.</p>';

  const className = type === 'best' ? 'best-winner' : 'worst-winner';
  const icon = type === 'best' ? '&#11088;' : '&#129717;';

  return `
    <div class="vote-winner ${className}">
      <div class="winner-icon">${icon}</div>
      <div class="winner-info">
        <div class="winner-name">${escapeHtml(winner.name)}</div>
        <div class="winner-count">${winner.count} voto(s)</div>
      </div>
    </div>`;
}

export function buildVoteProgressHtml({
  totalVoters,
  uniqueVoters,
  userHasVoted,
  variant = 'best',
}) {
  const percent = totalVoters > 0 ? (uniqueVoters / totalVoters) * 100 : 0;
  const fillClass = variant === 'worst' ? ' worst' : '';
  const confirmedHtml = userHasVoted
    ? '<div class="vote-confirmed-badge">&#9989; Seu voto foi registrado</div>'
    : '';

  return `
    <div class="vote-progress-bar">
      <div class="vote-progress-fill${fillClass}" style="width: ${percent}%;"></div>
      <span class="vote-progress-text">${uniqueVoters}/${totalVoters} votaram</span>
    </div>
    ${confirmedHtml}`;
}

export function buildVisitorVotingMessageHtml() {
  return '<span style="color: #fbbf24; font-weight: 600;">&#128065;&#65039; Visitantes n&atilde;o podem votar. <a href="../pages/register.html" style="color: var(--accent-blue);">Cadastre-se</a> para participar!</span>';
}

export function buildVisitorVotingEmptyHtml() {
  return '<p class="no-votes" style="color: var(--text-muted);">Fa&ccedil;a login como jogador para votar.</p>';
}

export function createVoteCandidateElement({
  player,
  voteCount,
  category,
  userHasVoted,
  currentUser,
  currentMatch,
  onVote,
}) {
  const div = document.createElement('div');
  div.className = 'vote-candidate';

  const votes = currentMatch?.votes?.[category] || [];
  const username = player?.username || '';
  const currentUsername = currentUser?.username || '';
  const hasVotedForThis = votes.some(
    (vote) => vote.voter === currentUsername && vote.candidate === username,
  );
  const isSelf = normalizeTeamKey(username) === normalizeTeamKey(currentUsername);
  const isVisitor = isVisitorRole(currentUser?.role);
  const isDisabled = isVisitor || userHasVoted || isSelf || currentMatch?.results_processed;
  const totalVotes = votes.length;
  const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
  const barColor = category === 'best_player'
    ? 'var(--accent-green, #10b981)'
    : 'var(--accent-red, #ef4444)';

  let tooltipText = '';
  if (isSelf) tooltipText = 'Voc&ecirc; n&atilde;o pode votar em si mesmo';
  else if (isVisitor) tooltipText = 'Visitantes n&atilde;o podem votar';
  else if (userHasVoted) tooltipText = 'Voc&ecirc; j&aacute; votou nesta categoria';

  div.innerHTML = `
    <div class="vote-candidate-info">
      <span class="player-name${isSelf ? ' is-self' : ''}">${escapeHtml(username)}${isSelf ? ' <span class="self-tag">(voc&ecirc;)</span>' : ''}</span>
      <div class="vote-bar-container">
        <div class="vote-bar-fill" style="width: ${percentage}%; background: ${barColor};"></div>
      </div>
    </div>
    <div class="vote-candidate-actions">
      <span class="vote-count">${voteCount}</span>
      <button class="vote-button ${hasVotedForThis ? 'voted' : ''} ${isSelf ? 'self-disabled' : ''}"
              data-player-name="${escapeHtml(username)}"
              data-category="${escapeHtml(category)}"
              ${isDisabled ? 'disabled' : ''}
              ${tooltipText ? `title="${tooltipText}"` : ''}>
        ${hasVotedForThis ? '&#10004; Votado' : isSelf ? '&mdash;' : 'Votar'}
      </button>
    </div>`;

  const voteButton = div.querySelector('.vote-button');
  if (voteButton && !voteButton.disabled) {
    voteButton.addEventListener('click', onVote);
  }

  return div;
}
