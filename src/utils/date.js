export function formatDateBR(dateValue) {
  if (!dateValue) return '';

  const [year, month, day] = String(dateValue).split('-');
  if (!year || !month || !day) return String(dateValue);

  return `${day}/${month}/${year}`;
}

export function formatDateDayMonthBR(dateValue) {
  if (!dateValue) return '';

  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return formatDateBR(dateValue).slice(0, 5);

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

export function formatShortDateBR(dateValue) {
  if (!dateValue) return '';

  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export function formatWeekdayBR(dateValue) {
  if (!dateValue) return '';

  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('pt-BR', { weekday: 'long' });
}

export function getTimeRemainingLabel(deadline) {
  if (!deadline) return 'Sem prazo definido';

  const now = new Date();
  const end = new Date(deadline);
  const diff = end - now;

  if (diff <= 0) return 'Prazo expirado';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m restantes`;
}
