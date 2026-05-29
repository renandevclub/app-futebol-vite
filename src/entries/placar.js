// ENTRY: Placar Ao Vivo (placar-ao-vivo.html)
import '../styles/core.css';
import '../styles/pages/placar-ao-vivo.css';

import '../core/boot/public-scoreboard-page.js';

// Inicializa indicador de conexão Realtime
import { initConnectionIndicator } from '../components/ui/connection-indicator.js';
initConnectionIndicator();

import '../pages/placar/index.js';
