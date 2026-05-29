/**
 * @file src/core/types/index.js
 * @description TypeScript JSDoc types para Futebol Milhão
 * Centraliza todos os tipos de dados da aplicação
 */

/**
 * @typedef {Object} FMUser
 * @property {string} id - UUID do usuário (Supabase Auth)
 * @property {string} auth_id - UUID do Supabase Auth
 * @property {string} username - Nome de usuário único
 * @property {string} full_name - Nome completo
 * @property {string} [phone] - Telefone (opcional)
 * @property {'player'|'admin'|'visitor'} role - Role do usuário
 * @property {string} [email] - Email (se disponível)
 * @property {Date} [created_at] - Data de criação
 */

/**
 * @typedef {Object} FMMatch
 * @property {string} id - UUID do match
 * @property {string} title - Título do match
 * @property {string} date - Data (YYYY-MM-DD)
 * @property {string} time - Hora (HH:mm)
 * @property {string} location - Local do match
 * @property {number} player_fee - Taxa de participação
 * @property {string} admin_id - UUID do admin que criou
 * @property {'draft'|'open'|'closed'|'finished'} status - Status
 * @property {Object} [roster] - Roster de jogadores (JSON)
 * @property {Date} [created_at] - Data de criação
 * @property {Date} [updated_at] - Data de atualização
 */

/**
 * @typedef {Object} FMPlayerDraw
 * @property {string} id - UUID do draw
 * @property {string} match_id - UUID do match
 * @property {string} player_username - Username do player sorteado
 * @property {string} player_key - Chave do player
 * @property {string} [team_id] - ID do time sorteado
 * @property {string} [team_name] - Nome do time
 * @property {'drawn'|'released'} status - Status do draw
 * @property {string} assigned_by - Quem atribuiu (system, admin)
 * @property {string} [idempotency_key] - Chave de idempotência
 * @property {Date} [drawn_at] - Data do sorteio
 * @property {Date} [created_at] - Data de criação
 * @property {Date} [updated_at] - Data de atualização
 * @property {Date} [released_at] - Data de liberação
 * @property {string} [released_by] - Quem liberou
 * @property {string} [release_reason] - Motivo da liberação
 */

/**
 * @typedef {Object} FMTeam
 * @property {string} id - ID único do time
 * @property {string} name - Nome do time
 * @property {number} position - Posição (1-10)
 * @property {string} color - Cor em hex (#ef4444)
 * @property {string} icon - Emoji ou ícone
 */

/**
 * @typedef {Object} FMStanding
 * @property {string} id - UUID
 * @property {string} match_id - ID da competição
 * @property {string} team_id - ID do time
 * @property {string} team_name - Nome do time
 * @property {string} team_color - Cor do time (hex)
 * @property {number} points - Pontos (3V + 1E)
 * @property {number} wins - Vitórias
 * @property {number} draws - Empates
 * @property {number} losses - Derrotas
 * @property {number} goals_for - Gols a favor
 * @property {number} goals_against - Gols contra
 * @property {number} goal_difference - Diferença de gols
 * @property {number} matches_played - Partidas jogadas
 * @property {Date} [created_at] - Data de criação
 * @property {Date} [updated_at] - Data de atualização
 */

/**
 * @typedef {Object} FMPaymentStatus
 * @property {string} player_id - UUID do player (auth_id)
 * @property {string} [match_id] - UUID do match
 * @property {boolean} confirmed - Confirmado no sorteio?
 * @property {'pending'|'paid'} payment_status - Status do pagamento
 * @property {Date} [confirmed_at] - Data de confirmação
 * @property {Date} [paid_at] - Data de pagamento
 * 
 * NOTA: No banco, pagamentos são parte de fm_profiles (confirmed, payment_status).
 * O DTO mapeia isso para a entidade FMPaymentStatus usada no código.
 */

/**
 * @typedef {Object} FMNotification
 * @property {string} id - ID
 * @property {string} type - Tipo de notificação
 * @property {string} [match_id] - ID da partida relacionada
 * @property {string} title - Título
 * @property {string} body - Corpo da mensagem
 * @property {string} [url] - URL relacionada
 * @property {Object} data - Dados adicionais (JSON)
 * @property {string} [sent_by] - Quem enviou
 * @property {string} [onesignal_external_id] - ID externo OneSignal
 * @property {string} [onesignal_notification_id] - ID da notificação OneSignal
 * @property {string} [segment] - Segmento OneSignal
 * @property {string} status - Status (sent, failed)
 * @property {Date} [created_at] - Data de criação
 */

/**
 * @typedef {Object} FMActivityLog
 * @property {string} id - UUID
 * @property {string} user_id - UUID do usuário
 * @property {string} action - Ação realizada
 * @property {Object} [details] - Detalhes adicionais
 * @property {Date} [created_at] - Data de criação
 */

/**
 * Exporta tipos para JSDoc (sem implementação)
 */
export const TYPES = {
  FMUser: /** @type {typeof FMUser} */ null,
  FMMatch: /** @type {typeof FMMatch} */ null,
  FMPlayerDraw: /** @type {typeof FMPlayerDraw} */ null,
  FMTeam: /** @type {typeof FMTeam} */ null,
  FMStanding: /** @type {typeof FMStanding} */ null,
  FMPaymentStatus: /** @type {typeof FMPaymentStatus} */ null,
  FMNotification: /** @type {typeof FMNotification} */ null,
  FMActivityLog: /** @type {typeof FMActivityLog} */ null,
};
