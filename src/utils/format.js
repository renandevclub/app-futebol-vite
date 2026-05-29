export function formatCurrencyBRL(value) {
  const amount = Number(value || 0);
  return `R$ ${amount.toFixed(2).replace('.', ',')}`;
}
