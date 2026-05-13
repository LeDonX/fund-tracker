# Fund Tracker Code Wiki

本目录是一套面向开发者的项目代码文档，帮助快速理解 `fund-tracker` 的结构、数据流、核心符号、依赖关系与运行方式。

## 文档目录

1. [01-project-overview.md](./01-project-overview.md)
   - 项目目标、技术栈、目录结构、入口链路
2. [02-architecture-and-dataflow.md](./02-architecture-and-dataflow.md)
   - 整体架构、运行时分层、关键数据流与状态流
3. [03-modules-and-responsibilities.md](./03-modules-and-responsibilities.md)
   - 主要模块职责、边界、相互依赖与实现特点
4. [04-key-functions-and-components.md](./04-key-functions-and-components.md)
   - 核心组件、关键函数、重要状态与本地存储键
5. [05-dependencies-config-and-run.md](./05-dependencies-config-and-run.md)
   - 依赖、配置、启动方式、构建命令与环境要求

## 快速结论

- 这是一个基于 React + Vite 的单页前端应用，用于跟踪基金持仓、估值、收益与分组信息。
- 业务代码高度集中在 `src/App.jsx`，它同时承担页面容器、状态编排、远端请求和大部分交互逻辑。
- `src/fundDetails.js` 是唯一明显独立出来的领域模块，负责详情缓存标准化、历史净值整合与详情模型构建。
- 数据来源以浏览器端 JSONP 请求为主，直接访问天天基金与东财接口，无本地后端服务。
- 持仓、分组和详情缓存都保存在 `localStorage`，应用刷新后仍可恢复。

## 建议阅读顺序

1. 先读 `01-project-overview.md`，建立全局认识
2. 再读 `02-architecture-and-dataflow.md`，理解状态、派生数据和刷新链路
3. 然后看 `03-modules-and-responsibilities.md` 与 `04-key-functions-and-components.md`
4. 最后看 `05-dependencies-config-and-run.md`，了解环境、命令与配置
