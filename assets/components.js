/* PawPlay — interactive components (filters, gallery, variants, tabs, booking, wishlist) */
const ppRoot = () => window.Shopify?.routes?.root || '/';
const ppMoney = (cents) => {
  const fmt = window.PawPlay?.moneyFormat || '${{amount}}';
  const amount = (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fmt.replace(/\{\{\s*amount[a-z_]*\s*\}\}/, amount);
};
const ppStr = (k, d) => window.PawPlay?.strings?.[k] || d;

/* ---------- Quantity +/- ---------- */
class QuantityInput extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('input');
    this.addEventListener('click', (e) => {
      const b = e.target.closest('[data-qty]');
      if (!b) return;
      const min = Number(this.input.min || 0);
      this.input.value = Math.max(min, Number(this.input.value || 0) + Number(b.dataset.qty));
      this.input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
}
customElements.get('quantity-input') || customElements.define('quantity-input', QuantityInput);

// Cart page: auto-update on quantity change
document.addEventListener('change', (e) => {
  if (e.target.matches('[data-cart-qty]')) {
    clearTimeout(window.__ppCartT);
    window.__ppCartT = setTimeout(() => e.target.form?.submit(), 500);
  }
});

/* ---------- Collection filters (Section Rendering API) ---------- */
class CollectionFilters extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('[data-filter-form]');
    this.addEventListener('change', (e) => {
      if (!e.target.closest('[data-filter-form]') && e.target.getAttribute('form') !== 'FilterForm') return;
      clearTimeout(this.t);
      this.t = setTimeout(() => this.update(), e.target.type === 'number' ? 600 : 50);
    });
    this.addEventListener('click', (e) => {
      if (e.target.closest('[data-toggle-filters]')) this.querySelector('[data-filters-panel]')?.classList.toggle('hidden');
    });
    window.addEventListener('popstate', () => this.render(location.search.slice(1), false));
  }
  update() {
    const fd = new FormData(this.form);
    const sort = this.querySelector('select[name="sort_by"]');
    if (sort) fd.set('sort_by', sort.value);
    const params = new URLSearchParams();
    for (const [k, v] of fd) if (v !== '') params.append(k, v);
    this.render(params.toString(), true);
  }
  async render(query, push) {
    this.style.opacity = '0.5';
    try {
      const html = await (await fetch(`${location.pathname}?section_id=${this.dataset.section}&${query}`)).text();
      const next = new DOMParser().parseFromString(html, 'text/html').querySelector('collection-filters');
      if (next) {
        const panelOpen = this.querySelector('[data-filters-panel]')?.classList.contains('hidden') === false;
        this.innerHTML = next.innerHTML;
        if (panelOpen) this.querySelector('[data-filters-panel]')?.classList.remove('hidden');
        this.form = this.querySelector('[data-filter-form]');
      }
      if (push) history.pushState({}, '', `${location.pathname}${query ? '?' + query : ''}`);
    } catch (err) {
      location.search = query;
    } finally {
      this.style.opacity = '';
    }
  }
}
customElements.get('collection-filters') || customElements.define('collection-filters', CollectionFilters);

/* ---------- Product gallery ---------- */
class MediaGallery extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', (e) => {
      const t = e.target.closest('[data-thumb]');
      if (t) this.show(t.dataset.thumb);
    });
  }
  show(id) {
    id = String(id);
    if (!this.querySelector(`[data-media="${id}"]`)) return;
    this.querySelectorAll('[data-media]').forEach((m) => m.classList.toggle('hidden', m.dataset.media !== id));
    this.querySelectorAll('[data-thumb]').forEach((t) => {
      const on = t.dataset.thumb === id;
      t.classList.toggle('border-primary', on);
      t.classList.toggle('border-transparent', !on);
    });
  }
}
customElements.get('media-gallery') || customElements.define('media-gallery', MediaGallery);

/* ---------- Variant picker ---------- */
class VariantPicker extends HTMLElement {
  connectedCallback() {
    this.variants = JSON.parse(this.querySelector('[data-variant-json]')?.textContent || '[]');
    this.section = this.closest('product-info') || document;
    this.addEventListener('change', () => this.onChange());
  }
  onChange() {
    const fieldsets = [...this.querySelectorAll('fieldset')];
    const selected = fieldsets.map((fs) => fs.querySelector('input:checked')?.value);
    const variant = this.variants.find((v) => v.options.every((o, i) => o === selected[i]));

    fieldsets.forEach((fs, i) => {
      const lbl = fs.querySelector('[data-option-value]');
      if (lbl) lbl.textContent = selected[i];
      fs.querySelectorAll('input').forEach((inp) => {
        const label = fs.querySelector(`label[for="${inp.id}"]`);
        if (!label) return;
        if (label.style.background) {
          label.classList.toggle('ring-2', inp.checked);
          label.classList.toggle('ring-primary', inp.checked);
        } else {
          ['border-primary', 'bg-primary/10', 'text-primary'].forEach((c) => label.classList.toggle(c, inp.checked));
          label.classList.toggle('border-divider', !inp.checked);
        }
      });
    });

    const btn = this.section.querySelector('[data-add-button]');
    const lbl = this.section.querySelector('[data-add-label]');
    if (!variant) {
      if (btn) btn.disabled = true;
      if (lbl) lbl.textContent = ppStr('unavailable', 'Unavailable');
      return;
    }
    this.section.querySelectorAll('[data-variant-id], #ProductInstallments input[name="id"]').forEach((i) => (i.value = variant.id));
    if (btn) btn.disabled = !variant.available;
    if (lbl) lbl.textContent = variant.available ? `${ppStr('addToCart', 'Add to cart')} – ${ppMoney(variant.price)}` : ppStr('soldOut', 'Sold out');

    const price = this.section.querySelector('[data-price]');
    if (price) {
      const sale = variant.compare_at_price > variant.price;
      price.innerHTML = `<span class="text-3xl font-bold text-primary">${ppMoney(variant.price)}</span>` +
        (sale ? `<s class="text-2xl text-[#b6b6b6]">${ppMoney(variant.compare_at_price)}</s>` : '');
    }
    const stock = this.section.querySelector('[data-stock]');
    if (stock) {
      stock.textContent = variant.available ? `✓ ${ppStr('inStock', 'In stock')}` : ppStr('soldOut', 'Sold out');
      stock.classList.toggle('text-primary', !variant.available);
      stock.classList.toggle('text-[#23b96f]', variant.available);
    }
    if (variant.featured_media) this.section.querySelector('media-gallery')?.show(variant.featured_media.id);
    const url = new URL(location.href);
    url.searchParams.set('variant', variant.id);
    history.replaceState({}, '', url);
  }
}
customElements.get('variant-picker') || customElements.define('variant-picker', VariantPicker);

/* ---------- Product recommendations (lazy) ---------- */
class ProductRecommendations extends HTMLElement {
  connectedCallback() {
    const io = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      try {
        const html = await (await fetch(this.dataset.url)).text();
        const next = new DOMParser().parseFromString(html, 'text/html').querySelector('product-recommendations');
        if (next?.innerHTML.trim()) this.innerHTML = next.innerHTML;
      } catch (e) { /* leave empty */ }
    }, { rootMargin: '0px 0px 400px 0px' });
    io.observe(this);
  }
}
customElements.get('product-recommendations') || customElements.define('product-recommendations', ProductRecommendations);

/* ---------- Tabs ---------- */
class TabGroup extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', (e) => {
      const tab = e.target.closest('[role="tab"]');
      if (!tab) return;
      this.querySelectorAll('[role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      this.querySelectorAll('[role="tabpanel"]').forEach((p) => p.classList.toggle('hidden', p.id !== tab.getAttribute('aria-controls')));
    });
  }
}
customElements.get('tab-group') || customElements.define('tab-group', TabGroup);

/* ---------- Booking steps ---------- */
class BookingSteps extends HTMLElement {
  connectedCallback() {
    this.steps = [...this.querySelectorAll('[data-step]')];
    if (!this.steps.length) return;
    this.i = 0;
    this.querySelector('[data-next-step]')?.addEventListener('click', () => this.go(1));
    this.querySelector('[data-prev-step]')?.addEventListener('click', () => this.go(-1));
    this.paint();
  }
  go(d) {
    if (d > 0) {
      const invalid = [...this.steps[this.i].querySelectorAll('input,select,textarea')].find((f) => !f.checkValidity());
      if (invalid) { invalid.reportValidity(); return; }
    }
    this.i = Math.min(this.steps.length - 1, Math.max(0, this.i + d));
    this.paint();
  }
  paint() {
    this.steps.forEach((s, k) => s.classList.toggle('hidden', k !== this.i));
    this.querySelectorAll('[data-step-indicator]').forEach((el, k) => el.toggleAttribute('data-active', k <= this.i));
    const last = this.i === this.steps.length - 1;
    this.querySelector('[data-prev-step]')?.classList.toggle('invisible', this.i === 0);
    this.querySelector('[data-next-step]')?.classList.toggle('hidden', last);
    this.querySelector('[data-submit-step]')?.classList.toggle('hidden', !last);
  }
}
customElements.get('booking-steps') || customElements.define('booking-steps', BookingSteps);

/* ---------- Wishlist page ---------- */
const ppWishlist = () => { try { return JSON.parse(localStorage.getItem('pp-wishlist') || '[]'); } catch (e) { return []; } };
class WishlistGrid extends HTMLElement {
  async connectedCallback() {
    const grid = this.querySelector('[data-wishlist-grid]');
    const empty = this.querySelector('[data-wishlist-empty]');
    const list = ppWishlist();
    if (!list.length) { empty.classList.remove('hidden'); return; }
    const cards = await Promise.all(list.map(async (h) => {
      try {
        const r = await fetch(`${ppRoot()}products/${encodeURIComponent(h)}?view=card&section_id=main`);
        return r.ok ? `<li>${await r.text()}</li>` : '';
      } catch (e) { return ''; }
    }));
    grid.innerHTML = cards.join('');
    if (!grid.children.length) empty.classList.remove('hidden');
  }
}
customElements.get('wishlist-grid') || customElements.define('wishlist-grid', WishlistGrid);

const ppPaintHearts = () => {
  const list = ppWishlist();
  document.querySelectorAll('[data-wishlist]').forEach((b) => b.setAttribute('aria-pressed', String(list.includes(b.dataset.wishlist))));
};
ppPaintHearts();
document.addEventListener('click', (e) => { if (e.target.closest('[data-wishlist]')) setTimeout(ppPaintHearts, 0); });

// Address forms: preselect saved country
document.querySelectorAll('select[data-default]').forEach((s) => { if (s.dataset.default) s.value = s.dataset.default; });
