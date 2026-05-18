# Amazon Inline Editor

<p align="left">
  <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" alt="Vite 7" />
  <img src="https://img.shields.io/badge/vite--plugin--monkey-7-111827" alt="vite-plugin-monkey 7" />
  <img src="https://img.shields.io/badge/Tampermonkey-userscript-00485B?logo=tampermonkey&logoColor=white" alt="Tampermonkey userscript" />
  <img src="https://img.shields.io/badge/TypeScript-checking-3178C6?logo=typescript&logoColor=white" alt="TypeScript checking" />
  <img src="https://img.shields.io/badge/pnpm-orange?logo=pnpm&logoColor=white" alt="pnpm" />
</p>

Amazon Inline Editor 是一个基于 Vite + `vite-plugin-monkey` 的 Tampermonkey 用户脚本，用来在 Amazon 页面上做轻量级可视化修改、图片替换、标题修改和本地持久化回填。

脚本产物直接提交在 `dist/`，方便 Tampermonkey 安装和更新。因为 jsDelivr 这类 CDN 经常出现缓存延迟，本项目不再使用 CDN 地址作为安装或更新入口。

## ✨ 功能特性

- 🧹 **顶部广告清理**：自动移除 Amazon 顶部广告位，降低页面干扰。
- ✍️ **页面文本编辑**：进入编辑模式后，可直接修改订单、商品、品牌、卖家、配送、费用等页面字段。
- 🏷️ **商品概览字段**：支持 Amazon 商品页中的品牌、制造商等 `topHighlight` / `productOverview` 信息修改。
- 🖼️ **图片替换**：支持订单商品图、商品主图、缩略图和卡片图替换，并保存到当前页面。
- 🔢 **评论数修改**：支持 `#acrCustomerReviewText` 弹窗修改。
- 🧭 **网页标题修改**：支持通过弹窗修改当前页面 `document.title`。
- 💸 **退款行切换**：支持隐藏或显示退款总计行。
- 💾 **本地持久化**：使用 Tampermonkey 存储保存每个页面的修改结果，刷新后自动回填。
- 🛠️ **常驻工具栏**：右下角提供编辑、完成、重置、修改标题、隐藏按钮等常用操作。

---

## 🎯 使用说明

1. **安装脚本**：推荐直接打开 GitHub raw 产物地址安装：

```text
https://raw.githubusercontent.com/income-chenguanghua/amazon.user.script/main/dist/amazon.user.js
```

2. **进入页面**：打开任意匹配的 Amazon 页面，右下角会显示工具按钮。
3. **开始编辑**：点击 `编辑`，页面中可修改的字段会进入内联编辑状态。
4. **修改文本**：直接点击文本内容编辑；部分字段会通过 `改` 按钮弹窗修改。
5. **替换图片**：图片左键仍可预览，点击右上角 `换` 选择本地图片替换。
6. **保存修改**：点击 `完成`，当前页面的修改会保存到 Tampermonkey 存储。
7. **恢复页面**：点击 `重置` 会清空当前页面保存值并刷新。
8. **隐藏工具栏**：点击 `隐藏按钮` 后，如需恢复，可在控制台执行 `show()`。

---

## 🛠️ 本地开发

### 环境要求

- Node.js 18 或更高版本
- pnpm（推荐）或 npm
- 已安装 Tampermonkey 的浏览器

### 安装依赖

```bash
pnpm install
```

### 启动开发模式

```bash
pnpm run dev
```

### 类型检查

```bash
pnpm run typecheck
```

### 构建生产脚本

```bash
pnpm run build
```

构建后会生成：

- `dist/amazon.user.js`：Tampermonkey 安装用完整脚本
- `dist/amazon.meta.js`：Tampermonkey 更新检查用元数据

### 更新时间版本号

```bash
make
```

默认目标会按 Asia/Shanghai 时区生成 `YY.MD.HHmm` 版本号，例如 `26.516.2110`。

---

## 🚀 发布流程

每次发版建议使用：

```bash
make deploy
```

`make deploy` 会依次执行：

1. 更新 `package.json` 版本号
2. 构建 `dist/amazon.user.js` 和 `dist/amazon.meta.js`
3. 运行 TypeScript 检查
4. `git add -A`
5. 创建提交
6. 推送到远端

默认提交信息是 `bump version <VERSION>`。如需自定义：

```bash
make deploy COMMIT_MSG="更新商品概览字段"
```

如需查看当前安装和更新地址：

```bash
make print-install
```

### 关于 CDN

本项目不再使用 jsDelivr CDN 安装或更新脚本。原因是 CDN 和浏览器网络层都可能缓存 `main` 分支下的旧产物，即使已经推送新版本，也可能出现 Tampermonkey 长时间拿不到最新脚本的情况。

当前推荐使用 GitHub raw 地址：

- 完整脚本：`https://raw.githubusercontent.com/income-chenguanghua/amazon.user.script/main/dist/amazon.user.js`
- 更新元数据：`https://raw.githubusercontent.com/income-chenguanghua/amazon.user.script/main/dist/amazon.meta.js`

如果 Tampermonkey 没有自动更新，优先确认 `@version` 已递增，并直接打开完整脚本 raw 地址覆盖安装。

---

## 📁 项目结构

```text
src/
├── main.js              # userscript 入口，初始化存储、观察器、编辑器和工具栏
├── config/              # 默认可编辑字段配置
├── core/                # 编辑生命周期、存储、回填、图片编辑、DOM 观察和工具方法
├── features/            # 页面级功能，如顶部广告清理和字段解析器
└── styles/              # 编辑器 UI 样式注入

dist/
├── amazon.user.js       # 构建后的完整 userscript
└── amazon.meta.js       # 构建后的更新元数据
```

---

## 📦 技术栈

- [Vite](https://vite.dev/) - 前端构建工具
- [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) - userscript 构建和元数据生成
- [Tampermonkey](https://www.tampermonkey.net/) - 用户脚本运行环境
- [TypeScript](https://www.typescriptlang.org/) - 类型检查
- [pnpm](https://pnpm.io/) - 包管理器

---

## 🤝 贡献

提交前建议运行：

```bash
pnpm run typecheck
pnpm run build
```

如果改动了可见页面行为，请在匹配的 Amazon 页面上手动验证：保存回填、重置、标题修改、图片替换、工具栏显示隐藏和顶部广告移除是否正常。

## 📄 许可证

当前仓库未包含独立许可证文件。使用、分发或二次开发前，请先与仓库维护者确认授权方式。
