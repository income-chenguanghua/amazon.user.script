# Repository Guidelines

## Project Structure & Module Organization

This is a Vite + `vite-plugin-monkey` Tampermonkey userscript for Amazon page editing.

- `src/main.js` is the userscript entry point and bootstraps the editor on Amazon retail hosts.
- `src/core/` contains editor behavior, storage, notifications, DOM watching, image editing, and lifecycle helpers.
- `src/features/` contains page-level features such as top ad cleanup and selector resolvers.
- `src/config/` stores field configuration defaults.
- `src/styles/` injects editor UI styles.
- `vite.config.ts` defines userscript metadata, grants, CDN update/download URLs, and output names.
- `dist/amazon.user.js` and `dist/amazon.meta.js` are generated release artifacts and are intentionally committed for CDN/Tampermonkey installation.

There is no dedicated test directory at present.

## Build, Test, and Development Commands

- `pnpm install`: install dependencies using the pinned pnpm package manager.
- `pnpm run dev`: start the Vite development server for local userscript development.
- `pnpm run build`: build `dist/amazon.user.js` and `dist/amazon.meta.js`.
- `pnpm run typecheck`: run TypeScript checking without emitting files.
- `make`: update `package.json` version using an Asia/Shanghai timestamp format like `26.516.2110`.
- `make deploy`: update version, build, typecheck, commit, push, and purge jsDelivr cache.
- `make print-cdn`: print install and purge URLs for the current CDN paths.

## Coding Style & Naming Conventions

Use ES modules and keep imports explicit with `.js` extensions for local source files. Follow the existing style in `src/`: 4-space indentation in JavaScript modules, semicolons, single quotes, `camelCase` variables/functions, and `PascalCase` classes such as `InlineEditManager`.

Keep browser/Tampermonkey-specific logic close to the module that needs it. Prefer small helpers in `src/core/` over expanding `src/main.js`.

## Testing Guidelines

No automated unit test framework is configured yet. Before submitting changes, run:

```bash
pnpm run typecheck
pnpm run build
```

For behavior changes, manually install or update `dist/amazon.user.js` in Tampermonkey and verify on matching Amazon pages. Check that saved edits, reset behavior, title editing, image replacement, toolbar visibility, and top ad removal still work when touched.

## Commit & Pull Request Guidelines

Recent history uses short messages such as `bump version 26.417.1729` and Chinese summaries describing the change plus version updates. Keep commits concise and specific; include the version when creating a release commit.

Pull requests should include a short description, affected UI/behavior, manual verification notes, and screenshots or screen recordings for visible editor changes. Mention whether `dist/` was rebuilt and whether CDN purge is needed after merge.
