# 关键组件、函数与数据结构

## 1. 关键组件

项目没有 class 组件，也没有 ES `class` 类型；关键 UI 全部是函数组件。

| 名称 | 位置 | 作用 |
| --- | --- | --- |
| `FundTrackerApp` | `src/App.jsx` | 应用根组件，负责全局业务编排 |
| `FundDetailPanel` | `src/App.jsx` | 基金详情面板，展示详情模型与缓存状态 |
| `Modal` | `src/App.jsx` | 通用弹窗容器 |
| `DetailMetricCard` | `src/App.jsx` | 详情页顶部指标卡 |
| `DetailStatRow` | `src/App.jsx` | 详情页字段行 |
| `FormatNumber` | `src/App.jsx` | 数值着色与格式化展示 |

## 2. `FundTrackerApp`

### 2.1 核心作用

- 初始化本地持仓、分组与详情缓存
- 派生列表展示数据与详情模型
- 协调刷新、新增、编辑、交易同步
- 渲染主表格、详情页和所有弹窗

### 2.2 关键内部状态

| 状态名 | 含义 |
| --- | --- |
| `funds` | 持仓源数据 |
| `sectors` | 分组名称和顺序 |
| `detailCacheEntries` | 详情缓存集合 |
| `modals` | 所有弹窗开关 |
| `detailView` | 当前详情页是否打开及对应基金代码 |
| `detailRequestStates` | 各基金详情请求状态 |
| `fundForm` | 新增持仓表单 |
| `fundLookup` | 基金代码查询状态 |
| `syncForm` | 同步交易表单 |
| `editForm` | 编辑持仓表单 |

### 2.3 重要派生值

| 名称 | 作用 |
| --- | --- |
| `displayedFunds` | 当前列表展示口径下的基金集合 |
| `groupedFunds` | 分组后的基金集合 |
| `totalDailyProfit` | 全部持仓当日收益汇总 |
| `totalAmount` | 全部持仓市值汇总 |
| `totalProfit` | 全部持仓累计收益汇总 |
| `activeDetailModel` | 当前详情面板使用的最终模型 |

## 3. 关键展示组件说明

### 3.1 `FormatNumber`

作用：

- 统一处理货币、百分比和正负号
- 根据涨跌使用红绿颜色
- 对 `null`/`undefined`/非数值显示 `--`

这是整个项目中使用最频繁的展示辅助组件之一。

### 3.2 `Modal`

作用：

- 为创建分组、新增持仓、同步交易、导入导出、历史记录、设置等弹窗提供统一壳层
- 控制遮罩、标题区、内容区和关闭按钮

### 3.3 `FundDetailPanel`

作用：

- 展示持有金额、当日收益、最新净值、估算净值
- 展示持仓收益、持仓占比、持有天数
- 展示官方净值历史推导的阶段表现
- 呈现详情缓存刷新状态和错误回退状态

设计重点：

- 明确区分列表口径与官方历史口径
- 详情页中的推导值不回写 `funds`

## 4. 关键函数分组

## 4.1 本地读取与归一化

### `readStoredJson(storageKey, fallbackValue)`

作用：

- 从 `localStorage` 安全读取 JSON
- 如果解析失败则返回 fallback

价值：

- 统一异常处理
- 防止本地缓存损坏导致页面启动失败

### `normalizeStoredFund(fund, index)`

作用：

- 把旧持仓结构标准化为当前运行时格式
- 统一数值、字符串、日期和引用来源字段

特点：

- 兼容旧数据
- 自动补默认值
- 会推断 `quoteSource`

### `normalizeStoredFunds(storedFunds)`

作用：

- 批量标准化基金列表
- 过滤掉无代码的无效基金

### `normalizeStoredSectors(storedSectors)`

作用：

- 标准化分组数组
- 若本地值无效，则回退到默认分组

## 4.2 快照与展示口径

### `buildFundSnapshot(fund, overrides = {})`

这是主列表数值计算的基础函数。

作用：

- 统一根据份额、净值、成本计算：
  - `amount`
  - `dailyRate`
  - `dailyProfit`
  - `totalProfit`
  - `totalRate`

特点：

- 如果有份额，优先按份额 * 净值推导金额
- 如果没有份额，则尽量兼容旧字段
- 支持外部通过 `overrides` 覆盖部分输入

### `buildBaseValuationFund(fund)`

作用：

- 以本地保存的当前估值/净值为基础生成列表项

### `buildOfficialValuationFund(fund)`

作用：

- 用官方净值字段生成列表项
- 当官方净值日期更优时替代普通估值口径

### `shouldPreferOfficialValuation(fund)`

作用：

- 判断当前列表应优先使用官方净值还是本地/估值口径

判断依据包括：

- 是否存在可用官方净值
- `quoteSource` 是估值还是最新净值
- `officialNetValueDate` 与 `netValueDate` 的新旧关系

### `buildDisplayedFund(fund)`

作用：

- 生成最终用于列表显示的基金对象

结果：

- 自动选择 `official` / `estimate` / `quote` / `fallback` 口径
- 统一输出 `valuationSource`

这也是列表层最重要的派生入口。

## 4.3 远端数据合并

### `reconcileFundWithQuote(fund, quote)`

作用：

- 用远端估值结果修正基金对象
- 对齐名称、代码、估值、净值日期和来源

典型使用场景：

- 新增持仓
- 全量刷新
- 交易同步前的净值对齐

### `mergeFundsWithSources(fundsToMerge, quoteMap, officialMap)`

作用：

- 把估值结果与官方净值结果合并回基金数组

行为特点：

- 若拿到 quote，则先更新基础估值信息
- 若没有 quote 且没有份额，则把当日涨幅/收益兜底为 0
- 若拿到官方净值，再继续补齐官方字段

## 4.4 远端请求

### `loadTiantianFundQuote(fundCode)` / `enqueueTiantianFundQuote(fundCode)`

作用：

- 通过 JSONP 请求天天基金估值接口

为什么有 `enqueue`：

- 由于接口依赖全局回调 `window.jsonpgz`
- 串行队列可减少并发覆盖和竞争问题

### `loadEastmoneyOfficialHistory(fundCode)` / `enqueueEastmoneyOfficialHistory(fundCode)`

作用：

- 请求东财最近两条官方净值
- 主要用于主列表刷新

### `loadEastmoneyOfficialHistoryRange(fundCode, per)` / `enqueueEastmoneyOfficialHistoryRange(fundCode, per)`

作用：

- 请求较长区间的历史净值
- 主要用于详情页阶段表现计算

### `fetchFundDetailRemoteData(fundCode)`

作用：

- 并行拉取估值和官方历史
- 组装为详情缓存条目

失败策略：

- 两者都失败才整体报错
- 任一成功都可生成部分可用详情

## 4.5 交易与编辑

### `alignFundMarketValue(fund, nextMarketValue, fallbackName)`

作用：

- 用户在设置中修改“持有金额”时，按最新可用净值反推份额

使用场景：

- 编辑持仓信息

### `applyTradeToFund(fund, trade, quote)`

作用：

- 根据买入/卖出/分红更新份额、成本和持有起始日

规则：

- 买入增加份额与成本
- 卖出按比例扣减成本
- 分红直接冲减成本

这是交易同步流程里最关键的业务函数。

### `alignFundSharesToDisplayedAmount(fund, targetAmount)`

作用：

- 在未填写份额的场景下，根据当前展示口径金额反推份额

## 4.6 详情缓存与详情模型

### `buildDetailCacheEntry({ code, quote, officialHistory, remoteThemes })`

作用：

- 生成可写入缓存的单基金详情条目

### `isDetailCacheStale(entry, now)`

作用：

- 判断详情缓存是否过期

### `buildFundDetailModel({ sourceFund, displayedFund, totalPortfolioAmount, detailEntry })`

这是详情页最关键的领域函数。

作用：

- 合并源持仓、列表口径、组合总额和详情缓存
- 输出详情面板直接可渲染的模型

输出重点字段：

- `holdingAmount`
- `holdingProfit`
- `holdingProfitRate`
- `holdingRatio`
- `unitCost`
- `yesterdayProfit`
- `estimatedNetValue`
- `latestNetValue`
- `performance`
- `holdingDays`
- `relatedThemes`

## 5. 关键辅助解析函数

### `parseOfficialNetValueRows(content)`

作用：

- 解析东财返回 HTML 中最近两条净值记录

### `parseOfficialHistoryRows(content)`

作用：

- 解析东财返回 HTML 中的完整历史净值列表

### `parsePercentageText(value)`

作用：

- 把形如 `1.23%` 的文本转成数值

## 6. 本地存储键

| Key | 含义 |
| --- | --- |
| `fundTrackerData` | 主持仓列表 |
| `fundTrackerSectors` | 分组顺序与名称 |
| `fundTrackerDetailCacheV1` | 详情缓存 |

## 7. 常量

| 常量 | 含义 |
| --- | --- |
| `INITIAL_SECTORS` | 默认分组 |
| `SCRIPT_TIMEOUT_MS` | JSONP 请求超时时间 |
| `DETAIL_CACHE_VERSION` | 详情缓存版本 |
| `DETAIL_CACHE_STORAGE_KEY` | 详情缓存本地存储键 |
| `DETAIL_CACHE_TTL_MS` | 详情缓存有效期 |

## 8. 当前不存在但容易被误判的内容

阅读这个项目时，有几件事需要特别说明：

- 没有自定义 hooks 文件
- 没有 Redux / Zustand / Context
- 没有 API SDK 层目录
- 没有 TypeScript 类型定义
- 没有 ES class
- 没有真实交易记录存储
- 没有真正完成的导入/导出逻辑
