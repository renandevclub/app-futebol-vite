/**
 * @file src/stores/notification.store.js
 * @description Store reativo para notificações
 */

import { createStore } from './reactive-store.js';

const initialState = {
  notifications: [],    // Lista de notificações
  unreadCount: 0,      // Count de não lidas
  toast: null,         // Toast em exibição
  toastQueue: [],      // Fila de toasts
};

const notificationStore = createStore(initialState);

/**
 * Define lista de notificações
 */
export function setNotifications(notifications) {
  notificationStore.set('notifications', notifications || []);
  updateUnreadCount();
}

/**
 * Obtém lista de notificações
 */
export function getNotifications() {
  return notificationStore.get('notifications') || [];
}

/**
 * Adiciona notificação
 */
export function addNotification(notification) {
  const notifications = getNotifications();
  notificationStore.set('notifications', [notification, ...notifications]);
  updateUnreadCount();
}

/**
 * Remove notificação
 */
export function removeNotification(notificationId) {
  const notifications = getNotifications();
  notificationStore.set('notifications', notifications.filter(n => n.id !== notificationId));
  updateUnreadCount();
}

/**
 * Marca notificação como lida
 */
export function markAsRead(notificationId) {
  const notifications = getNotifications();
  const index = notifications.findIndex(n => n.id === notificationId);
  if (index !== -1) {
    notifications[index].read = true;
    notificationStore.set('notifications', [...notifications]);
    updateUnreadCount();
  }
}

/**
 * Marca todas como lidas
 */
export function markAllAsRead() {
  const notifications = getNotifications();
  notifications.forEach(n => n.read = true);
  notificationStore.set('notifications', [...notifications]);
  updateUnreadCount();
}

/**
 * Atualiza count de não lidas
 */
function updateUnreadCount() {
  const notifications = getNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;
  notificationStore.set('unreadCount', unreadCount);
}

/**
 * Obtém count de não lidas
 */
export function getUnreadCount() {
  return notificationStore.get('unreadCount');
}

/**
 * Mostra toast
 */
export function showToast(toast) {
  notificationStore.set('toast', toast);
}

/**
 * Obtém toast atual
 */
export function getCurrentToast() {
  return notificationStore.get('toast');
}

/**
 * Limpa toast
 */
export function clearToast() {
  notificationStore.set('toast', null);
}

/**
 * Fila de toasts (para múltiplos em sequência)
 */
export function enqueueToast(toast) {
  const queue = notificationStore.get('toastQueue');
  notificationStore.set('toastQueue', [...queue, toast]);
}

/**
 * Dequeue toast
 */
export function dequeueToast() {
  const queue = notificationStore.get('toastQueue');
  if (queue.length > 0) {
    const toast = queue[0];
    notificationStore.set('toastQueue', queue.slice(1));
    return toast;
  }
  return null;
}

/**
 * Se inscreve para mudanças
 */
export function subscribeToNotifications(callback) {
  return notificationStore.subscribe(() => {
    callback({
      notifications: notificationStore.get('notifications'),
      unreadCount: notificationStore.get('unreadCount'),
      toast: notificationStore.get('toast'),
    });
  });
}

/**
 * Reseta store
 */
export function resetNotificationStore() {
  notificationStore.reset();
}

export default notificationStore;
