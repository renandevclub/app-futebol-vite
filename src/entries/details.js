// ENTRY: Details (pages/details.html)
import '../styles/core.css';
import '../styles/pages/details.css';
import '../styles/navigation.css';

import '../core/boot/realtime-authenticated-page.js';

// Inicializa indicador de conexão Realtime
import { initConnectionIndicator } from '../components/ui/connection-indicator.js';
initConnectionIndicator();

import '../pages/details/index.js';
