// ENTRY: Dashboard (pages/dashboard.html)
import '../styles/core.css';
import '../styles/pages/dashboard.css';
import '../styles/navigation.css';

import '../core/boot/realtime-authenticated-page.js';

// Inicializa indicador de conexão Realtime
import { initConnectionIndicator } from '../components/ui/connection-indicator.js';
initConnectionIndicator();

import '../pages/dashboard/index.js';
