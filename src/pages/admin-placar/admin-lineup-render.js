const LINEUP_ITEM_STYLE = 'cursor:pointer; transition:0.2s; padding:8px; border-radius:8px; background:rgba(255,255,255,0.03); margin-bottom:4px; display:flex; align-items:center; gap:8px;';
const NUMBER_STYLE = 'width:24px; height:24px; background:rgba(255,255,255,0.1); border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:bold;';
const NAME_STYLE = 'flex:1;';
const POSITION_STYLE = 'font-size:0.7rem; color:var(--text-muted);';
const BALL_ICON_STYLE = 'color:rgba(255,255,255,0.15);';

function createElement(tagName, { className, text, style } = {}) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  if (style) element.style.cssText = style;
  return element;
}

function getPlayerName(player) {
  return String(player?.nome || '').trim();
}

export function renderAdminLineupList(container, players = [], timeKey, onGoalClick) {
  if (!container) return;

  const items = Array.isArray(players) ? players : [];

  if (items.length === 0) {
    container.replaceChildren(createElement('div', {
      className: 'adm-esc-empty',
      text: 'Nenhum jogador',
    }));
    return;
  }

  const nodes = items.map((player) => {
    const playerName = getPlayerName(player) || 'Jogador';
    const item = createElement('div', {
      className: 'adm-escalacao-item',
      style: LINEUP_ITEM_STYLE,
    });

    item.title = `Clique para registrar gol de ${playerName}`;
    item.addEventListener('click', () => onGoalClick?.(timeKey, playerName));

    item.append(
      createElement('span', {
        className: 'adm-esc-numero',
        text: player?.numero || '-',
        style: NUMBER_STYLE,
      }),
      createElement('span', {
        className: 'adm-esc-nome',
        text: playerName,
        style: NAME_STYLE,
      }),
      createElement('span', {
        className: 'adm-esc-posicao',
        text: player?.posicao || '',
        style: POSITION_STYLE,
      }),
      createElement('i', {
        className: 'fas fa-futbol',
        style: BALL_ICON_STYLE,
      }),
    );

    return item;
  });

  container.replaceChildren(...nodes);
}

export function renderAdminSuggestions(container, suggestions = [], onSelect) {
  if (!container) return;

  const items = Array.isArray(suggestions) ? suggestions : [];
  const nodes = items.map((name) => {
    const playerName = String(name || '').trim();
    const item = createElement('div', {
      className: 'adm-suggest-item',
      text: playerName,
    });

    item.addEventListener('click', (event) => {
      event.stopPropagation();
      onSelect?.(playerName);
    });

    return item;
  });

  container.replaceChildren(...nodes);
}
