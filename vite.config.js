import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Builds the Vue side cart into ONE minified ES module: assets/side-cart.js.
// theme.js lazy-imports it on first cart interaction, so it never affects first paint.
export default defineConfig({
  plugins: [vue()],
  publicDir: false,
  define: {
    __VUE_OPTIONS_API__: 'false',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
  build: {
    outDir: 'assets',
    emptyOutDir: false,
    target: 'es2020',
    minify: 'terser',
    terserOptions: { compress: { passes: 2 }, format: { comments: false } },
    cssCodeSplit: false,
    modulePreload: false,
    copyPublicDir: false,
    rollupOptions: {
      input: 'src/side-cart/main.js',
      preserveEntrySignatures: 'exports-only',
      output: {
        format: 'es',
        entryFileNames: 'side-cart.js',
        inlineDynamicImports: true,
      },
    },
  },
});
