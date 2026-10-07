/* PawPlay theme JS — small, dependency-free web components */

// Mobile menu drawer (native <dialog>)
document.addEventListener('click', (e) => {
  const open = e.target.closest('[data-drawer-open]');
  if (open) document.getElementById(open.dataset.drawerOpen)?.showModal();
  const close = e.target.closest('[data-drawer-close]');
  if (close) close.closest('dialog')?.close();
});

// Horizontal scroll-row arrows
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-scroll-prev],[data-scroll-next]');
  if (!btn) return;
  const id = btn.dataset.scrollPrev || btn.dataset.scrollNext;
  const row = document.getElementById(id);
  if (!row) return;
  const dir = btn.hasAttribute('data-scroll-next') ? 1 : -1;
  row.scrollBy({ left: dir * row.clientWidth * 0.8, behavior: 'smooth' });
});

// Fade slideshow
class SlideShow extends HTMLElement {
  connectedCallback() {
    this.slides = [...this.querySelectorAll('[data-slide]')];
    this.index = 0;
    this.querySelector('[data-prev]')?.addEventListener('click', () => this.go(this.index - 1));
    this.querySelector('[data-next]')?.addEventListener('click', () => this.go(this.index + 1));
    if (this.dataset.autoplay === 'true' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.timer = setInterval(() => this.go(this.index + 1), 6000);
    }
  }
  disconnectedCallback() { clearInterval(this.timer); }
  go(i) {
    const n = this.slides.length;
    this.index = (i + n) % n;
    this.slides.forEach((s, k) => {
      const on = k === this.index;
      s.classList.toggle('opacity-0', !on);
      s.classList.toggle('pointer-events-none', !on);
      s.setAttribute('aria-hidden', String(!on));
    });
  }
}
customElements.get('slide-show') || customElements.define('slide-show', SlideShow);

/* ---------- Side cart (Vue) — lazy loaded so it never touches first paint ---------- */
const cartRoot = () => document.getElementById('SideCartRoot');
let sideCart; // module promise
const loadSideCart = () => {
  const root = cartRoot();
  if (!root) return null;
  sideCart ||= import(root.dataset.src).catch(() => (sideCart = null));
  return sideCart;
};

// Warm the module up on intent only (hover/touch the cart icon or an add-to-cart form).
// Deliberately NOT preloaded on idle: Lighthouse would count it against TBT.
const warm = () => loadSideCart();
document.addEventListener('pointerover', (e) => { if (e.target.closest('[data-cart-toggle]')) warm(); }, { passive: true });
document.addEventListener('touchstart', (e) => { if (e.target.closest('[data-cart-toggle], [data-product-form]')) warm(); }, { passive: true });
document.addEventListener('focusin', (e) => { if (e.target.closest('[data-cart-toggle], [data-product-form]')) warm(); });

// Header cart icon opens the drawer instead of navigating
document.addEventListener('click', async (e) => {
  const toggle = e.target.closest('[data-cart-toggle]');
  if (!toggle || !cartRoot()) return;
  e.preventDefault();
  const mod = await loadSideCart();
  mod ? mod.open() : (location.href = toggle.href);
});

// AJAX add to cart (product cards + product page)
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-product-form]');
  if (!form) return;
  e.preventDefault();
  const btn = form.querySelector('[type="submit"]');
  btn?.setAttribute('aria-busy', 'true');
  btn?.classList.add('opacity-70');
  const modPromise = loadSideCart(); // start downloading in parallel with the add request
  try {
    const res = await fetch(`${window.Shopify?.routes?.root || '/'}cart/add.js`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form),
    });
    const added = await res.json();
    if (!res.ok) throw new Error(added.description);
    const mod = await modPromise;
    if (mod && cartRoot()?.dataset.openOnAdd !== 'false') {
      mod.open(added);
    } else {
      mod?.refresh();
      const cart = await (await fetch(`${window.Shopify?.routes?.root || '/'}cart.js`)).json();
      document.querySelectorAll('[data-cart-count]').forEach((el) => {
        el.textContent = cart.item_count;
        el.classList.toggle('hidden', cart.item_count === 0);
      });
    }
  } catch (err) {
    form.submit();
  } finally {
    btn?.removeAttribute('aria-busy');
    btn?.classList.remove('opacity-70');
  }
});

// Simple local wishlist (swap for an app/metafield later)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-wishlist]');
  if (!btn) return;
  let list = [];
  try { list = JSON.parse(localStorage.getItem('pp-wishlist') || '[]'); } catch {}
  const h = btn.dataset.wishlist;
  list = list.includes(h) ? list.filter((x) => x !== h) : [...list, h];
  try { localStorage.setItem('pp-wishlist', JSON.stringify(list)); } catch {}
  btn.setAttribute('aria-pressed', String(list.includes(h)));
});
