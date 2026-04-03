# Amazon Inline Editor

这是一个基于 `Vite + vite-plugin-monkey` 的 Amazon 油猴脚本项目，用来在 Amazon 页面上做轻量级可视化修改与持久化回填。

当前脚本已经支持：

- 自动移除 Amazon 顶部广告位
- 页面文本直接编辑
- 图片替换并持久化
- 评论数 `#acrCustomerReviewText` 修改
- 页面标题 `document.title` 弹窗修改
- 退款行显示/隐藏切换
- 右下角常驻工具栏

## 项目结构

- `src/main.js`
  脚本主入口，当前核心逻辑都在这里
- `vite.config.ts`
  userscript 元数据、构建入口、更新地址配置
- `dist/amazon.user.js`
  最终安装到油猴的脚本文件
- `dist/amazon.meta.js`
  仅包含元数据的更新检查文件
- `legacy/amazon.user.legacy.js`
  旧版单文件脚本备份

## 本地开发

安装依赖：

```bash
pnpm install
```

开发模式：

```bash
pnpm run dev
```

更新时间版本号：

```bash
make
```

上面的默认目标会按 `Asia/Shanghai` 时区生成 `YY.MD.HHmm` 版本号，例如 `26.42.1633`。

构建：

```bash
pnpm run build
```

类型检查：

```bash
pnpm run typecheck
```

## 如何在 Tampermonkey 中使用

### 方式一：直接安装仓库产物

1. 先安装浏览器扩展 `Tampermonkey`
2. 打开下面这个地址：

```text
https://cdn.jsdelivr.net/gh/income-chenguanghua/amazon.user.script/dist/amazon.user.js
```

3. Tampermonkey 会弹出安装页
4. 点击安装即可

### 方式二：手动导入

1. 打开 Tampermonkey 面板
2. 新建脚本，或者选择“导入”
3. 将 `dist/amazon.user.js` 的内容粘贴进去
4. 保存

## 安装后怎么用

安装完成后，进入任意匹配的 Amazon 页面，右下角会直接显示一排工具按钮。

- 点击 `编辑`：进入页面内联编辑模式
- 点击 `修改标题`：弹窗输入新的网页标题
- 点击 `隐藏退款行`：切换退款总计行显示状态
- 点击 `重置`：清空当前页面已保存修改并刷新
- 点击 `隐藏按钮`：隐藏工具按钮，之后可在控制台执行 `show()` 恢复

编辑模式下：

- 文本可直接改
- 图片左键保留预览，点右上角 `换` 替换图片
- 点击 `完成` 保存当前修改

## 更新地址与最佳实践

当前配置：

- `downloadURL`
  指向完整脚本：
  `https://cdn.jsdelivr.net/gh/income-chenguanghua/amazon.user.script/dist/amazon.user.js`
- `updateURL`
  指向轻量元数据：
  `https://cdn.jsdelivr.net/gh/income-chenguanghua/amazon.user.script/dist/amazon.meta.js`

这是更推荐的做法：

- `updateURL` 只用于检查是否有新版本，文件越小越好
- `downloadURL` 才用于真正下载安装完整脚本
- 每次发布新版本时，务必更新 `@version`

### 这种方式会不会有缓存

会，任何走 jsDelivr CDN 或浏览器网络层的方式，都可能遇到缓存。

不过正常情况下，只要你做了下面几件事，更新会比较稳定：

1. 每次发布都递增 `@version`
2. `updateURL` 指向 `amazon.meta.js`，减小更新检查体积
3. `downloadURL` 指向完整的 `amazon.user.js`
4. 每次改完后重新构建，并把 `dist/amazon.user.js` 和 `dist/amazon.meta.js` 一起提交
5. 如果你想让发布更稳，后续可以考虑改成 GitHub Release 附件地址，而不是长期直接指向 `main`

### 如果已经更新了仓库，但 Tampermonkey 没检测到

可以按这个顺序排查：

1. 确认 `dist/amazon.user.js` 和 `dist/amazon.meta.js` 都已经推到远端
2. 确认 `@version` 已经递增
3. 在 Tampermonkey 里手动执行一次检查更新
4. 仍然不生效时，直接重新打开 `amazon.user.js` 安装地址覆盖安装一次

## 发布流程建议

每次发版建议按下面流程走：

```bash
make
make deploy
git add Makefile package.json pnpm-lock.yaml vite.config.ts dist/amazon.user.js dist/amazon.meta.js src/main.js README.md
git commit -m "chore: release userscript"
git push
```

## 备注

- userscript 元数据统一维护在 `vite.config.ts`
- 当前主逻辑仍在 `src/main.js`，这是为了先稳定迁移，再逐步模块化
- 如果后续功能继续增长，建议下一步把 `src/main.js` 拆成“存储 / 选择器 / 编辑器 / 面板 UI”几个模块
