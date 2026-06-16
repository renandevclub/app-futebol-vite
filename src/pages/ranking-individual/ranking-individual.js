/**
 * Página de Ranking Individual
 * 
 * Exibe pontuação de todos os jogadores com:
 * - Tabela principal de ranking
 * - Busca por jogador
 * - Estatísticas agregadas
 * - Posição do usuário logado
 */

import { getStoredUser } from '../../stores/session-store.js';
import { initDB, getSupabaseClient } from '../../services/supabase.service.js';
import {
  getIndividualRanking,
  getTopPlayers,
  getPlayerRankingStats,
  searchRankingByPlayer,
  getRankingStats,
  subscribeToRankingUpdates,
} from '../../services/ranking.service.js';
import { formatDateBR } from '../../utils/date.js';

let currentUser = null;
let currentFilter = 'all';
let allRankingData = [];
let subscription = null;

// DOM Elements
const rankingTbody = document.getElementById('ranking-tbody');
const rankingLoading = document.getElementById('ranking-loading');
const rankingEmpty = document.getElementById('ranking-empty');
const rankingSearch = document.getElementById('ranking-search');
const filterButtons = document.querySelectorAll('.filter-btn');
const myPositionSection = document.getElementById('my-position-section');
const myPositionCard = document.getElementById('my-position-card');
const btnLogout = document.getElementById('btn-logout');

// Stats Elements
const statTotalPlayers = document.getElementById('stat-total-players');
const statHighestScore = document.getElementById('stat-highest-score');
const statAvgScore = document.getElementById('stat-avg-score');
const statTotalGols = document.getElementById('stat-total-gols');

document.addEventListener('DOMContentLoaded', async () => {
  await initDB();

  currentUser = getStoredUser();

  // Logout handler
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      const client = getSupabaseClient();
      if (client) {
        await client.auth.signOut();
        window.location.href = 'index.html';
      }
    });
  }

  // Filtros
  filterButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      filterButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      await renderRanking();
    });
  });

  // Search
  if (rankingSearch) {
    rankingSearch.addEventListener('input', async (e) => {
      const term = e.target.value.trim();
      if (term.length > 0) {
        const results = await searchRankingByPlayer(term);
        renderRankingTable(results);
      } else {
        await renderRanking();
      }
    });
  }

  // Mostrar opção "Minha Posição" se logado
  if (currentUser) {
    const myPositionBtn = document.querySelector('[data-filter="my-position"]');
    if (myPositionBtn) {
      myPositionBtn.style.display = '';
    }
  }

  // Carregar dados
  await loadRanking();

  // Subscribe to real-time updates
  subscription = subscribeToRankingUpdates((payload) => {
    console.log('Ranking atualizado:', payload);
    loadRanking();
  });
});

async function loadRanking() {
  rankingLoading.style.display = 'flex';
  rankingTbody.innerHTML = '';
  rankingEmpty.style.display = 'none';

  try {
    allRankingData = await getIndividualRanking();

    // Load stats
    const stats = await getRankingStats();
    if (stats) {
      statTotalPlayers.textContent = stats.totalPlayers;
      statHighestScore.textContent = stats.highestScore;
      statAvgScore.textContent = stats.avgScore;
      statTotalGols.textContent = stats.totalGols;
    }

    // Se logado, buscar posição do usuário
    if (currentUser) {
      const userStats = await getPlayerRankingStats(currentUser.username);
      if (userStats) {
        renderMyPosition(userStats);
      }
    }

    await renderRanking();
  } catch (error) {
    console.error('Erro ao carregar ranking:', error);
    rankingEmpty.style.display = 'flex';
  } finally {
    rankingLoading.style.display = 'none';
  }
}

async function renderRanking() {
  let dataToRender = allRankingData;

  if (currentFilter === 'top10') {
    dataToRender = allRankingData.slice(0, 10);
  } else if (currentFilter === 'my-position' && currentUser) {
    // Busca o usuário e vizinhos
    const userIndex = allRankingData.findIndex(
      (p) => p.username.toLowerCase() === currentUser.username.toLowerCase()
    );
    if (userIndex >= 0) {
      const start = Math.max(0, userIndex - 2);
      const end = Math.min(allRankingData.length, userIndex + 3);
      dataToRender = allRankingData.slice(start, end);
    }
  }

  if (dataToRender.length === 0) {
    rankingEmpty.style.display = 'flex';
    rankingTbody.innerHTML = '';
  } else {
    rankingEmpty.style.display = 'none';
    renderRankingTable(dataToRender);
  }
}

function renderRankingTable(data) {
  rankingTbody.innerHTML = data
    .map((player, index) => {
      const isCurrentUser =
        currentUser &&
        player.username.toLowerCase() === currentUser.username.toLowerCase();

      const positionBadge = getPositionBadge(player.rank_position);
      const avatarHTML = getAvatarHTML(player);

      return `
        <tr class="ranking-row ${isCurrentUser ? 'current-user' : ''}" data-username="${player.username}">
          <td class="col-position">
            <div class="position-badge ${positionBadge.class}">
              ${positionBadge.icon}
              <span class="position-number">${player.rank_position || index + 1}</span>
            </div>
          </td>
          <td class="col-player">
            <div class="player-info">
              <div class="player-avatar">
                ${avatarHTML}
              </div>
              <div class="player-details">
                <div class="player-name">${escapeHtml(player.full_name || player.username)}</div>
                <div class="player-username">@${escapeHtml(player.username)}</div>
              </div>
            </div>
          </td>
          <td class="col-stats">
            <div class="stats-badges">
              <span class="stat-badge craque" title="Votos como Craque">
                ${player.craque_count || 0}
              </span>
              <span class="stat-badge gol" title="Gols Marcados">
                ${player.gols_count || 0}
              </span>
              <span class="stat-badge partida" title="Partidas Jogadas">
                ${player.partidas_jogadas || 0}
              </span>
              <span class="stat-badge pau" title="Votos como Perna de Pau">
                ${player.perna_pau_count || 0}
              </span>
            </div>
          </td>
          <td class="col-points">
            <div class="points-display ${player.total_points >= 0 ? 'positive' : 'negative'}">
              <span class="points-value">${player.total_points}</span>
              <span class="points-label">pts</span>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function renderMyPosition(userStats) {
  myPositionSection.style.display = 'block';

  const positionBadge = getPositionBadge(userStats.rank_position);
  const avatarHTML = getAvatarHTML(userStats);

  myPositionCard.innerHTML = `
    <div class="position-card-content">
      <div class="position-badge-large ${positionBadge.class}">
        ${positionBadge.icon}
        <span class="position-number">${userStats.rank_position}</span>
      </div>
      <div class="position-info">
        <h3>${escapeHtml(userStats.full_name || userStats.username)}</h3>
        <p class="username">@${escapeHtml(userStats.username)}</p>
        <div class="position-score">
          <span class="score-value">${userStats.total_points}</span>
          <span class="score-label">pontos totais</span>
        </div>
        <div class="position-stats-grid">
          <div class="position-stat">
            <span class="stat-value">${userStats.craque_count || 0}</span>
            <span class="stat-label">Craque</span>
          </div>
          <div class="position-stat">
            <span class="stat-value">${userStats.gols_count || 0}</span>
            <span class="stat-label">Gols</span>
          </div>
          <div class="position-stat">
            <span class="stat-value">${userStats.partidas_jogadas || 0}</span>
            <span class="stat-label">Partidas</span>
          </div>
          <div class="position-stat">
            <span class="stat-value">${userStats.perna_pau_count || 0}</span>
            <span class="stat-label">Perna de Pau</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getPositionBadge(position) {
  if (position === 1) {
    return { icon: '🥇', class: 'gold' };
  } else if (position === 2) {
    return { icon: '🥈', class: 'silver' };
  } else if (position === 3) {
    return { icon: '🥉', class: 'bronze' };
  } else if (position <= 10) {
    return { icon: '⭐', class: 'star' };
  } else {
    return { icon: '•', class: 'default' };
  }
}

function getAvatarHTML(player) {
  if (player.avatar_url) {
    return `<img src="${escapeHtml(player.avatar_url)}" alt="${escapeHtml(player.username)}" class="avatar-img" />`;
  } else {
    const initials = (player.full_name || player.username)
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    return `<div class="avatar-initials">${initials}</div>`;
  }
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (subscription) {
    subscription();
  }
});

export { loadRanking, renderRanking };
