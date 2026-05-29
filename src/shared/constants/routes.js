export const ROUTES = Object.freeze({
  login: 'index.html',
  welcome: 'welcome.html',
  dashboard: 'dashboard.html',
  details: 'details.html',
  schedule: 'schedule.html',
  financials: 'financials.html',
  profile: 'profile.html',
  payment: 'payment.html',
  publicScoreboard: 'placar-ao-vivo.html',
});

export const VISITOR_ALLOWED_PAGES = Object.freeze([
  ROUTES.welcome,
  ROUTES.dashboard,
  ROUTES.details,
  ROUTES.publicScoreboard,
]);

export const ADMIN_ONLY_PAGES = Object.freeze([
  'admin-placar.html',
  ROUTES.schedule,
  ROUTES.financials,
]);
