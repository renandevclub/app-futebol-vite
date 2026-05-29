// ENTRY: Admin Placar (pages/admin-placar.html)
import '../styles/core.css';
import '../styles/pages/admin-placar.css';
import '../styles/navigation.css';

import '../core/boot/authenticated-base-page.js';

// Inicializa indicador de conexão Realtime
import { initConnectionIndicator } from '../components/ui/connection-indicator.js';
initConnectionIndicator();

import '../pages/admin-placar/index.js';
