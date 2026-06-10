import { getStoredUser, setEditMatchId, setSelectedMatchId } from '../../stores/session-store.js';
import { isAdminRole } from '../../shared/constants/roles.js';
import { initDB, getSupabaseClient } from '../../services/supabase.service.js';
import { getAllMatches, deleteMatch } from '../../services/match.service.js';
import { getPlayerPaymentStatus } from '../../services/payment.service.js';
import { getConfig } from '../../services/config.service.js';
import {
  buildStandingsTableHtml,
  renderStandingsCompetitionOptions,
} from '../../components/ui/standings-render.js';
import {
  getStandingsByMatch,
  getStandingsCompetitions,
} from '../../services/live-score.service.js';
import {
  buildDashboardEmptyMatchesHtml,
  buildDashboardMatchCardHtml,
  formatDashboardMatchDate,
  getDashboardMatchDateTime,
} from '../../modules/dashboard/dashboard-render.js';

document.addEventListener("DOMContentLoaded", async () => {
  await initDB();

  const currentUser = getStoredUser();
  const currentUserPaymentStatus = currentUser
    ? await getPlayerPaymentStatus(currentUser.id).catch((error) => {
        console.warn('Não foi possível obter status de pagamento do jogador:', error);
        return null;
      })
    : null;
  const adminActionsDiv = document.getElementById("admin-actions");
  const adminActivityPanel = document.getElementById("admin-activity-panel");
  let lastLogTimestamp = null;

  if (currentUser && isAdminRole(currentUser.role)) {
    if (adminActionsDiv) adminActionsDiv.style.display = "flex";
  }

  const matchListDiv = document.getElementById("match-list");
  let countdownIntervals = [];

  async function renderMatches() {
    console.log('Rendering matches...');
    countdownIntervals.forEach(clearInterval);
    countdownIntervals = [];
    matchListDiv.innerHTML = "";
    try {
      const matches = await getAllMatches();
      console.log('Matches fetched:', matches);
      if (matches.length === 0) {
        matchListDiv.innerHTML = buildDashboardEmptyMatchesHtml();
        return;
      }
      matches.sort(
        (a, b) =>
          new Date(a.date + "T" + a.time) - new Date(b.date + "T" + b.time),
      );
      for (const match of matches) {
        const card = document.createElement("div");
        card.className = "match-card card";
        card.setAttribute("data-animate", "");
        card.classList.add(`status-${match.status.toLowerCase()}`);

        const matchDateTime = getDashboardMatchDateTime(match);
        const formattedDate = formatDashboardMatchDate(matchDateTime);
        const matchDateTimestamp = matchDateTime.getTime();

        card.innerHTML = buildDashboardMatchCardHtml({
          match,
          formattedDate,
          matchDateTime,
          isAdmin: currentUser && isAdminRole(currentUser.role),
          showPaymentButton: currentUserPaymentStatus?.confirmed && match.status !== "ENCERRADA",
        });

        matchListDiv.appendChild(card);

        if (match.status === "ENCERRADA") {
          const accordionHeader = card.querySelector(".match-accordion-header");
          if (accordionHeader) {
            accordionHeader.addEventListener("click", () => {
              card.classList.toggle("is-open");
            });
          }
        }

        if (matchDateTimestamp > Date.now() && match.status !== "CANCELADA") {
          startCountdown(match.id, matchDateTimestamp);
        }

        card.querySelector(".details-button").addEventListener("click", () => {
          setSelectedMatchId(match.id);
          window.location.href = "details.html";
        });

        const deleteButton = card.querySelector(".delete-button");
        if (deleteButton) {
          deleteButton.addEventListener("click", async (event) => {
            event.stopPropagation();
            const confirmed = await FMModal.confirm({
              type: "admin",
              title: "Excluir partida",
              message: `Tem certeza que deseja excluir a partida em "${match.location}"?`,
              confirmLabel: "Excluir",
              danger: true,
              priority: 80,
            });
            if (confirmed) {
              await deleteMatch(match.id);
              renderMatches();
            }
          });
        }

        const editButton = card.querySelector(".edit-button");
        if (editButton) {
          editButton.addEventListener("click", (event) => {
            event.stopPropagation();
            setEditMatchId(match.id);
            window.location.href = "schedule.html"; // Redireciona para a página de agendamento para edição
          });
        }

        const whatsappButton = card.querySelector(".whatsapp-button");
        if (whatsappButton) {
          whatsappButton.addEventListener("click", async (event) => {
            event.stopPropagation();
            const adminPhoneNumber = await getConfig("admin_whatsapp");
            if (adminPhoneNumber) {
              const message = `Olá Administrador! Gostaria de falar sobre a partida em ${match.location} no dia ${formattedDate} às ${match.time}h.`;
              const whatsappUrl = `https://api.whatsapp.com/send?phone=${adminPhoneNumber}&text=${encodeURIComponent(message)}`;
              window.open(whatsappUrl, "_blank");
            } else {
              FMModal.warning(
                "Numero do administrador nao configurado. Por favor, configure nas opcoes.",
              );
            }
          });
        }

        const paymentButton = card.querySelector('.payment-button');
        if (paymentButton) {
          paymentButton.addEventListener('click', (event) => {
            event.stopPropagation();
            window.location.href = 'payment.html';
          });
        }

        // Event listener para o ícone de localização
        const locationIcon = card.querySelector(".location-icon");
        if (locationIcon) {
          locationIcon.addEventListener("click", (event) => {
            event.stopPropagation();
            const locationUrl = locationIcon.getAttribute("data-location-url");
            if (locationUrl) {
              window.open(locationUrl, "_blank");
            }
          });
        }
      }
      
      // Reinicializa as animações para os cards que acabaram de ser inseridos
      if (window.FMAnimations && typeof window.FMAnimations.initScrollReveal === 'function') {
        window.FMAnimations.initScrollReveal();
      }
      
    } catch (error) {
      console.error("Erro ao renderizar partidas:", error);
      matchListDiv.innerHTML =
        "<p>Ocorreu um erro ao carregar as partidas.</p>";
    }
  }

  function startCountdown(matchId, matchDateTime) {
    const countdownGrid = document.getElementById(`countdown-${matchId}`);
    const countdownSection = document.getElementById(`countdown-section-${matchId}`);
    if (!countdownGrid) return;
    const oneDayMs = 24 * 60 * 60 * 1000;

    const daysEl = countdownGrid.querySelector('[data-unit="days"]');
    const hoursEl = countdownGrid.querySelector('[data-unit="hours"]');
    const minutesEl = countdownGrid.querySelector('[data-unit="minutes"]');
    const secondsEl = countdownGrid.querySelector('[data-unit="seconds"]');

    const update = () => {
      const now = new Date().getTime();
      const distance = matchDateTime - now;

      if (distance < 0) {
        if (daysEl) daysEl.textContent = '00';
        if (hoursEl) hoursEl.textContent = '00';
        if (minutesEl) minutesEl.textContent = '00';
        if (secondsEl) secondsEl.textContent = '00';
        if (countdownSection) {
          const headerLabel = countdownSection.querySelector('.countdown-header-label');
          const headerIcon = countdownSection.querySelector('.countdown-header-icon');
          if (headerLabel) headerLabel.textContent = '⚽ Partida em andamento!';
          if (headerIcon) {
            headerIcon.className = 'fas fa-futbol countdown-header-icon';
          }
          countdownSection.classList.add('countdown-live');
          countdownSection.classList.remove('countdown-urgent');
        }
        return;
      }

      const days = Math.floor(distance / oneDayMs);
      const hours = Math.floor((distance % oneDayMs) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
      if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
      if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
      if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');

      if (distance < oneDayMs && countdownSection) {
        countdownSection.classList.add('countdown-urgent');
        const headerLabel = countdownSection.querySelector('.countdown-header-label');
        const headerIcon = countdownSection.querySelector('.countdown-header-icon');
        if (headerLabel) headerLabel.textContent = 'Faltam poucas horas!';
        if (headerIcon) headerIcon.className = 'fas fa-fire-alt countdown-header-icon';
      }
    };

    update();
    const interval = setInterval(update, 1000);
    countdownIntervals.push(interval);
  }

  // === CLASSIFICAÇÃO (STANDINGS) ===
  const standingsSelect = document.getElementById('dash-standings-select');
  const standingsContainer = document.getElementById('dash-standings-container');

  async function carregarCompeticoesStandings() {
    if (!standingsSelect) return;

    const client = getSupabaseClient();
    if (!client) {
      standingsSelect.innerHTML = '<option value="">&mdash; Indispon&iacute;vel &mdash;</option>';
      return;
    }

    const { data: competitions, error } = await getStandingsCompetitions(client);

    if (error) {
      renderStandingsCompetitionOptions(standingsSelect, []);
      return;
    }

    renderStandingsCompetitionOptions(standingsSelect, competitions);
  }

  async function carregarStandings(matchId) {
    if (!standingsContainer) return;

    const client = getSupabaseClient();
    if (!client) {
      standingsContainer.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px 0;font-size:0.85rem">Serviço indisponível no momento.</p>';
      return;
    }

    const { data, error } = await getStandingsByMatch(matchId, client);

    if (error) {
      console.error('Erro ao carregar classificação:', error);
      standingsContainer.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px 0;font-size:0.85rem">Erro ao carregar classificação.</p>';
      return;
    }

    if (!data || data.length === 0) {
      standingsContainer.innerHTML = `
        <div class="dash-standings-empty">
          <i class="fas fa-trophy"></i>
          Nenhuma classificação disponível para esta competição.
        </div>`;
      return;
    }

    renderStandingsTable(data);
  }

  function renderStandingsTable(standings) {
    if (!standingsContainer) return;

    standingsContainer.innerHTML = buildStandingsTableHtml(standings, {
      wrapperClass: 'dash-standings-table-wrap',
      tableClass: 'dash-standings-table',
      positionMode: 'badge',
    });
  }

  // Inicializa o select de competições e listener
  if (standingsSelect) {
    carregarCompeticoesStandings();

    standingsSelect.addEventListener('change', () => {
      const selectedId = standingsSelect.value;
      if (selectedId) {
        carregarStandings(selectedId);
      } else {
        standingsContainer.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px 0;font-size:0.85rem">Selecione uma competição para ver a classificação.</p>';
      }
    });
  }

  renderMatches();
});
