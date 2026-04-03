import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import packageJson from './package.json';

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.js',
      userscript: {
        name: 'Amazon 编辑助手（含顶部广告移除）',
        namespace: 'http://tampermonkey.net/',
        version: packageJson.version,
        description:
          'Inline editing helper for Amazon pages with selector-based persistence, image uploads, and top banner ad removal.',
        author: 'rirh',
        include: ['*://amazon.*/*', '*://*.amazon.*/*'],
        grant: ['GM_addStyle', 'GM_getValue', 'GM_setValue', 'unsafeWindow'],
        'run-at': 'document-start',
        updateURL:
          'https://cdn.jsdelivr.net/gh/income-chenguanghua/amazon.user.script/dist/amazon.meta.js',
        downloadURL:
          'https://cdn.jsdelivr.net/gh/income-chenguanghua/amazon.user.script/dist/amazon.user.js'
      },
      build: {
        fileName: 'amazon.user.js',
        metaFileName: true
      }
    })
  ]
});
