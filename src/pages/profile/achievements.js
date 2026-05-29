/**
 * Achievements & Gamification — Futebol Milhão
 * Sistema de conquistas, ranking e gamificação.
 */
(function () {
  const ACHIEVEMENTS = [
    {
      id: 'first_match',
      icon: '⚽',
      title: 'Estreia',
      desc: 'Participou da sua primeira partida',
      unlocked: (data) => data.totalMatches >= 1
    },
    {
      id: 'five_matches',
      icon: '🔥',
      title: 'Embalado',
      desc: 'Participou de 5 partidas',
      unlocked: (data) => data.totalMatches >= 5
    },
    {
      id: 'ten_matches',
      icon: '💪',
      title: 'Veterano',
      desc: 'Participou de 10 partidas',
      unlocked: (data) => data.totalMatches >= 10
    },
    {
      id: 'first_goal',
      icon: '🥅',
      title: 'Artilheiro',
      desc: 'Marcou seu primeiro gol',
      unlocked: (data) => data.totalGoals >= 1
    },
    {
      id: 'five_goals',
      icon: '⚡',
      title: 'Goleador',
      desc: 'Marcou 5 gols',
      unlocked: (data) => data.totalGoals >= 5
    },
    {
      id: 'perfect_payment',
      icon: '💎',
      title: 'Craque Financeiro',
      desc: '100% dos pagamentos em dia',
      unlocked: (data) => data.paymentRate >= 100
    },
    {
      id: 'mvp',
      icon: '👑',
      title: 'Craque da Rodada',
      desc: 'Eleito melhor jogador da partida',
      unlocked: (data) => data.bestPlayerWins >= 1
    }
  ];

  function calculateAchievements(data) {
    return ACHIEVEMENTS.map((ach) => ({
      ...ach,
      isUnlocked: ach.unlocked(data)
    }));
  }

  function renderAchievements(achievements, container) {
    if (!container) return;

    container.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'achievements-grid';

    achievements.forEach((ach, i) => {
      const card = document.createElement('div');
      card.className = `achievement-card ${ach.isUnlocked ? 'unlocked' : 'locked'}`;
      card.setAttribute('data-animate', '');
      card.style.animationDelay = `${i * 0.05}s`;

      card.innerHTML = `
        <div class="achievement-icon">${ach.isUnlocked ? ach.icon : '🔒'}</div>
        <div class="achievement-info">
          <p class="achievement-title">${ach.title}</p>
          <p class="achievement-desc">${ach.desc}</p>
        </div>
        ${ach.isUnlocked ? '<span class="achievement-badge">✓</span>' : ''}
      `;

      grid.appendChild(card);
    });

    container.appendChild(grid);

    const unlockedCount = achievements.filter(a => a.isUnlocked).length;
    const summary = document.createElement('div');
    summary.className = 'achievements-summary';
    summary.textContent = `${unlockedCount}/${achievements.length} conquistas`;
    container.insertBefore(summary, container.firstChild);
  }

  window.FMAchievements = {
    calculateAchievements,
    renderAchievements,
    ACHIEVEMENTS
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    .achievements-summary {
      font-size: 0.8rem;
      color: var(--text-secondary);
      font-weight: 600;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .achievements-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 10px;
    }
    .achievement-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.2s var(--ease-out-expo);
    }
    .achievement-card.unlocked {
      border-color: rgba(16, 185, 129, 0.25);
      background: rgba(16, 185, 129, 0.06);
    }
    .achievement-card.locked {
      opacity: 0.5;
      filter: grayscale(0.6);
    }
    .achievement-icon {
      font-size: 1.6rem;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-sm);
      background: rgba(255,255,255,0.05);
      flex-shrink: 0;
    }
    .achievement-info { flex: 1; min-width: 0; }
    .achievement-title {
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--text-main);
      margin: 0;
    }
    .achievement-desc {
      font-size: 0.7rem;
      color: var(--text-muted);
      margin: 2px 0 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .achievement-badge {
      font-size: 1rem;
      color: var(--accent-green);
      flex-shrink: 0;
    }
    @media (max-width: 480px) {
      .achievements-grid {
        grid-template-columns: 1fr 1fr;
      }
    }
  `;
  document.head.appendChild(style);
});
