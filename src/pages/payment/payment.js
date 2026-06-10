import { initDB, getSupabaseClient, runSupabaseQuery } from '../../services/impl/supabase-client.impl.js';
import { getPaymentLinks, getPlayerPaymentStatus, updatePlayerPaymentStatusByUsername } from '../../services/payment.service.js';
import { getAllMatches, addMatch } from '../../services/match.service.js';
import { getConfig, saveConfig } from '../../services/config.service.js';
import { getStoredUser } from '../../stores/session-store.js';
import { isAdminRole } from '../../shared/constants/roles.js';

// Fallback, será sobrescrito pelo banco
let DEADLINE = new Date("2026-05-18T22:00:00-03:00");
let countdownInterval = null;

const alertEl = document.getElementById("payment-alert");
const countdownBox = document.querySelector(".countdown-box");
const daysEl = document.getElementById("countdown-days");
const hoursEl = document.getElementById("countdown-hours");
const minutesEl = document.getElementById("countdown-minutes");
const secondsEl = document.getElementById("countdown-seconds");
let btnEarly = document.getElementById("btn-pix-early");
let btnRegular = document.getElementById("btn-pix-regular");
let btnGoalkeeper = document.getElementById("btn-pix-goalkeeper");

// Elementos do Painel Administrativo
const adminTabsContainer = document.getElementById("admin-tabs");
const playerViewContainer = document.getElementById("player-view-container");
const adminViewContainer = document.getElementById("admin-view-container");

const formPixConfig = document.getElementById("form-pix-config");
const formMatchConfig = document.getElementById("form-match-config");
const playerSearchInput = document.getElementById("player-list-search");
const adminPlayerListContainer = document.getElementById("admin-player-list");

const adminInputEarly = document.getElementById("admin-input-early");
const adminInputRegular = document.getElementById("admin-input-regular");
const adminInputGoalkeeper = document.getElementById("admin-input-goalkeeper");
const adminInputDeadline = document.getElementById("admin-input-deadline");
const adminInputWhatsapp = document.getElementById("admin-input-whatsapp");
const adminInputEarlyText = document.getElementById("admin-input-early-text");
const adminInputRegularText = document.getElementById("admin-input-regular-text");
const adminInputGoalkeeperText = document.getElementById("admin-input-goalkeeper-text");

const adminMatchLocation = document.getElementById("admin-match-location");
const adminMatchDate = document.getElementById("admin-match-date");
const adminMatchTime = document.getElementById("admin-match-time");
const adminMatchFee = document.getElementById("admin-match-fee");

const adminStatConfirmed = document.getElementById("admin-stat-confirmed");
const adminStatPaid = document.getElementById("admin-stat-paid");
const adminStatPending = document.getElementById("admin-stat-pending");

let activeMatch = null;
let allPlayersList = []; // Cache dos jogadores confirmados para busca local

function pad(value) {
  return String(value).padStart(2, "0");
}

function setCountdown(days, hours, minutes, seconds) {
  if (daysEl) daysEl.textContent = pad(days);
  if (hoursEl) hoursEl.textContent = pad(hours);
  if (minutesEl) minutesEl.textContent = pad(minutes);
  if (secondsEl) secondsEl.textContent = pad(seconds);
}

function setExpiredState() {
  if (alertEl) {
    alertEl.textContent = "Prazo promocional encerrado";
    alertEl.classList.add("is-expired");
  }

  if (countdownBox) {
    countdownBox.classList.add("is-expired");
    const title = countdownBox.querySelector(".countdown-title");
    if (title) title.textContent = "Prazo do valor antecipado encerrado";
  }

  setCountdown(0, 0, 0, 0);

  if (btnEarly && !btnEarly.classList.contains("is-disabled")) {
    btnEarly.classList.add("is-disabled");
    btnEarly.removeAttribute("href");
    btnEarly.style.opacity = "0.4";
    btnEarly.style.pointerEvents = "none";
    const sub = btnEarly.querySelector("span:last-child");
    if (sub) sub.textContent = "Encerrado";
  }
}

function setMatchClosedState() {
  if (alertEl) {
    alertEl.textContent = "Pagamento indisponível — nenhuma partida agendada";
    alertEl.classList.add("is-expired");
  }

  if (countdownBox) {
    countdownBox.classList.add("is-expired");
    const title = countdownBox.querySelector(".countdown-title");
    if (title) title.textContent = "Sem partidas ativas no momento";
  }

  setCountdown(0, 0, 0, 0);

  setupPaymentButton(btnEarly, null);
  setupPaymentButton(btnRegular, null);
  setupPaymentButton(btnGoalkeeper, null);
}

function updateCountdown() {
  const now = new Date();
  const diff = DEADLINE.getTime() - now.getTime();

  if (diff <= 0) {
    setExpiredState();
    return;
  }

  if (alertEl) {
    alertEl.textContent = "Garanta desconto até o prazo!";
    alertEl.classList.remove("is-expired");
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  setCountdown(days, hours, minutes, seconds);
}

function setupPaymentButton(buttonSelectorOrEl, link) {
  let buttonEl = typeof buttonSelectorOrEl === 'string'
    ? document.querySelector(buttonSelectorOrEl)
    : buttonSelectorOrEl;

  if (!buttonEl) return;

  // Se o botão já foi removido do DOM (referência antiga), tenta buscar pelo ID atual
  if (buttonEl.id) {
    const currentEl = document.getElementById(buttonEl.id);
    if (currentEl) buttonEl = currentEl;
  }

  if (!buttonEl.parentNode) return;

  // Limpa event listeners anteriores clonando o botão
  const newButton = buttonEl.cloneNode(true);
  buttonEl.parentNode.replaceChild(newButton, buttonEl);

  // Atualiza referências globais
  if (newButton.id === "btn-pix-early") btnEarly = newButton;
  if (newButton.id === "btn-pix-regular") btnRegular = newButton;
  if (newButton.id === "btn-pix-goalkeeper") btnGoalkeeper = newButton;

  if (!link) {
    newButton.classList.add("is-disabled");
    newButton.removeAttribute("href");
    newButton.setAttribute("aria-disabled", "true");
    newButton.style.opacity = "0.5";
    newButton.style.pointerEvents = "none";
    const text = newButton.querySelector(".pix-button-text");
    if (text) text.textContent = "Indisponível";
    return;
  }

  newButton.classList.remove("is-disabled");
  newButton.style.opacity = "";
  newButton.style.pointerEvents = "";
  newButton.setAttribute("href", link);
  newButton.setAttribute("aria-disabled", "false");

  newButton.addEventListener("click", function (event) {
    event.preventDefault();
    
    const textEl = newButton.querySelector(".pix-button-text");
    const originalText = textEl ? textEl.textContent : "";
    
    newButton.classList.add("is-loading");
    newButton.setAttribute("aria-busy", "true");
    if (textEl) textEl.textContent = "Abrindo...";

    window.setTimeout(function () {
      newButton.classList.remove("is-loading");
      if (textEl) textEl.textContent = originalText;
      window.location.href = link;
    }, 450);
  });
}

function findActiveMatch(matches) {
  if (!matches || matches.length === 0) return null;

  const activeMatches = matches.filter(
    (m) => m.status === "AGENDADA" || m.status === "CONFIRMADA"
  );

  if (activeMatches.length === 0) return null;

  activeMatches.sort(
    (a, b) => new Date(a.date + "T" + a.time) - new Date(b.date + "T" + b.time)
  );

  return activeMatches[0];
}

function updateMatchInfo(match) {
  if (!match) return;

  const eventItems = document.querySelectorAll(".event-item");

  if (eventItems[0] && match.date && match.time) {
    const dateStrong = eventItems[0].querySelector("strong");
    if (dateStrong) {
      const [year, month, day] = match.date.split("-");
      const timeParts = match.time.split(":");
      const formattedDate = `${day}/${month}/${year} às ${timeParts[0]}h`;
      dateStrong.textContent = formattedDate;
    }
  }

  if (eventItems[1] && match.location) {
    const locationStrong = eventItems[1].querySelector("strong");
    if (locationStrong) {
      locationStrong.textContent = match.location;
    }
  }

  const feeValue = Number(match.playerFee || 0);
  if (feeValue > 0) {
    const priceRows = document.querySelectorAll(".price-row strong");
    if (priceRows[0]) {
      priceRows[0].textContent = `R$ ${feeValue.toFixed(2).replace(".", ",")}`;
    }
    const countdownTitle = document.querySelector(".countdown-title");
    if (countdownTitle) {
      countdownTitle.textContent = `Tempo para pagar R$ ${feeValue.toFixed(2).replace(".", ",")}`;
    }
  }
}

function updateDynamicContent(links) {
  // 1. Atualiza os textos dos botões Pix com os valores salvos no banco (ou fallbacks)
  const earlyText = links['payment_text_early_player'] || "Jogador — R$ 20,00";
  const regularText = links['payment_text_regular_player'] || "Jogador (Normal) — R$ 20,00";
  const goalkeeperText = links['payment_text_goalkeeper'] || "Goleiro — R$ 5,00";

  const earlyButtonText = document.querySelector("#btn-pix-early .pix-button-text");
  if (earlyButtonText) earlyButtonText.textContent = earlyText;

  const regularButtonText = document.querySelector("#btn-pix-regular .pix-button-text");
  if (regularButtonText) regularButtonText.textContent = regularText;

  const goalkeeperButtonText = document.querySelector("#btn-pix-goalkeeper .pix-button-text");
  if (goalkeeperButtonText) goalkeeperButtonText.textContent = goalkeeperText;

  // 2. Atualiza dinamicamente a data no chip do valor promocional ("até DD/MM")
  if (links['payment_early_enabled_until']) {
    const deadlineDate = new Date(links['payment_early_enabled_until']);
    const chip = document.querySelector(".price-row-featured .price-chip");
    if (chip && !isNaN(deadlineDate.getTime())) {
      const day = String(deadlineDate.getDate()).padStart(2, '0');
      const month = String(deadlineDate.getMonth() + 1).padStart(2, '0');
      chip.textContent = `até ${day}/${month}`;
    }
  }
}

// Funções do Painel Administrativo
function formatDateTimeLocal(dateInput) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

async function loadAdminPanelData() {
  try {
    const links = await getPaymentLinks();
    
    // Links Pix
    if (adminInputEarly) adminInputEarly.value = links['payment_link_early_player'] || "";
    if (adminInputEarlyText) adminInputEarlyText.value = links['payment_text_early_player'] || "";
    if (adminInputRegular) adminInputRegular.value = links['payment_link_regular_player'] || "";
    if (adminInputRegularText) adminInputRegularText.value = links['payment_text_regular_player'] || "";
    if (adminInputGoalkeeper) adminInputGoalkeeper.value = links['payment_link_goalkeeper'] || "";
    if (adminInputGoalkeeperText) adminInputGoalkeeperText.value = links['payment_text_goalkeeper'] || "";
    
    // Prazo Limite
    if (links['payment_early_enabled_until'] && adminInputDeadline) {
      adminInputDeadline.value = formatDateTimeLocal(links['payment_early_enabled_until']);
    }

    // Whatsapp do Admin
    const wpNumber = await getConfig('admin_whatsapp');
    if (adminInputWhatsapp) adminInputWhatsapp.value = wpNumber || "";

    // Partida Ativa
    if (activeMatch) {
      if (adminMatchLocation) adminMatchLocation.value = activeMatch.location || "";
      if (adminMatchDate) adminMatchDate.value = activeMatch.date || "";
      if (adminMatchTime) adminMatchTime.value = activeMatch.time ? activeMatch.time.substring(0, 5) : "";
      if (adminMatchFee) adminMatchFee.value = activeMatch.playerFee || 0;
      
      renderAdminPlayerList();
    }
  } catch (error) {
    console.error("Erro ao carregar dados do painel admin:", error);
    if (window.FMModal) {
      window.FMModal.error("Erro ao carregar informações de administração.");
    }
  }
}

function renderAdminPlayerList() {
  if (!activeMatch || !adminPlayerListContainer) return;

  // Filtrar apenas confirmados na partida ativa
  allPlayersList = activeMatch.players.filter(p => p.confirmed);

  // Estatísticas
  const total = allPlayersList.length;
  const paid = allPlayersList.filter(p => p.paid).length;
  const pending = total - paid;

  if (adminStatConfirmed) adminStatConfirmed.textContent = total;
  if (adminStatPaid) adminStatPaid.textContent = paid;
  if (adminStatPending) adminStatPending.textContent = pending;

  filterAndRenderPlayers(playerSearchInput ? playerSearchInput.value : "");
}

function filterAndRenderPlayers(searchTerm = "") {
  if (!adminPlayerListContainer) return;

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filtered = allPlayersList.filter(p => 
    (p.name || p.username || "").toLowerCase().includes(normalizedSearch)
  );

  if (filtered.length === 0) {
    adminPlayerListContainer.innerHTML = `<p class="admin-empty-text">Nenhum jogador encontrado.</p>`;
    return;
  }

  adminPlayerListContainer.innerHTML = "";
  filtered.forEach(player => {
    const row = document.createElement("div");
    row.className = "admin-player-row";

    const displayName = player.name || player.username || "Jogador";
    const initials = displayName.substring(0, 2).toUpperCase();
    const paidBadgeClass = player.paid ? "badge-paid" : "badge-pending";
    const paidText = player.paid ? "Pago" : "Pendente";

    // Ícone dinâmico do toggle (SVG do botão Pago/Pendente)
    const toggleIconSvg = player.paid 
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#10b981" width="24" height="24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24" style="color: var(--text-secondary);"><circle cx="12" cy="12" r="10"></circle></svg>`;

    row.innerHTML = `
      <div class="player-identity">
        <div class="player-avatar-circle">${initials}</div>
        <div class="player-details-info">
          <span class="player-details-name">${displayName}</span>
          <span class="player-details-badge ${paidBadgeClass}">${paidText}</span>
        </div>
      </div>
      <button class="payment-toggle-btn" data-username="${player.username}" type="button" title="Alternar status de pagamento">
        ${toggleIconSvg}
      </button>
    `;

    // Ação ao clicar no toggle de pagamento
    const toggleBtn = row.querySelector(".payment-toggle-btn");
    toggleBtn.addEventListener("click", async () => {
      toggleBtn.disabled = true;
      await handleAdminTogglePayment(player.username);
    });

    adminPlayerListContainer.appendChild(row);
  });
}

async function handleAdminTogglePayment(username) {
  if (!activeMatch) return;

  const player = activeMatch.players.find(p => p.username === username);
  if (!player) return;

  const originalPaid = player.paid;
  player.paid = !player.paid;

  try {
    // 1. Salva na partida ativa
    await addMatch(activeMatch);

    // 2. Sincroniza no perfil do usuário no Supabase
    if (typeof updatePlayerPaymentStatusByUsername === "function") {
      await updatePlayerPaymentStatusByUsername(username, {
        payment_status: player.paid ? "paid" : "pending",
      });
    }

    // 3. Limpa estatísticas do jogador se marcou como pago
    if (player.paid && typeof window.clearPlayerStats === "function") {
      await window.clearPlayerStats(username);
    }

    // 4. Atualiza os dados da interface admin e recarrega
    renderAdminPlayerList();

    // 5. Atualiza a interface do jogador se for o próprio usuário logado
    const currentUser = getStoredUser();
    if (currentUser && currentUser.username === username) {
      if (player.paid && window.FMModal) {
        window.FMModal.success("Seu pagamento foi registrado como pago!");
      }
    }
  } catch (error) {
    console.error("Erro ao alternar pagamento do jogador:", error);
    if (window.FMModal) {
      window.FMModal.error("Não foi possível atualizar o pagamento. Tente novamente.");
    }
    player.paid = originalPaid; // Reverte mudança
    renderAdminPlayerList();
  }
}

// Configuração e inicialização principal
async function initPage() {
  try {
    await initDB();
    const currentUser = getStoredUser();
    if (!currentUser) {
      window.location.href = "../index.html";
      return;
    }

    const playerPayment = await getPlayerPaymentStatus(currentUser.id);
    if (!playerPayment?.confirmed) {
      window.location.href = "welcome.html";
      return;
    }

    // Busca todas as partidas para verificar se há alguma ativa
    const matches = await getAllMatches();
    activeMatch = findActiveMatch(matches);

    // Se não há partida ativa, bloqueia tudo
    if (!activeMatch) {
      setMatchClosedState();
      return;
    }

    // Atualiza info da partida na tela
    updateMatchInfo(activeMatch);

    // Verifica se na partida ativa o status de pagamento do jogador está como pago
    const playerInMatch = activeMatch.players.find(
      (p) => p.username === currentUser.username
    );

    if (playerInMatch && playerInMatch.paid && window.FMModal) {
      window.FMModal.success("Pagamento já registrado. Obrigado!");
    }

    const links = await getPaymentLinks();
    updateDynamicContent(links);
    
    // Atualizar data limite vinda do banco
    if (links['payment_early_enabled_until']) {
      DEADLINE = new Date(links['payment_early_enabled_until']);
    }

    // Configura botões de acordo com o status atual
    const now = new Date();
    if (now.getTime() > DEADLINE.getTime()) {
      setupPaymentButton(btnEarly, null); // Expired
      setExpiredState();
    } else {
      setupPaymentButton(btnEarly, links['payment_link_early_player']);
    }

    setupPaymentButton(btnRegular, links['payment_link_regular_player']);
    setupPaymentButton(btnGoalkeeper, links['payment_link_goalkeeper']);
    
    updateCountdown();
    if (countdownInterval) window.clearInterval(countdownInterval);
    countdownInterval = window.setInterval(updateCountdown, 1000);

    // LÓGICA DE ADMINISTRADOR
    const isAdmin = isAdminRole(currentUser.role);
    if (isAdmin && adminTabsContainer) {
      adminTabsContainer.style.display = "flex";

      // Configuração das Abas
      const tabs = adminTabsContainer.querySelectorAll(".tab-btn");
      tabs.forEach(tab => {
        tab.addEventListener("click", () => {
          tabs.forEach(t => t.classList.remove("active"));
          tab.classList.add("active");

          const target = tab.dataset.tab;
          if (target === "player") {
            playerViewContainer.style.display = "block";
            adminViewContainer.style.display = "none";
          } else {
            playerViewContainer.style.display = "none";
            adminViewContainer.style.display = "block";
            loadAdminPanelData();
          }
        });
      });

      // Configura os formulários
      setupAdminForms();
    }

  } catch (error) {
    console.error("Erro ao carregar dados de pagamento:", error);
    if (alertEl) {
      alertEl.textContent = "Erro ao carregar os dados de pagamento. Tente novamente mais tarde.";
    }
    setupPaymentButton(btnEarly, null);
    setupPaymentButton(btnRegular, null);
    setupPaymentButton(btnGoalkeeper, null);
  }
}

function setupAdminForms() {
  // Envio de links Pix e prazo
  if (formPixConfig) {
    formPixConfig.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const submitBtn = formPixConfig.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      submitBtn.textContent = "Salvando...";

      try {
        const earlyLink = adminInputEarly.value.trim();
        const earlyText = adminInputEarlyText.value.trim();
        const regularLink = adminInputRegular.value.trim();
        const regularText = adminInputRegularText.value.trim();
        const goalkeeperLink = adminInputGoalkeeper.value.trim();
        const goalkeeperText = adminInputGoalkeeperText.value.trim();
        const deadlineVal = adminInputDeadline.value;
        const whatsappVal = adminInputWhatsapp.value.trim();

        const deadlineIso = new Date(deadlineVal).toISOString();

        // Salvar configs em paralelo no Supabase
        await Promise.all([
          saveConfig("payment_link_early_player", earlyLink),
          saveConfig("payment_text_early_player", earlyText),
          saveConfig("payment_link_regular_player", regularLink),
          saveConfig("payment_text_regular_player", regularText),
          saveConfig("payment_link_goalkeeper", goalkeeperLink),
          saveConfig("payment_text_goalkeeper", goalkeeperText),
          saveConfig("payment_early_enabled_until", deadlineIso),
          saveConfig("admin_whatsapp", whatsappVal)
        ]);

        if (window.FMModal) {
          window.FMModal.success("Configurações de pagamento atualizadas!");
        }

        // Recarrega as configurações principais na UI
        DEADLINE = new Date(deadlineIso);
        const now = new Date();
        const links = await getPaymentLinks();
        updateDynamicContent(links);

        if (now.getTime() > DEADLINE.getTime()) {
          setupPaymentButton(btnEarly, null);
          setExpiredState();
        } else {
          setupPaymentButton(btnEarly, links['payment_link_early_player']);
          if (alertEl) {
            alertEl.classList.remove("is-expired");
            alertEl.textContent = "Garanta desconto até o prazo!";
          }
          if (countdownBox) {
            countdownBox.classList.remove("is-expired");
            const title = countdownBox.querySelector(".countdown-title");
            if (title) title.textContent = "Tempo para pagar";
          }
        }

        setupPaymentButton(btnRegular, links['payment_link_regular_player']);
        setupPaymentButton(btnGoalkeeper, links['payment_link_goalkeeper']);
        updateCountdown();

      } catch (error) {
        console.error("Erro ao salvar configurações Pix:", error);
        if (window.FMModal) {
          window.FMModal.error("Falha ao salvar as configurações.");
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Salvar Configurações Pix";
      }
    });
  }

  // Envio de dados da partida ativa
  if (formMatchConfig) {
    formMatchConfig.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!activeMatch) return;

      const submitBtn = formMatchConfig.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      submitBtn.textContent = "Atualizando...";

      try {
        const location = adminMatchLocation.value.trim();
        const date = adminMatchDate.value;
        const time = adminMatchTime.value;
        const fee = parseFloat(adminMatchFee.value);

        if (!location || !date || !time || isNaN(fee)) {
          if (window.FMModal) {
            window.FMModal.warning("Por favor, preencha todos os campos da partida.");
          }
          return;
        }

        // Atualiza objeto
        activeMatch.location = location;
        activeMatch.date = date;
        activeMatch.time = time;
        activeMatch.playerFee = fee;

        // Salva partida
        await addMatch(activeMatch);

        if (window.FMModal) {
          window.FMModal.success("Partida atualizada com sucesso!");
        }
        
        // Recarrega dados na interface do jogador
        updateMatchInfo(activeMatch);

      } catch (error) {
        console.error("Erro ao atualizar partida:", error);
        if (window.FMModal) {
          window.FMModal.error("Erro ao salvar informações da partida.");
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Atualizar Dados da Partida";
      }
    });
  }

  // Campo de pesquisa da lista de jogadores
  if (playerSearchInput) {
    playerSearchInput.addEventListener("input", (e) => {
      filterAndRenderPlayers(e.target.value);
    });
  }
}

// Inicializar na carga da página
document.addEventListener("DOMContentLoaded", () => {
  initPage();
});
