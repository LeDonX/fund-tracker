# Fund Tracker 详细设计方案

## 1. 文档目标

本文档用于定义 `fund-tracker` 下一阶段的完整开发设计方案，目标是把当前的“可演示原型”演进为“可持续维护、可真实使用、可继续扩展”的前端基金持仓工具。

本文档同时作为后续开发实施依据，后续编码、重构、测试与验收都将围绕本方案执行。

## 2. 当前现状评估

### 2.1 已完成能力

当前项目已经具备以下基础能力：

- 基金持仓列表展示
- 按分组组织基金
- 主列表数据刷新
- 天天基金估值接入
- 东财官方净值接入
- 基金详情面板
- 详情缓存与 TTL
- 新增基金持仓
- 编辑持仓金额
- 交易同步对份额/成本的影响计算
- 分组拖拽排序
- 本地 `localStorage` 持久化

### 2.2 未完成能力

当前项目仍缺少以下关键能力：

- 真实交易记录持久化
- 历史弹窗接入真实交易数据
- 导入功能的实际实现
- 导出功能的实际实现
- 统一存储层与统一错误处理
- 模块边界清晰的目录结构
- 自动化测试
- 更稳定的工程化结构

### 2.3 当前架构问题

当前主问题不是“功能不能运行”，而是“功能未闭环且维护成本高”。

主要问题包括：

1. `src/App.jsx` 职责过重
2. 请求层、领域层、UI 层耦合
3. 交易同步只改持仓，不保存交易流水
4. 导入导出只有 UI 外壳，没有真实逻辑
5. 本地存储逻辑散落在组件内
6. 错误处理以 `console.warn` 为主，用户可感知性弱
7. 缺少测试，核心计算逻辑回归风险高

## 3. 本轮开发总目标

本轮开发分为两个层次：

### 3.1 产品目标

让项目从“原型展示”提升为“可真实维护个人持仓”的可用工具。

### 3.2 工程目标

让项目具备继续演进的基础，包括：

- 真实数据闭环
- 清晰模块边界
- 稳定的本地存储结构
- 可测试的领域逻辑
- 便于后续继续扩展图表、统计和导入格式

## 4. 设计原则

后续所有实现遵循以下原则：

### 4.1 优先保证数据闭环

真实交易记录与持仓状态要能形成完整闭环，避免界面看起来完整但底层数据不可信。

### 4.2 优先保证向后兼容

已有 `localStorage` 中的 `funds`、`sectors`、`detailCache` 不应因为升级而失效。

### 4.3 优先抽离纯函数

把计算逻辑从组件中拆出，优先沉淀为纯函数，便于测试和重用。

### 4.4 优先做最小可用方案

导入导出第一版不追求 Excel 全能力，先做 JSON 版，保证可备份、可恢复、可迁移。

### 4.5 先稳定数据，再增强展示

图表、主题标签和高级分析不作为第一阶段核心交付，先补齐真实数据与工程基础。

## 5. 开发范围定义

## 5.1 本轮范围内

- 真实交易记录模型与持久化
- 交易历史弹窗真实化
- JSON 导入/导出
- 存储层抽离
- 请求服务层抽离
- 核心领域计算抽离
- 主组件拆分
- 测试框架接入与核心单元测试
- 统一错误处理与提示策略

## 5.2 本轮范围外

- 登录/账号体系
- 云端同步
- 服务端 API
- 多用户协作
- Excel 完整导入导出
- 移动端适配重构
- 图表大屏和复杂分析中心

这些能力可以在本轮完成后继续规划，但不作为当前实现阻塞项。

## 6. 目标架构设计

重构后的目录建议如下：

```text
src/
├─ app/
│  └─ constants.js
├─ components/
│  ├─ common/
│  │  ├─ Modal.jsx
│  │  └─ FormatNumber.jsx
│  ├─ detail/
│  │  └─ FundDetailPanel.jsx
│  ├─ table/
│  │  └─ FundTable.jsx
│  └─ modals/
│     ├─ AddFundModal.jsx
│     ├─ GroupModal.jsx
│     ├─ SyncTradeModal.jsx
│     ├─ ImportModal.jsx
│     ├─ ExportModal.jsx
│     ├─ HistoryModal.jsx
│     └─ SettingsModal.jsx
├─ domain/
│  ├─ fundSnapshot.js
│  ├─ fundTrade.js
│  ├─ fundDetails.js
│  ├─ fundNormalize.js
│  └─ importExport.js
├─ services/
│  ├─ tiantianFundService.js
│  └─ eastmoneyFundService.js
├─ storage/
│  ├─ storageKeys.js
│  ├─ fundsStorage.js
│  ├─ detailCacheStorage.js
│  └─ transactionsStorage.js
├─ utils/
│  ├─ number.js
│  ├─ date.js
│  └─ errors.js
├─ App.jsx
├─ main.jsx
└─ index.css
```

### 6.1 架构分层说明

#### UI 层

负责展示、表单输入和组件组合，不直接处理底层存储细节。

#### Domain 层

负责业务对象计算与规则：

- 快照计算
- 净值来源择优
- 交易影响计算
- 详情模型生成
- 导入导出数据校验

#### Service 层

负责远端接口访问与解析，不参与页面状态管理。

#### Storage 层

负责读写 `localStorage`、默认值、版本迁移与结构兼容。

## 7. 数据模型设计

## 7.1 持仓对象 `FundRecord`

当前持仓对象继续沿用现有结构，避免一次性破坏旧数据。

建议维持如下字段：

```js
{
  id: number,
  name: string,
  code: string,
  sector: string,
  amount: number,
  dailyRate: number,
  dailyProfit: number,
  totalProfit: number,
  totalRate: number,
  weeklyProfit: number,
  monthlyProfit: number,
  shares: number | undefined,
  costAmount: number | undefined,
  currentNetValue: number | undefined,
  lastNetValue: number | undefined,
  officialCurrentNetValue: number | undefined,
  officialLastNetValue: number | undefined,
  officialDailyRate: number | undefined,
  quoteSource: 'estimate' | 'quote' | '',
  lastValuationTime: string,
  netValueDate: string,
  officialNetValueDate: string,
  officialPreviousNetValueDate: string,
  holdingStartDate: string,
  bootstrapSharesFromAmount: boolean
}
```

### 7.1.1 保持不变的原因

- 当前已有本地数据兼容逻辑
- 当前 UI 和计算函数都依赖该结构
- 可降低重构成本

## 7.2 交易记录对象 `TransactionRecord`

新增交易流水结构如下：

```js
{
  id: string,
  fundCode: string,
  fundName: string,
  fundId: number | null,
  type: '买入' | '卖出' | '分红',
  amount: number,
  tradeDate: string,
  referenceNetValue: number | null,
  sharesDelta: number | null,
  costDelta: number | null,
  source: 'manual-sync',
  note: string,
  createdAt: number
}
```

### 7.2.1 字段说明

- `id`
  - 使用字符串 ID，避免与基金本地 `id` 混淆
- `fundCode`
  - 历史查询的主索引
- `fundName`
  - 保存交易发生时的名称快照，避免未来基金改名导致历史难读
- `fundId`
  - 作为辅助引用，不作为唯一查询条件
- `type`
  - 交易类型
- `amount`
  - 交易金额
- `tradeDate`
  - 交易生效日期，初版默认使用当天
- `referenceNetValue`
  - 交易同步时用于换算的净值
- `sharesDelta`
  - 本次交易导致的份额变化
- `costDelta`
  - 本次交易导致的成本变化
- `source`
  - 保留扩展位，便于后续区分手动录入、导入、自动同步
- `note`
  - 备注，初版可为空字符串
- `createdAt`
  - 记录写入时间戳

## 7.3 交易存储对象 `TransactionStore`

```js
{
  version: 1,
  entries: TransactionRecord[]
}
```

### 7.3.1 为什么需要版本

- 后续可能引入手续费、份额确认日、交易确认状态等字段
- 版本字段便于后续迁移

## 7.4 导出文件结构 `ExportBundle`

第一版导出建议统一导出为一个 JSON 包：

```js
{
  version: 1,
  exportedAt: number,
  app: 'fund-tracker',
  data: {
    funds: FundRecord[],
    sectors: string[],
    detailCache: {
      version: number,
      entries: Record<string, unknown>
    },
    transactions: TransactionRecord[]
  }
}
```

### 7.4.1 设计原因

- 一次导出即可完整备份
- 易于导入恢复
- 易于后续增加字段而不破坏现有结构

## 8. 本地存储设计

## 8.1 存储键规划

建议统一放到 `storage/storageKeys.js`：

```js
export const STORAGE_KEYS = {
  funds: 'fundTrackerData',
  sectors: 'fundTrackerSectors',
  detailCache: 'fundTrackerDetailCacheV1',
  transactions: 'fundTrackerTransactionsV1',
};
```

## 8.2 存储层职责

每个 storage 模块负责：

- 读取
- 解析
- 默认值回退
- normalize
- 持久化
- 导入覆盖写入

## 8.3 存储层文件设计

### `storage/fundsStorage.js`

提供：

- `loadFunds()`
- `saveFunds(funds)`
- `normalizeStoredFund()`
- `normalizeStoredFunds()`

### `storage/detailCacheStorage.js`

提供：

- `loadDetailCacheStore()`
- `saveDetailCacheEntries(entries)`

### `storage/transactionsStorage.js`

提供：

- `createEmptyTransactionStore()`
- `normalizeStoredTransactionStore()`
- `loadTransactions()`
- `saveTransactions(transactions)`
- `appendTransaction(entry)`

## 8.4 向后兼容策略

### 8.4.1 旧基金数据

继续使用现有 normalize 逻辑，不破坏历史数据。

### 8.4.2 旧详情缓存

继续沿用 `fundDetails.js` 现有缓存结构。

### 8.4.3 新交易记录

由于之前没有真实流水，首次升级时默认空数组即可，不需要复杂迁移。

## 9. 服务层设计

## 9.1 `services/tiantianFundService.js`

负责：

- `loadTiantianFundQuote(code)`
- `enqueueTiantianFundQuote(code)`
- `fetchQuoteMapForFunds(funds)`

### 9.1.1 输出数据格式

统一返回：

```js
{
  code: string,
  name: string,
  lastNetValue: number,
  estimatedNetValue: number,
  dailyRate: number,
  updateTime: string,
  netValueDate: string,
  quoteSource: 'estimate' | 'quote' | ''
}
```

## 9.2 `services/eastmoneyFundService.js`

负责：

- `loadEastmoneyOfficialHistory(code)`
- `enqueueEastmoneyOfficialHistory(code)`
- `loadEastmoneyOfficialHistoryRange(code, per)`
- `enqueueEastmoneyOfficialHistoryRange(code, per)`
- `fetchOfficialMapForFunds(funds)`

### 9.2.1 同时保留解析函数

- `parseOfficialNetValueRows(content)`
- `parseOfficialHistoryRows(content)`

这些函数属于接口解析逻辑，保留在 service 层更合适。

## 9.3 服务层错误模型

建议新增统一错误创建函数：

```js
{
  code: string,
  message: string,
  recoverable: boolean,
  source: string
}
```

初版错误码建议：

- `QUOTE_TIMEOUT`
- `QUOTE_LOAD_FAILED`
- `OFFICIAL_TIMEOUT`
- `OFFICIAL_LOAD_FAILED`
- `OFFICIAL_PARSE_FAILED`
- `DETAIL_FETCH_FAILED`
- `IMPORT_INVALID_PAYLOAD`

## 10. 领域层设计

## 10.1 `domain/fundSnapshot.js`

迁出并集中以下函数：

- `toNumber`
- `parsePercentageText`
- `getQuoteReferenceNetValue`
- `getStoredReferenceNetValue`
- `buildFundSnapshot`
- `buildBaseValuationFund`
- `buildOfficialValuationFund`
- `shouldPreferOfficialValuation`
- `buildDisplayedFund`
- `getDisplayedReferenceNetValue`
- `deriveSharesFromDisplayedAmount`
- `alignFundSharesToDisplayedAmount`
- `reconcileFundWithQuote`
- `mergeFundsWithSources`
- `applyOfficialNetValueToFund`

### 10.1.1 目标

使“列表口径计算”和“远端结果合并”成为独立可测试的纯领域逻辑。

## 10.2 `domain/fundTrade.js`

新增并集中以下函数：

- `getTodayDateKey`
- `buildTransactionRecord`
- `applyTradeToFund`
- `buildTradeImpact`
- `sortTransactionsByDateDesc`
- `filterTransactionsByFundCode`

### 10.2.1 设计拆分

当前 `applyTradeToFund()` 只返回更新后的基金对象。

重构后应拆成两步：

1. `buildTradeImpact(fund, trade, quote)`
   - 返回交易影响结果
2. `applyTradeToFund(fund, tradeImpact)`
   - 返回新基金对象

这样可以同时生成：

- 新基金状态
- 交易流水记录

## 10.3 `domain/importExport.js`

新增函数：

- `buildExportBundle({ funds, sectors, detailCacheEntries, transactions })`
- `validateImportBundle(payload)`
- `normalizeImportBundle(payload)`
- `mergeImportedFunds(currentFunds, incomingFunds, mode)`

## 10.4 `domain/fundNormalize.js`

迁出：

- `inferStoredQuoteSource`
- `normalizeStoredFund`
- `normalizeStoredFunds`
- `normalizeStoredSectors`

## 10.5 `domain/fundDetails.js`

当前 `src/fundDetails.js` 可直接迁入 `domain/`，保留现有能力，仅按目录重组。

## 11. UI 组件设计

## 11.1 主组件 `App.jsx`

重构后保留职责：

- 组合各个模块
- 挂接主状态
- 调用 service/domain/storage
- 维护页面级弹窗开关

### 11.1.1 不再直接承担的职责

- 远端接口底层实现
- 本地存储细节
- 大段纯计算逻辑
- 所有弹窗 JSX 细节

## 11.2 详情面板 `FundDetailPanel`

继续保留现有展示语义，重点不改产品逻辑，只做组件抽离。

需要保留：

- 列表口径与官方历史口径的区分
- 缓存刷新状态展示
- “详情值不回写主列表”的语义

## 11.3 历史弹窗 `HistoryModal`

重构后改为真实数据展示。

### 11.3.1 输入 props

```js
{
  isOpen,
  onClose,
  fund,
  transactions
}
```

### 11.3.2 展示字段

- 交易日期
- 交易类型
- 金额
- 参考净值
- 份额变化
- 成本变化
- 创建时间

### 11.3.3 排序规则

- 优先按 `tradeDate` 倒序
- 同日期按 `createdAt` 倒序

## 11.4 导入弹窗 `ImportModal`

第一版支持导入 JSON 文件。

### 11.4.1 流程

1. 用户选择文件
2. 读取文本
3. 解析 JSON
4. `validateImportBundle()`
5. 展示预览摘要
6. 用户确认导入策略
7. 落盘

### 11.4.2 导入策略

第一版建议支持两种：

- `replace-all`
  - 全量替换当前数据
- `append-funds`
  - 仅追加当前不存在的基金，分组去重合并，交易流水追加

## 11.5 导出弹窗 `ExportModal`

第一版支持：

- 导出完整 JSON 包

后续可扩展：

- 导出仅持仓
- 导出仅交易
- 导出 CSV

## 12. 关键功能设计

## 12.1 交易记录持久化

### 12.1.1 当前问题

`handleSyncTrade()` 只更新 `funds`，不保存交易流水，因此：

- 历史弹窗无法展示真实数据
- 无法追踪持仓演变
- 无法支持后续统计

### 12.1.2 目标设计

每次同步交易时，同时生成一条 `TransactionRecord`，并写入 `transactionsStorage`。

### 12.1.3 流程设计

```text
用户提交交易
  -> 校验基金存在
  -> 查询可用净值
  -> 生成 tradeImpact
  -> 更新 fund
  -> 生成 transactionRecord
  -> 写入 funds
  -> 写入 transactions
  -> 关闭弹窗
```

### 12.1.4 tradeImpact 输出设计

```js
{
  type: '买入' | '卖出' | '分红',
  amount: number,
  referenceNetValue: number,
  sharesDelta: number,
  costDelta: number,
  nextShares: number,
  nextCostAmount: number,
  nextHoldingStartDate: string
}
```

### 12.1.5 优势

- 交易与持仓一一对应
- 可追踪变化过程
- 为后续图表与复盘打基础

## 12.2 历史弹窗真实化

### 12.2.1 当前问题

历史弹窗只展示 mock 数据。

### 12.2.2 目标设计

按当前基金代码筛选交易流水，并展示真实记录。

### 12.2.3 空状态设计

如果没有真实交易数据，显示：

`暂无真实交易记录，可通过“同步交易”开始积累历史。`

## 12.3 导入导出

### 12.3.1 导出设计

导出使用浏览器前端完成：

1. 构造 `ExportBundle`
2. `JSON.stringify(..., null, 2)`
3. 生成 `Blob`
4. 创建临时下载链接
5. 触发下载

建议文件名：

`fund-tracker-export-YYYY-MM-DD-HH-mm-ss.json`

### 12.3.2 导入设计

导入流程：

1. 读取文件
2. 解析 JSON
3. 校验顶层结构
4. normalize 数据
5. 预览摘要
6. 选择导入策略
7. 持久化写入
8. 更新页面状态

### 12.3.3 导入校验项

- 顶层 `version` 是否存在
- `data.funds` 是否为数组
- `data.sectors` 是否为数组
- `data.transactions` 是否为数组
- 基金代码是否合法
- 金额字段是否可解析
- 交易类型是否在允许范围内

## 12.4 错误处理与回退

### 12.4.1 详情刷新

继续保留当前策略：

- 有旧缓存时优先回退旧缓存
- 无旧缓存时展示错误信息

### 12.4.2 主列表刷新

增强显示策略：

- 全部失败：保留原列表，并提示本次刷新失败
- 部分成功：提示“部分基金刷新失败”
- 成功：更新刷新时间

### 12.4.3 导入

- 结构错误：阻止导入
- 部分记录无效：允许展示预览并提示丢弃项
- 空文件：阻止导入

## 13. 状态管理设计

当前仍继续使用组件内状态，不引入外部状态库。

理由如下：

- 当前项目规模尚可控
- 拆分模块后，React 原生状态足以支撑
- 引入 Zustand/Redux 不是当前瓶颈

### 13.1 页面主状态

保留以下主状态：

- `funds`
- `sectors`
- `detailCacheEntries`
- `transactions`

### 13.2 推荐派生值

新增以下派生值：

- `selectedFundTransactions`
- `transactionSummaryByFund`
- `importPreview`

## 14. 测试设计

## 14.1 测试框架

采用：

- `Vitest`

可选后续再接：

- `@testing-library/react`

## 14.2 第一批测试范围

### `domain/fundSnapshot.js`

- `buildFundSnapshot()`
- `buildDisplayedFund()`
- `shouldPreferOfficialValuation()`
- `reconcileFundWithQuote()`

### `domain/fundTrade.js`

- `buildTradeImpact()`
- `applyTradeToFund()`
- `buildTransactionRecord()`

### `domain/fundDetails.js`

- `buildFundDetailModel()`
- `normalizeStoredDetailCacheStore()`

### `domain/importExport.js`

- `validateImportBundle()`
- `normalizeImportBundle()`

## 14.3 测试优先级

优先只测纯函数，暂不优先投入复杂 UI 自动化测试。

## 15. 实施阶段设计

## Phase 1：真实数据闭环

### 范围

- 新增交易记录数据结构
- 接入 transactions 存储
- 改造交易同步写入流水
- 历史弹窗展示真实数据

### 目标

让项目具备真实交易闭环，摆脱 mock 历史。

### 验收标准

- 每次同步交易后都能生成一条记录
- 刷新页面后历史记录仍存在
- 历史弹窗只展示当前基金的真实记录

## Phase 2：导入导出闭环

### 范围

- 实现 JSON 导出
- 实现 JSON 导入
- 导入预览与校验

### 目标

让用户能完整备份与恢复本地数据。

### 验收标准

- 可导出完整 JSON 包
- 可重新导入恢复
- 非法文件会被阻止并提示原因

## Phase 3：模块拆分与重构

### 范围

- 提取 service/domain/storage/components
- 保持功能不变

### 目标

降低 `App.jsx` 复杂度，提高可维护性。

### 验收标准

- `App.jsx` 显著缩短
- 存储与请求不再散落在主组件中
- 原有功能行为不变

## Phase 4：测试与稳定性增强

### 范围

- 接入 Vitest
- 为核心纯函数补测试
- 统一错误提示与部分失败提示

### 目标

降低回归风险，提升可维护性。

### 验收标准

- 可运行测试
- 核心计算函数有基础覆盖
- 常见错误场景有清晰提示

## 16. 文件级改造计划

## 16.1 新增文件

建议新增：

- `src/domain/fundSnapshot.js`
- `src/domain/fundTrade.js`
- `src/domain/fundNormalize.js`
- `src/domain/importExport.js`
- `src/services/tiantianFundService.js`
- `src/services/eastmoneyFundService.js`
- `src/storage/storageKeys.js`
- `src/storage/fundsStorage.js`
- `src/storage/detailCacheStorage.js`
- `src/storage/transactionsStorage.js`
- `src/components/common/Modal.jsx`
- `src/components/common/FormatNumber.jsx`
- `src/components/detail/FundDetailPanel.jsx`
- `src/components/modals/HistoryModal.jsx`
- `src/components/modals/ImportModal.jsx`
- `src/components/modals/ExportModal.jsx`
- `src/components/table/FundTable.jsx`

## 16.2 调整文件

- `src/App.jsx`
  - 重构为组合层
- `src/fundDetails.js`
  - 迁移或保留为 `src/domain/fundDetails.js`
- `package.json`
  - 增加测试脚本与测试依赖

## 17. 风险与应对

## 17.1 风险：重构引入行为回归

应对：

- 先抽纯函数
- 再迁移 UI
- 每阶段都保留运行可用

## 17.2 风险：本地存储兼容问题

应对：

- 所有新增存储都加 normalize
- 不直接删除旧字段
- 导入前先校验

## 17.3 风险：第三方接口结构变化

应对：

- 统一错误对象
- 页面展示“部分失败/回退旧值”
- 保留缓存兜底

## 17.4 风险：导入覆盖误操作

应对：

- 导入前展示摘要
- 区分覆盖与追加
- 二次确认

## 18. 验收口径

本轮最终验收以以下结果为准：

1. 项目能保存真实交易流水
2. 历史弹窗能展示真实交易记录
3. 项目支持 JSON 导入与导出
4. 主业务代码完成模块拆分
5. 核心领域函数具备基础测试
6. 关键错误场景具备清晰提示

## 19. 推荐执行顺序

为了降低风险，后续开发按以下顺序推进：

1. 先做 `transactions` 设计与持久化
2. 再改历史弹窗
3. 再做 JSON 导入导出
4. 再拆分 `App.jsx`
5. 最后补测试与稳定性增强

## 20. 开发执行说明

后续开发将按本文档推进，建议第一阶段直接落地以下具体任务：

1. 新增 `transactionsStorage`
2. 抽离 `fundTrade` 领域模块
3. 改造 `handleSyncTrade()`
4. 改造历史弹窗
5. 验证交易记录闭环

完成以上后，再进入导入导出与模块拆分阶段。
