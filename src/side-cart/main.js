import { createApp, reactive } from 'vue';
import SideCart from './SideCart.vue';

// Shared state so theme.js can open the drawer / push freshly added items.
export const state = reactive({ open: false, justAdded: null });

let mounted = false;

export function mount() {
  if (mounted) return;
  const el = document.getElementById('SideCartRoot');
  if (!el) return;
  const config = JSON.parse(el.dataset.config || '{}');
  createApp(SideCart, { config, state }).mount(el);
  mounted = true;
}

export function open(addedItem) {
  mount();
  if (addedItem) state.justAdded = addedItem;
  state.open = true;
}

export function refresh() {
  mount();
  document.dispatchEvent(new CustomEvent('pawplay:cart:refresh'));
}
