import { normalizeHexColor } from "../../utils/color.js";

const TEAM_NAME_STYLE =
  "color:#fff;padding:4px 12px;border-radius:20px;text-shadow:0 1px 2px rgba(0,0,0,0.3);font-weight:700;display:inline-block;";

export function renderAdminLiveScoreHeader(ui, match) {
  if (!ui || !match) return;

  const colorTime1 = normalizeHexColor(match.time1_color, "#60a5fa");
  const colorTime2 = normalizeHexColor(match.time2_color, "#fb7185");

  ui.liveSection?.style.setProperty("--color-t1", colorTime1);
  ui.liveSection?.style.setProperty("--color-t2", colorTime2);

  if (ui.nomeTime1) {
    ui.nomeTime1.textContent = match.time1_nome;
    ui.nomeTime1.style.cssText = `background:${colorTime1};${TEAM_NAME_STYLE}`;
  }

  if (ui.nomeTime2) {
    ui.nomeTime2.textContent = match.time2_nome;
    ui.nomeTime2.style.cssText = `background:${colorTime2};${TEAM_NAME_STYLE}`;
  }

  if (ui.placarTime1) ui.placarTime1.textContent = match.time1_gols || 0;
  if (ui.placarTime2) ui.placarTime2.textContent = match.time2_gols || 0;
  if (ui.observacoes) ui.observacoes.value = match.observacoes || "";
}

export function renderAdminStatusBadge(statusBadge, isRunning) {
  if (!statusBadge) return;

  if (isRunning) {
    statusBadge.className = "adm-status live";
    statusBadge.innerHTML =
      '<span style="width:8px;height:8px;border-radius:50%;background:#ef4444;animation:pav-pulse 1.5s infinite"></span> AO VIVO';
    return;
  }

  statusBadge.className = "adm-status paused";
  statusBadge.innerHTML =
    '<span style="width:8px;height:8px;border-radius:50%;background:var(--text-muted)"></span> PAUSADO';
}
