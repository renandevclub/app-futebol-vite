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

    const unlockedCount = achievements.filter(a => a.isUnlocked).length;
    const percent = Math.round((unlockedCount / achievements.length) * 100);

    // Barra de progresso premium
    const progressContainer = document.createElement('div');
    progressContainer.className = 'achievements-progress-container';
    progressContainer.innerHTML = `
      <div class="achievements-progress-info">
        <span class="achievements-progress-text">${unlockedCount} de ${achievements.length} conquistas liberadas</span>
        <span class="achievements-progress-percent">${percent}%</span>
      </div>
      <div class="achievements-progress-bar-bg">
        <div class="achievements-progress-bar-fill" style="width: ${percent}%"></div>
      </div>
    `;
    container.appendChild(progressContainer);

    const grid = document.createElement('div');
    grid.className = 'achievements-grid';

    achievements.forEach((ach, i) => {
      const card = document.createElement('div');
      card.className = `achievement-card ${ach.isUnlocked ? 'unlocked' : 'locked'}`;
      card.style.animation = `achievementFadeIn 0.4s ease ${i * 0.06}s both`;

      card.innerHTML = `
        <div class="achievement-icon-wrapper ${ach.isUnlocked ? 'is-unlocked' : 'is-locked'}">
          <span class="achievement-emoji">${ach.icon}</span>
          ${ach.isUnlocked ? '' : '<span class="achievement-lock-badge"><i class="fas fa-lock"></i></span>'}
        </div>
        <div class="achievement-content">
          <p class="achievement-title">${ach.title}</p>
          <p class="achievement-desc">${ach.desc}</p>
        </div>
      `;

      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  window.FMAchievements = {
    calculateAchievements,
    renderAchievements,
    ACHIEVEMENTS
  };
})();

// A estilização agora está centralizada no profile.css para melhor performance e organização de design
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Achievements] Carregado. Estilos centralizados no profile.css.');
});
