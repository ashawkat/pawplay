# PawPlay — Shopify theme

Online Store 2.0 theme built from the PawPlay Figma design. Tailwind CSS v4 compiled to `assets/app.css`.

## Develop

```bash
npm install
npm run build                       # CSS (Tailwind) + side cart (Vue/Vite)
npm run watch                       # rebuild CSS on change
npm run watch:js                    # rebuild side cart on change
shopify theme dev --store your-dev-store.myshopify.com
```

`assets/app.css` is committed so the theme works straight from GitHub (no build step on Shopify).
**Run `npm run build` before every commit** that touches Tailwind classes.

## Deploy to a dev store via GitHub

1. Push this folder to a GitHub repo (`src/`, `package.json` are ignored by Shopify through `.shopifyignore`).
2. Shopify admin → Online Store → Themes → Add theme → **Connect from GitHub** → pick repo + branch.
3. Or push with the CLI: `shopify theme push --unpublished --store your-dev-store.myshopify.com`

## One-time store setup

| What | Where |
| --- | --- |
| Menus `main-menu`, `footer` | Content → Menus |
| Filters (brand, price, rating, pet type) | Install **Shopify Search & Discovery**, add filters |
| Pages: About, Contact, Services, Book a Service | Create pages, assign templates `page.about`, `page.contact`, `page.services`, `page.book-a-service` |
| Pages: My pets, Bookings, Wishlist | Create pages with handles `my-pets`, `bookings`, `wishlist`, templates `page.my-pets`, `page.bookings`, `page.wishlist` |
| Customer accounts | Settings → Customer accounts → **Classic** accounts (theme templates for sign in / profile) |
| Ratings on cards | Any review app that writes `reviews.rating` + `reviews.rating_count` metafields |
| Card badge ("New", "Popular") | Product metafield `custom.badge` (single line text) |
| My pets data | Customer metafield `custom.pets` (JSON) |
| Bookings data | Customer metafield `custom.bookings` (JSON) |

Booking requests and contact messages arrive by email through Shopify's contact form (tagged `booking`).

## Structure

- `sections/` — every page block is a section with settings, blocks and presets (editable in the customizer)
- `snippets/` — product card, article card, icons, page banner, account nav, form fields
- `assets/theme.js` — drawer, scroll rows, slideshow, AJAX add to cart, wishlist toggle
- `assets/components.js` — collection filters, gallery, variant picker, recommendations, tabs, booking steps, wishlist page
- `src/app.css` — Tailwind entry; tokens map to theme settings (Theme settings → Colors / Typography)

## Side cart (Vue 3)

- Source: `src/side-cart/` (`SideCart.vue`, `api.js`, `main.js`) → built by Vite to `assets/side-cart.js` (~30 KB gzip).
- **Not loaded on page load.** `theme.js` dynamically imports it on first intent: hovering/tapping the cart icon,
  touching an add-to-cart form, or submitting one. So it has zero effect on LCP/TBT in PageSpeed.
- Features: slide-in drawer, optimistic qty updates, remove, free-shipping progress, product recommendations with
  one-tap add, order note, discounts, focus trap + Esc + screen-reader announcements.
- Settings: Theme settings → Cart & products (drawer vs page, open on add, free-shipping threshold, upsell, note).

## Performance notes

- One render-blocking stylesheet (`app.css`, ~11 KB gzip); all JS is `defer` or lazy.
- Hero image: `fetchpriority="high"`, responsive `srcset`; everything else lazy-loads with explicit sizes.
- Fonts from Shopify's CDN with `font-display: swap` + preload.
- Speculation Rules prerender internal links on hover for near-instant navigation (Chrome).
- What usually costs points on a real store: third-party apps/pixels, large unoptimised images, and
  embedded videos/maps — audit those before chasing the last few points.
