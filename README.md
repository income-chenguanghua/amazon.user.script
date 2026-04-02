# Amazon Inline Editor

这是一个使用 Vite + vite-plugin-monkey 重新搭建的 Amazon 油猴脚本项目。

当前迁移策略是：先把原有功能完整搬进 Vite 工程，再逐步做模块化和 TypeScript 化，避免一次性重构把脚本行为改坏。

## 当前状态

- 原始单文件脚本已保存在 `legacy/amazon.user.legacy.js`
- 当前开发入口改为 `src/main.js`
- userscript 元数据统一维护在 `vite.config.ts`
- 已验证可以正常构建出 `dist/amazon.user.js`

## 命令

```bash
npm install
npm run dev
npm run build
npm run typecheck
```

## 产物

构建后输出到：

- `dist/amazon.user.js`
- `dist/amazon.meta.js`

## 后续建议

如果你接下来要继续演进这个脚本，推荐按下面顺序做：

1. 先把 `src/main.js` 按“广告移除 / 字段配置 / 持久化 / 编辑器 UI”拆成模块
2. 再逐步把核心模块迁到 TypeScript
3. 最后再决定是否要引入 React 或更复杂的面板 UI
