import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.js',
      userscript: {
        name: 'Amazon 编辑助手（含顶部广告移除）',
        namespace: 'http://tampermonkey.net/',
        version: '2026.04.02.1',
        description:
          'Inline editing helper for Amazon pages with selector-based persistence, image uploads, and top banner ad removal.',
        author: 'rirh',
        include: ['*://amazon.*/*', '*://*.amazon.*/*'],
        grant: ['GM_addStyle', 'GM_getValue', 'GM_setValue', 'unsafeWindow'],
        'run-at': 'document-start',
        updateURL:
          'https://gist.githubusercontent.com/rirh/2ec7da0d3eeeafaef645016d1a3cbe56/raw/amaon.user.js',
        downloadURL:
          'https://gist.githubusercontent.com/rirh/2ec7da0d3eeeafaef645016d1a3cbe56/raw/amaon.user.js'
      },
      build: {
        fileName: 'amazon.user.js',
        metaFileName: true
      }
    })
  ]
});
