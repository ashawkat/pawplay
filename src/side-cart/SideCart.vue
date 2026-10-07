<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { getCart, changeLine, addItems, updateNote, getRecommendations, money, sizedImage } from './api.js';

const props = defineProps({ config: { type: Object, default: () => ({}) }, state: { type: Object, required: true } });
const t = (k, fallback) => props.config.strings?.[k] ?? fallback;

const cart = ref(null);
const loading = ref(true);
const busyKeys = ref(new Set());
const error = ref('');
const recs = ref([]);
const addingRec = ref(null);
const note = ref('');
const noteOpen = ref(false);
const announce = ref('');
const panel = ref(null);
let lastFocus = null;

const threshold = computed(() => Math.round(Number(props.config.freeShippingThreshold || 0) * 100 * (window.Shopify?.currency?.rate || 1)));
const remaining = computed(() => Math.max(0, threshold.value - (cart.value?.total_price || 0)));
const progress = computed(() => (threshold.value ? Math.min(100, ((cart.value?.total_price || 0) / threshold.value) * 100) : 0));
const items = computed(() => cart.value?.items || []);
const count = computed(() => cart.value?.item_count || 0);
const recsFiltered = computed(() => {
  const inCart = new Set(items.value.map((i) => i.product_id));
  return recs.value.filter((p) => !inCart.has(p.id) && p.available).slice(0, 6);
});

function syncBadges(c) {
  document.querySelectorAll('[data-cart-count]').forEach((el) => {
    el.textContent = c.item_count;
    el.classList.toggle('hidden', c.item_count === 0);
  });
}

async function load() {
  try {
    error.value = '';
    const c = await getCart();
    cart.value = c;
    note.value = c.note || '';
    syncBadges(c);
    loadRecs();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

let recsFor = null;
async function loadRecs() {
  if (!props.config.showUpsell) return;
  const first = items.value[0]?.product_id;
  if (!first || first === recsFor) return;
  recsFor = first;
  recs.value = await getRecommendations(first, 8);
}

async function setQty(item, qty) {
  if (busyKeys.value.has(item.key)) return;
  const prev = item.quantity;
  item.quantity = qty; // optimistic
  busyKeys.value = new Set([...busyKeys.value, item.key]);
  try {
    const c = await changeLine(item.key, qty);
    cart.value = c;
    syncBadges(c);
    announce.value = qty === 0 ? `${item.product_title} ${t('removed', 'removed')}` : `${item.product_title} × ${qty}`;
    if (c.items.length) loadRecs();
  } catch (e) {
    item.quantity = prev;
    error.value = e.message;
  } finally {
    const s = new Set(busyKeys.value);
    s.delete(item.key);
    busyKeys.value = s;
  }
}

async function quickAdd(product) {
  const variant = product.variants.find((v) => v.available) || product.variants[0];
  addingRec.value = product.id;
  try {
    await addItems([{ id: variant.id, quantity: 1 }]);
    await load();
    announce.value = `${product.title} ${t('added', 'added')}`;
  } catch (e) {
    error.value = e.message;
  } finally {
    addingRec.value = null;
  }
}

let noteTimer;
watch(note, (v) => {
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => updateNote(v).catch(() => {}), 600);
});

function close() {
  props.state.open = false;
}

function onKey(e) {
  if (!props.state.open) return;
  if (e.key === 'Escape') close();
  if (e.key === 'Tab' && panel.value) {
    const f = panel.value.querySelectorAll('a[href],button:not([disabled]),input,textarea,select');
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  }
}

watch(() => props.state.open, async (open) => {
  document.documentElement.classList.toggle('overflow-hidden', open);
  if (open) {
    lastFocus = document.activeElement;
    load();
    await nextTick();
    panel.value?.querySelector('[data-close]')?.focus();
  } else {
    props.state.justAdded = null;
    lastFocus?.focus?.();
  }
});

const onRefresh = () => load();
onMounted(() => {
  document.addEventListener('keydown', onKey);
  document.addEventListener('pawplay:cart:refresh', onRefresh);
  if (props.state.open) load();
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey);
  document.removeEventListener('pawplay:cart:refresh', onRefresh);
});

const lineOptions = (item) => (item.options_with_values || []).filter((o) => o.value !== 'Default Title').map((o) => o.value).join(' • ');
</script>

<template>
  <div class="fixed inset-0 z-[60]" :class="state.open ? 'pointer-events-auto' : 'pointer-events-none'" :aria-hidden="!state.open">
    <!-- overlay -->
    <div class="absolute inset-0 bg-ink/40 transition-opacity duration-300" :class="state.open ? 'opacity-100' : 'opacity-0'" @click="close" />

    <!-- panel -->
    <aside
      ref="panel"
      role="dialog"
      aria-modal="true"
      :aria-label="t('title', 'Your cart')"
      class="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out will-change-transform"
      :class="state.open ? 'translate-x-0' : 'translate-x-full'"
    >
      <!-- header -->
      <header class="flex items-center justify-between border-b border-divider px-6 py-5">
        <h2 class="font-heading text-2xl font-semibold text-ink">
          {{ t('title', 'Your cart') }}
          <span v-if="count" class="ml-1 inline-grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 align-middle text-xs text-white">{{ count }}</span>
        </h2>
        <button data-close type="button" class="grid size-10 place-items-center rounded-full border border-divider transition hover:border-primary hover:text-primary" :aria-label="t('close', 'Close')" @click="close">
          <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>

      <!-- free shipping -->
      <div v-if="threshold && count" class="border-b border-divider bg-blush px-6 py-4">
        <p class="text-sm font-medium text-text">
          <template v-if="remaining > 0">{{ t('freeShippingAway', 'You are') }} <strong class="text-primary">{{ money(remaining) }}</strong> {{ t('freeShippingTail', 'away from free shipping') }} 🐾</template>
          <template v-else>🎉 {{ t('freeShippingUnlocked', 'You unlocked free shipping!') }}</template>
        </p>
        <div class="mt-2.5 h-2 overflow-hidden rounded-full bg-white">
          <div class="h-full rounded-full bg-primary transition-[width] duration-500" :style="{ width: progress + '%' }" />
        </div>
      </div>

      <!-- body -->
      <div class="flex-1 overflow-y-auto overscroll-contain">
        <!-- skeleton -->
        <ul v-if="loading && !cart" class="space-y-4 p-6" aria-busy="true">
          <li v-for="n in 3" :key="n" class="flex gap-4">
            <div class="size-20 animate-pulse rounded-2xl bg-soft" />
            <div class="flex-1 space-y-2 pt-2"><div class="h-3 w-3/4 animate-pulse rounded bg-soft" /><div class="h-3 w-1/3 animate-pulse rounded bg-soft" /></div>
          </li>
        </ul>

        <!-- empty -->
        <div v-else-if="!count" class="flex h-full flex-col items-center justify-center gap-4 p-10 text-center">
          <svg class="h-16 w-20 text-primary/25" viewBox="0 0 64 54" aria-hidden="true"><g fill="currentColor"><ellipse cx="14" cy="10" rx="6" ry="8.5" transform="rotate(-12 14 10)" /><ellipse cx="29" cy="6" rx="6" ry="8.5" /><ellipse cx="44" cy="10" rx="6" ry="8.5" transform="rotate(12 44 10)" /><ellipse cx="55" cy="25" rx="5.5" ry="7.5" transform="rotate(25 55 25)" /><path d="M33 22c-9 0-19 12-19 21 0 6 5 9 10 8 4-.8 6-2.6 9-2.6s5 1.8 9 2.6c5 1 10-2 10-8 0-9-10-21-19-21Z" /></g></svg>
          <p class="text-lg font-semibold text-ink">{{ t('empty', 'Your cart is empty') }}</p>
          <a :href="config.shopUrl || '/collections/all'" class="btn btn--primary" @click="close">{{ t('continue', 'Continue shopping') }}</a>
        </div>

        <!-- items -->
        <template v-else>
          <TransitionGroup tag="ul" name="line" class="divide-y divide-divider px-6">
            <li v-for="item in items" :key="item.key" class="relative flex gap-4 py-5" :class="{ 'opacity-60': busyKeys.has(item.key) }">
              <a :href="item.url" class="block size-20 shrink-0 overflow-hidden rounded-2xl bg-[#f3f3f3]">
                <img v-if="item.image" :src="sizedImage(item.image, 200)" :alt="item.product_title" width="80" height="80" loading="lazy" class="size-full object-contain" />
              </a>
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-3">
                  <a :href="item.url" class="line-clamp-2 font-semibold leading-snug text-ink hover:text-primary">{{ item.product_title }}</a>
                  <button type="button" class="shrink-0 text-muted transition hover:text-primary" :aria-label="`${t('remove', 'Remove')} ${item.product_title}`" @click="setQty(item, 0)">
                    <svg class="size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
                  </button>
                </div>
                <p v-if="lineOptions(item)" class="mt-1 text-sm text-muted">{{ lineOptions(item) }}</p>
                <p v-for="d in item.line_level_discount_allocations" :key="d.discount_application.title" class="mt-1 text-xs font-medium text-secondary">{{ d.discount_application.title }} (−{{ money(d.amount) }})</p>
                <div class="mt-3 flex items-center justify-between">
                  <div class="flex h-9 items-center gap-1 rounded-full border border-divider px-1">
                    <button type="button" class="grid size-7 place-items-center rounded-full text-lg hover:bg-soft" :aria-label="t('decrease', 'Decrease quantity')" @click="setQty(item, item.quantity - 1)">−</button>
                    <span class="w-7 text-center text-sm font-semibold" aria-live="polite">{{ item.quantity }}</span>
                    <button type="button" class="grid size-7 place-items-center rounded-full text-lg hover:bg-soft" :aria-label="t('increase', 'Increase quantity')" @click="setQty(item, item.quantity + 1)">+</button>
                  </div>
                  <div class="text-right">
                    <s v-if="item.original_line_price > item.final_line_price" class="block text-xs text-[#b6b6b6]">{{ money(item.original_line_price) }}</s>
                    <span class="font-bold text-primary">{{ money(item.final_line_price) }}</span>
                  </div>
                </div>
              </div>
            </li>
          </TransitionGroup>

          <!-- upsell -->
          <section v-if="recsFiltered.length" class="mt-2 border-t border-divider bg-soft px-6 py-5">
            <h3 class="mb-3 font-heading text-lg font-semibold text-ink">{{ t('upsell', 'Pets also love') }}</h3>
            <ul class="-mx-6 flex snap-x gap-3 overflow-x-auto px-6 pb-1 [scrollbar-width:none]">
              <li v-for="p in recsFiltered" :key="p.id" class="w-[150px] shrink-0 snap-start rounded-2xl bg-white p-3">
                <a :href="p.url" class="block aspect-square overflow-hidden rounded-xl bg-[#f3f3f3]">
                  <img v-if="p.featured_image" :src="sizedImage(p.featured_image, 300)" :alt="p.title" width="126" height="126" loading="lazy" class="size-full object-contain" />
                </a>
                <p class="mt-2 line-clamp-2 text-xs font-semibold leading-snug text-ink">{{ p.title }}</p>
                <div class="mt-2 flex items-center justify-between">
                  <span class="text-sm font-bold text-primary">{{ money(p.price) }}</span>
                  <button type="button" class="grid size-8 place-items-center rounded-full bg-primary text-white transition hover:scale-110 disabled:opacity-50" :disabled="addingRec === p.id" :aria-label="`${t('add', 'Add')} ${p.title}`" @click="quickAdd(p)">
                    <svg v-if="addingRec !== p.id" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    <span v-else class="size-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </button>
                </div>
              </li>
            </ul>
          </section>

          <!-- note -->
          <div v-if="config.showNote" class="px-6 py-4">
            <button type="button" class="text-sm font-medium text-primary" :aria-expanded="noteOpen" @click="noteOpen = !noteOpen">+ {{ t('addNote', 'Add order note') }}</button>
            <textarea v-if="noteOpen" v-model="note" rows="3" class="mt-2 w-full rounded-2xl border border-divider bg-soft p-3 text-sm outline-none focus:border-primary" :aria-label="t('addNote', 'Order note')" />
          </div>
        </template>
      </div>

      <!-- footer -->
      <footer v-if="count" class="border-t border-divider px-6 py-5">
        <p v-if="error" class="mb-3 rounded-xl bg-primary/10 p-3 text-sm text-primary" role="alert">{{ error }}</p>
        <div v-for="d in cart.cart_level_discount_applications" :key="d.title" class="mb-1 flex justify-between text-sm text-secondary">
          <span>{{ d.title }}</span><span>−{{ money(d.total_allocated_amount) }}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-lg font-semibold text-text">{{ t('subtotal', 'Subtotal') }}</span>
          <span class="text-2xl font-bold text-primary">{{ money(cart.total_price) }}</span>
        </div>
        <p class="mt-1 text-xs text-muted">{{ t('taxes', 'Taxes and shipping calculated at checkout') }}</p>
        <div class="mt-4 grid grid-cols-2 gap-3">
          <a :href="config.cartUrl || '/cart'" class="btn border border-divider bg-white text-ink">{{ t('viewCart', 'View cart') }}</a>
          <a href="/checkout" class="btn btn--primary">{{ t('checkout', 'Checkout') }}</a>
        </div>
      </footer>

      <p class="sr-only" aria-live="polite">{{ announce }}</p>
    </aside>
  </div>
</template>
