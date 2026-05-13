# 项目总览

## 1. 项目定位

`fund-tracker` 是一个纯前端基金持仓跟踪工具，目标是围绕“当前持仓”提供以下能力：

- 管理基金持仓列表
- 按板块/分组组织持仓
- 拉取基金估值与官方净值
- 计算持有金额、当日收益、累计收益等指标
- 展示单只基金详情，包括阶段表现和缓存状态
- 通过交易同步更新份额与成本

该项目没有后端目录、数据库层或服务端 API，全部逻辑在浏览器端完成。

## 2. 技术栈

| 类别 | 方案 | 说明 |
| --- | --- | --- |
| UI 框架 | React 19 | 单页应用渲染与状态管理 |
| 构建工具 | Vite 8 | 开发服务器、打包与预览 |
| 样式 | Tailwind CSS 4 | 通过 `@tailwindcss/vite` 集成 |
| 图标 | lucide-react | 工具栏、按钮和状态图标 |
| 拖拽排序 | SortableJS | 分组拖拽排序 |
| 图表 | ECharts | 已安装依赖，但当前主代码未见实际接入 |
| 代码质量 | ESLint 9 | 基础 JS、React Hooks、React Refresh 规则 |

## 3. 目录结构

```text
fund-tracker/
├─ public/                  # 静态资源
├─ src/
│  ├─ assets/               # 图片资源
│  ├─ App.jsx               # 主业务入口与主要 UI
│  ├─ fundDetails.js        # 详情缓存与详情模型
│  ├─ index.css             # 全局样式入口
│  ├─ App.css               # 当前仅保留 Tailwind import
│  └─ main.jsx              # React 挂载入口
├─ docs/
│  └─ code-wiki/            # 本套 Code Wiki 文档
├─ index.html               # SPA 容器
├─ package.json             # 脚本与依赖
├─ vite.config.js           # Vite 与 Tailwind 插件配置
├─ eslint.config.js         # ESLint 配置
└─ README.md                # 当前仍为 Vite 模板说明
```

## 4. 入口链路

项目启动链路非常直接：

```text
index.html
  -> src/main.jsx
    -> <App />
      -> FundTrackerApp()
```

对应职责如下：

- `index.html`
  - 提供 `#root` 挂载点
  - 通过模块脚本加载 `src/main.jsx`
- `src/main.jsx`
  - 调用 `createRoot(...).render(...)`
  - 注入全局样式并挂载根组件
- `src/App.jsx`
  - 导出 `FundTrackerApp`
  - 是实际业务入口，包含状态初始化、数据刷新、弹窗、表格、详情页和设置逻辑

## 5. 核心业务对象

项目虽然没有显式定义 TypeScript 类型，但运行时围绕以下几类对象展开：

### 5.1 基金持仓对象 `fund`

典型字段包括：

- `id`: 本地唯一标识
- `name`: 基金名称
- `code`: 6 位基金代码
- `sector`: 所属分组
- `amount`: 当前持有金额
- `shares`: 当前份额
- `costAmount`: 总成本
- `currentNetValue`: 当前估值或最新净值
- `lastNetValue`: 上一个参考净值
- `officialCurrentNetValue`: 官方最新净值
- `officialLastNetValue`: 官方前一日净值
- `dailyProfit`: 当日收益
- `totalProfit`: 持有总收益
- `quoteSource`: 当前净值来源，可能为 `estimate` / `quote`
- `holdingStartDate`: 持有起始日期

### 5.2 详情缓存对象 `detailEntry`

`fundDetails.js` 中定义的详情缓存条目包含：

- `code`
- `fetchedAt`
- `quote`
- `officialHistory`
- `remoteThemes`

它不直接替代主列表数据，而是专门服务于基金详情面板。

## 6. 架构特征

这个仓库最明显的特点是“单组件主业务 + 单文件领域辅助”：

- `FundTrackerApp` 既是页面容器，也是状态中心和业务编排中心
- 远端数据请求写在 `App.jsx` 中，而不是单独的 service 层目录
- 详情模型的纯计算逻辑被抽到 `fundDetails.js`
- 全局状态没有外部状态库，完全依赖 React 内建 hooks
- 数据持久化完全依赖浏览器 `localStorage`

## 7. 当前实现边界

从现有代码可以看出，项目已经形成主流程，但仍有一些功能处于“占位或轻实现”状态：

- 导入弹窗只有界面，没有真正的文件解析与写入逻辑
- 导出弹窗只有界面，没有实际文件生成逻辑
- 交易记录弹窗使用 `generateMockHistory()` 生成模拟数据，不是来自真实持久化记录
- 已安装 `echarts`，但当前主文件未看到图表渲染代码
- README 尚未替换为项目自己的业务文档

## 8. 适合二次开发的切入点

如果后续继续演进，建议优先关注以下方向：

1. 从 `App.jsx` 中拆分服务层、表格区和弹窗区
2. 为基金对象与详情对象补充显式类型定义
3. 把导入、导出、真实交易记录持久化补齐
4. 为 JSONP 请求与本地缓存增加更清晰的错误边界
5. 增加自动化测试，至少覆盖快照计算和交易同步逻辑
