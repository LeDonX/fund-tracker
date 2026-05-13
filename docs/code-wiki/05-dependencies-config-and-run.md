# 依赖、配置与运行方式

## 1. 安装与运行

### 1.1 环境要求

仓库未在 `package.json` 中显式声明 `engines`，但从锁文件对应的 Vite 与插件版本推断，建议环境为：

- Node.js `20.19+` 或 `22.12+`
- npm 最新稳定版

### 1.2 安装依赖

```bash
npm install
```

### 1.3 启动开发环境

```bash
npm run dev
```

启动后由 Vite 提供开发服务器。

### 1.4 构建生产版本

```bash
npm run build
```

### 1.5 本地预览构建结果

```bash
npm run preview
```

### 1.6 代码检查

```bash
npm run lint
```

## 2. `package.json` 脚本

| 脚本 | 实际命令 | 作用 |
| --- | --- | --- |
| `dev` | `vite` | 启动本地开发服务器 |
| `build` | `vite build` | 构建生产包 |
| `preview` | `vite preview` | 预览构建结果 |
| `lint` | `eslint .` | 检查 JS / JSX 代码质量 |

## 3. 依赖清单

### 3.1 生产依赖

| 依赖 | 用途 |
| --- | --- |
| `react` | 组件渲染与 hooks |
| `react-dom` | 浏览器端挂载 |
| `@tailwindcss/vite` | Tailwind 与 Vite 集成 |
| `lucide-react` | 图标组件 |
| `sortablejs` | 分组拖拽排序 |
| `echarts` | 图表能力预留，目前主流程未见实际使用 |

### 3.2 开发依赖

| 依赖 | 用途 |
| --- | --- |
| `vite` | 构建与开发服务器 |
| `@vitejs/plugin-react` | React 插件 |
| `tailwindcss` | 原子化样式框架 |
| `postcss` | 样式处理 |
| `autoprefixer` | CSS 前缀处理 |
| `eslint` | 代码检查 |
| `@eslint/js` | ESLint 基础规则 |
| `eslint-plugin-react-hooks` | React hooks 规则 |
| `eslint-plugin-react-refresh` | React Refresh 规则 |
| `globals` | 浏览器全局变量定义 |
| `@types/react` | React 类型声明 |
| `@types/react-dom` | React DOM 类型声明 |

## 4. 配置文件说明

## 4.1 `vite.config.js`

当前配置主要做了两件事：

- 使用 `defineConfig()` 定义 Vite 配置
- 启用 `tailwindcss()` 插件

同时包含了一些更像 Tailwind 配置的字段：

- `content`
- `darkMode`
- `theme.extend`

这说明当前文件兼具了一些 Tailwind 配置语义。若后续升级或规范化，建议考虑按官方推荐方式整理配置边界。

## 4.2 `eslint.config.js`

配置特点：

- 使用 ESLint Flat Config
- 检查 `**/*.{js,jsx}`
- 启用基础 JS 规则
- 启用 React hooks 规则
- 启用 React Refresh 规则
- 忽略 `dist`

自定义规则：

- `no-unused-vars` 忽略以大写字母或下划线开头的变量名

## 4.3 `index.html`

职责：

- 提供 `#root`
- 加载 `src/main.jsx`
- 作为 SPA 唯一 HTML 入口

## 5. 外部接口依赖

项目运行时直接依赖两个外部数据源。

### 5.1 天天基金估值接口

用途：

- 获取基金名称
- 获取盘中估算净值
- 获取最新净值
- 获取估值更新时间

实现方式：

- 动态创建 `<script>`
- 依赖全局回调 `window.jsonpgz`

风险：

- 全局回调天然不适合高并发
- 依赖第三方返回结构稳定性

### 5.2 东财官方净值接口

用途：

- 获取最近两条官方净值
- 获取较长区间的历史净值

实现方式：

- 动态创建 `<script>`
- 读取 `window.apidata.content`
- 用 `DOMParser` 解析 HTML 表格

风险：

- 如果第三方 HTML 结构变化，解析逻辑会失效
- 接口返回不是结构化 JSON，而是 HTML 片段，维护成本较高

## 6. 本地持久化说明

### 6.1 存储内容

| 存储项 | 内容 |
| --- | --- |
| `fundTrackerData` | 当前持仓数组 |
| `fundTrackerSectors` | 当前分组数组 |
| `fundTrackerDetailCacheV1` | 详情缓存对象 |

### 6.2 持久化时机

- 持仓变化后立即持久化
- 分组变化后立即持久化
- 详情缓存变化后立即持久化

### 6.3 恢复策略

- 应用启动时从本地读取
- 读取后统一 normalize
- 无效数据回退默认值

## 7. 测试与质量现状

当前仓库未见：

- `test` 脚本
- Vitest/Jest 配置
- Playwright/Cypress 测试配置
- 业务测试文件

因此当前质量保障主要依赖：

- ESLint 静态检查
- 本地手工验证
- 运行时容错与回退逻辑

建议优先补充的测试方向：

1. `buildFundSnapshot()` 的金额/收益计算
2. `buildDisplayedFund()` 的估值来源切换
3. `applyTradeToFund()` 的买入/卖出/分红规则
4. `buildFundDetailModel()` 的详情指标推导

## 8. 运行注意事项

### 8.1 浏览器环境依赖较强

由于项目直接使用：

- `window`
- `document`
- `localStorage`
- `DOMParser`

因此它不是一个可直接在 Node 端运行的同构项目。

### 8.2 网络可用性会直接影响数据质量

如果第三方接口不可用：

- 列表仍可能使用上次本地快照显示
- 详情页可能回退到旧缓存
- 某些指标会显示 `--`

### 8.3 详情页与列表页故意不完全同口径

这是实现设计，不是 bug：

- 列表更强调“当前展示口径”
- 详情页更强调“字段语义拆分”

## 9. 后续工程化建议

- 为导入/导出增加真实实现与文件格式定义
- 为交易记录补持久化数据结构
- 拆分服务层，减少 `App.jsx` 的运行时耦合
- 为远端接口增加适配层与统一错误对象
- 引入测试框架，覆盖关键领域函数
