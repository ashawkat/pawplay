// Thin wrapper around Shopify's AJAX Cart API
const root = () => window.Shopify?.routes?.root || '/';

async function request(path, body) {
  const res = await fetch(`${root()}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.description || data.message || 'Cart error');
  return data;
}

export const getCart = () => request('cart.js');
export const changeLine = (key, quantity) => request('cart/change.js', { id: key, quantity });
export const addItems = (items) => request('cart/add.js', { items });
export const updateNote = (note) => request('cart/update.js', { note });

export async function getRecommendations(productId, limit = 4) {
  if (!productId) return [];
  try {
    const res = await fetch(`${root()}recommendations/products.json?product_id=${productId}&limit=${limit}&intent=complementary`);
    let data = await res.json();
    if (!data.products?.length) {
      const r2 = await fetch(`${root()}recommendations/products.json?product_id=${productId}&limit=${limit}`);
      data = await r2.json();
    }
    return data.products || [];
  } catch {
    return [];
  }
}

export function money(cents) {
  const fmt = window.PawPlay?.moneyFormat || '${{amount}}';
  const value = (Number(cents || 0) / 100).toFixed(2);
  return fmt
    .replace(/\{\{\s*amount_no_decimals[a-z_]*\s*\}\}/, Math.round(cents / 100).toLocaleString())
    .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/, value.replace('.', ','))
    .replace(/\{\{\s*amount[a-z_]*\s*\}\}/, value.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
}

export function sizedImage(url, width = 160) {
  if (!url) return '';
  try {
    const u = new URL(url, location.origin);
    u.searchParams.set('width', width);
    return u.toString();
  } catch {
    return url;
  }
}
