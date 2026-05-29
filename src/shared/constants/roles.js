export const USER_ROLES = Object.freeze({
  admin: 'admin',
  player: 'user',
  visitor: 'visitor',
});

export function isAdminRole(role) {
  return role === USER_ROLES.admin;
}

export function isVisitorRole(role) {
  return role === USER_ROLES.visitor;
}
