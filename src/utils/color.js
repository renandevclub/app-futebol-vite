export function normalizeHexColor(hex, fallback = '#60a5fa') {
  const value = String(hex || '').trim();

  // Inline styles must stay restricted to trusted hex colors from the app palette.
  return /^#[a-f\d]{6}$/i.test(value) ? value : fallback;
}

export function hexToRgbObject(hex, fallback = { r: 100, g: 100, b: 100 }) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!result) return fallback;

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

export function getRgbBrightness(rgb) {
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
}

export function isDarkRgb(rgb, threshold = 80) {
  return getRgbBrightness(rgb) < threshold;
}
