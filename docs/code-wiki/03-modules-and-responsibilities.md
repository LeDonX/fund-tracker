# 主要模块与职责

## 1. 模块划分

虽然仓库中文件不多，但从职责上可以拆成以下模块。

| 模块 | 所在文件 | 主要职责 |
| --- | --- | --- |
| 应用入口模块 | `src/main.jsx` | 挂载 React 根组件 |
| 主业务编排模块 | `src/App.jsx` | 管理状态、请求、列表、弹窗、详情和设置 |
| 详情领域模块 | `src/fundDetails.js` | 详情缓存标准化、历史净值整合、详情模型生成 |
| 样式模块 | `src/index.css`、`src/App.css` | 注入 Tailwind 样式 |
| 构建配置模块 | `vite.config.js` | 配置 Vite 与 Tailwind 插件 |
| 质量规则模块 | `eslint.config.js` | 配置 lint 规则 |

## 2. `main.jsx`：应用入口模块

职责非常单一：

- 引入全局样式
- 调用 `createRoot()`
- 在 `StrictMode` 中渲染 `App`

这个文件本身不承载业务逻辑。

## 3. `App.jsx`：主业务编排模块

这是项目的绝对核心模块，承担了以下职责。

### 3.1 UI 结构组织

- 顶部总览 Header
- 工具栏
- 分组表格
- 详情面板
- 新增基金弹窗
- 创建分组弹窗
- 同步交易弹窗
- 导入/导出弹窗
- 交易记录弹窗
- 设置弹窗

### 3.2 本地状态中心

它集中维护：

- 主数据状态 `funds`
- 分组状态 `sectors`
- 详情缓存状态 `detailCacheEntries`
- 各类弹窗和表单状态
- 刷新状态和详情请求状态

### 3.3 数据编排中心

它负责把多个来源的数据拼成可渲染状态：

- 本地持仓数据
- 天天基金估值
- 东财官方净值
- 东财官方历史净值
- 详情缓存

### 3.4 用户交互中心

它处理几乎所有操作：

- 新增持仓
- 刷新全部数据
- 打开/关闭详情
- 同步交易
- 分组折叠
- 分组拖拽排序
- 编辑持仓
- 删除持仓

## 4. `App.jsx` 内部职责分区

从代码结构看，可以进一步分为 6 个子区块。

### 4.1 展示组件区

包括：

- `FormatNumber`
- `Modal`
- `DetailMetricCard`
- `DetailStatRow`
- `FundDetailPanel`

职责：

- 统一基础展示样式
- 复用弹窗壳层
- 封装详情页指标卡与字段行

### 4.2 本地数据归一化区

包括：

- `readStoredJson`
- `normalizeStoredFund`
- `normalizeStoredFunds`
- `normalizeStoredSectors`
- `inferStoredQuoteSource`

职责：

- 从 `localStorage` 读取历史数据
- 防御旧结构、脏数据和缺省字段
- 补齐运行时默认值

### 4.3 快照与估值计算区

包括：

- `buildFundSnapshot`
- `buildBaseValuationFund`
- `buildOfficialValuationFund`
- `shouldPreferOfficialValuation`
- `buildDisplayedFund`
- `deriveSharesFromDisplayedAmount`
- `alignFundSharesToDisplayedAmount`

职责：

- 统一“列表展示口径”
- 在估值、官方净值、本地快照之间自动择优
- 根据金额和净值推导份额

### 4.4 远端数据接入区

包括：

- `loadTiantianFundQuote`
- `enqueueTiantianFundQuote`
- `loadEastmoneyOfficialHistory`
- `enqueueEastmoneyOfficialHistory`
- `loadEastmoneyOfficialHistoryRange`
- `enqueueEastmoneyOfficialHistoryRange`
- `fetchQuoteMapForFunds`
- `fetchOfficialMapForFunds`
- `fetchFundDetailRemoteData`

职责：

- 通过动态 script 注入发起 JSONP 请求
- 避免并发冲突
- 把远端返回转成前端可用对象

### 4.5 主流程业务区

包括：

- `reconcileFundWithQuote`
- `mergeFundsWithSources`
- `alignFundMarketValue`
- `applyTradeToFund`
- `handleRefresh`
- `handleAddFund`
- `handleSyncTrade`
- `handleUpdateFund`
- `handleDeleteFund`

职责：

- 将远端数据合并进持仓
- 处理新增、刷新、交易同步和编辑
- 维护主列表的一致性

### 4.6 页面编排区

包括：

- `displayedFunds`
- `groupedFunds`
- `activeDetailModel`
- 各类 `useMemo`
- 各类弹窗与表格 JSX

职责：

- 把状态变成可展示视图
- 在总览、表格和详情中维持统一口径

## 5. `fundDetails.js`：详情领域模块

这是本项目中最接近“纯领域层”的模块。

### 5.1 缓存管理职责

包括：

- `createEmptyDetailCacheStore`
- `normalizeStoredDetailCacheStore`
- `buildStoredDetailCachePayload`
- `buildDetailCacheEntry`
- `isDetailCacheStale`

职责：

- 定义缓存结构
- 做版本控制与兼容
- 生成可持久化 payload
- 判断缓存是否过期

### 5.2 数据整形职责

包括：

- `normalizeOfficialHistory`
- `mergeOfficialHistory`
- `normalizeRemoteThemes`
- `buildOfficialHistoryFromSources`

职责：

- 规范化官方净值历史
- 去重并排序
- 整理远端主题标签
- 用主列表字段为详情页历史提供兜底

### 5.3 详情指标计算职责

包括：

- `buildOfficialPerformance`
- `resolveQuoteValues`
- `getTotalCostAmount`
- `getHoldingDays`
- `buildFundDetailModel`

职责：

- 计算今年涨幅、近 1 年、近 3 年表现
- 决定详情页优先使用哪份估值/净值
- 计算持仓占比、持有收益、持有天数等指标

## 6. 依赖关系

### 6.1 代码文件级依赖

```text
main.jsx -> App.jsx -> fundDetails.js
```

### 6.2 运行时依赖

`App.jsx` 依赖：

- React hooks
- `lucide-react`
- `sortablejs`
- `window`
- `document`
- `DOMParser`
- `localStorage`

`fundDetails.js` 依赖：

- JavaScript 标准对象
- `Date`
- 数组与对象处理

因此 `fundDetails.js` 更容易单独测试，而 `App.jsx` 更偏运行时耦合。

## 7. 模块边界特点

### 7.1 做得比较清楚的边界

- 列表口径与详情口径已经分离
- 详情缓存与主持仓状态已经分离
- 远端估值数据与本地持仓数据通过合并函数衔接，而不是直接覆盖 UI

### 7.2 仍然混在一起的边界

- 请求层、领域层、组件层都混在 `App.jsx`
- 新增/编辑/同步交易三套表单逻辑都在同一组件内
- 远端请求错误处理、用户提示和数据计算没有单独抽象

## 8. 可行的后续拆分方案

如果后续准备重构，这个仓库很适合按下面方式拆分：

### 8.1 组件层

- `components/Modal.jsx`
- `components/FundTable.jsx`
- `components/FundDetailPanel.jsx`
- `components/forms/*.jsx`

### 8.2 服务层

- `services/tiantian.js`
- `services/eastmoney.js`

### 8.3 领域层

- `domain/fundSnapshot.js`
- `domain/fundTrade.js`
- `domain/fundDetails.js`

### 8.4 持久化层

- `storage/fundsStorage.js`
- `storage/detailCacheStorage.js`

这样的拆分会让测试、维护和二次开发更容易。
