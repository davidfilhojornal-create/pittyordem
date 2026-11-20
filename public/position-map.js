// Cálculos e textos do mapa de posições. Sem dependências: roda no navegador e nos testes (node --test).

export const POSITIONS = 13;

const pctFormat = new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 1});
const avgFormat = new Intl.NumberFormat('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1});

// Valor exato, sem arredondar. Retorna null quando não há envios (nada de dividir por zero).
export function percent(count, total) {
  if (!Number.isFinite(total) || total <= 0) return null;
  const n = Number.isFinite(count) && count > 0 ? count : 0;
  return (n / total) * 100;
}

// Arredonda só na exibição: 32 → "32%", 12.5 → "12,5%", 33.333… → "33,3%".
export function formatPercent(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return pctFormat.format(value) + '%';
}

export const formatAverage = value => (Number.isFinite(value) ? avgFormat.format(value) : '—');

// Índice 0 → "1ª" (posição) / "1º" (lugar).
export const positionLabel = index => `${index + 1}ª`;
// API modes already contains 1-based positions.
export const modeLabel = position => `${position}ª`;
export const placeLabel = index => `${index + 1}º`;

// Linhas na ordem oficial do álbum (vinda de /api/catalog), cruzando com os dados de /api/results.
export function buildMatrix(catalogTracks, summary) {
  const total = summary && Number.isFinite(summary.total) ? summary.total : 0;
  const byKey = new Map((summary?.tracks || []).map(t => [t.key, t]));
  const rows = catalogTracks.map(track => {
    const data = byKey.get(track.key);
    const counts = Array.from({length: POSITIONS}, (_, i) => data?.positions?.[i] ?? 0);
    return {
      key: track.key,
      name: track.name,
      average: data?.average ?? null,
      modes: data?.modes ?? [],
      cells: counts.map(count => ({count, percent: percent(count, total)})),
    };
  });
  const max = rows.reduce((m, r) => Math.max(m, ...r.cells.map(c => c.percent ?? 0)), 0);
  return {total, rows, max};
}

// Textos do detalhe. Concordância no singular quando count === 1.
export function describeCell({name, count, total, index}) {
  const value = percent(count, total);
  const one = count === 1;
  let action;
  if (index === 0) action = one ? 'começa com esta faixa' : 'começam com esta faixa';
  else if (index === POSITIONS - 1) action = one ? 'termina com esta faixa' : 'terminam com esta faixa';
  else action = `${one ? 'coloca' : 'colocam'} esta faixa na ${positionLabel(index)} posição`;
  const headline = `${formatPercent(value)} em ${placeLabel(index)} lugar`;
  const sentence = `${count} de ${total} ${total === 1 ? 'playlist' : 'playlists'} ${action}.`;
  return {title: name, headline, sentence, label: `${name}, ${positionLabel(index)} posição: ${headline.replace(/ em .*/, '')}. ${sentence}`};
}

// Escala única para a grade inteira: cinza quase preto (menos frequente) → branco (mais frequente), como luz.
// Normalizada pelo maior valor da grade, para o contraste aparecer mesmo com porcentagens baixas.
export const SCALE_LOW = [0x1c, 0x1c, 0x1c];
export const SCALE_HIGH = [0xff, 0xff, 0xff];
const LIGHT_TEXT = [0xff, 0xff, 0xff];
const DARK_TEXT = [0x00, 0x00, 0x00];

const hex = rgb => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
function luminance(rgb) {
  const [r, g, b] = rgb.map(v => {const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;});
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

export function colorFor(value, max) {
  const t = value && max > 0 ? Math.min(1, value / max) : 0;
  const bg = SCALE_LOW.map((low, i) => low + (SCALE_HIGH[i] - low) * t);
  const fg = contrast(bg, LIGHT_TEXT) >= contrast(bg, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
  return {t, background: hex(bg), color: hex(fg), contrast: contrast(bg, fg)};
}

export const scaleGradient = () => `linear-gradient(90deg, ${hex(SCALE_LOW)}, ${hex(SCALE_HIGH)})`;
