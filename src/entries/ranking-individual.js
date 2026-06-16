import '../styles/core.css';
import '../styles/navigation.css';
import '../styles/pages/ranking-individual.css';

import '../core/boot/realtime-authenticated-page.js';

// Inicializa indicador de conexão Realtime
import { initConnectionIndicator } from '../components/ui/connection-indicator.js';
if (typeof initConnectionIndicator === 'function') {
  initConnectionIndicator();
}

import '../pages/ranking-individual/ranking-individual.js';
