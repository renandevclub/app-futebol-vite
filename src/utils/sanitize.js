const HTML_ESCAPE_MAP = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
});

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
}

export function stripHtml(value) {
  const template = document.createElement('template');
  template.innerHTML = String(value ?? '');
  return template.content.textContent || '';
}
