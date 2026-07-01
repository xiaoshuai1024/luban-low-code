# luban-architecture-design

luban 低代码**营销与留资平台**的架构与产品设计文档仓。

本仓是平台顶层设计的权威来源：产品定位、领域模型、系统架构、多端渲染策略、后端/BFF 策略、数据模型。下游的 PRD、技术方案、各子项目设计文档均以本仓为上游依据。

## 文档索引

### 设计期蓝图（产品/架构设计，00–07）

| 文档 | 内容 |
|------|------|
| [00-platform-overview](./docs/00-platform-overview.md) | 平台定位 / 愿景 / 目标用户 / 现状诊断 / 核心闭环 |
| [01-product-design](./docs/01-product-design.md) | 领域模型 / 用户旅程 / 能力分层 / 竞品参考 |
| [02-product-roadmap](./docs/02-product-roadmap.md) | 路线图 P0 / P1 / P2 + 验收标准 |
| [03-system-architecture](./docs/03-system-architecture.md) | 总体架构 / 子项目职责 / 数据流 / 部署拓扑 |
| [04-multi-client-strategy](./docs/04-multi-client-strategy.md) | 多端策略 + schema 渲染一致性（Electron / Flutter 原生 / uniapp 小程序 / web） |
| [05-backend-strategy](./docs/05-backend-strategy.md) | Java 先行 / Go 暂缓 / 领域划分 / 双后端契约 |
| [06-bff-strategy](./docs/06-bff-strategy.md) | Next.js API-only / 职责边界 / 接口编排 |
| [07-data-model](./docs/07-data-model.md) | 核心数据模型 / 表结构草案 |

### 实现期详解（已落地工程，08–11）

> 这批文档基于代码事实编写，覆盖已实现的工程全貌，与设计期蓝图互补。

| 文档 | 内容 |
|------|------|
| [08-product-usage-guide](./docs/08-product-usage-guide.md) | 产品使用指南：谁能用、怎么用、核心闭环 7 步、AI 助手用法、30 秒 Demo |
| [09-system-architecture-impl](./docs/09-system-architecture-impl.md) | 实现级架构总览：6 服务分层 / 数据流 / 安全 / 部署 / 19 张表领域模型 |
| [10-ai-assistant-architecture](./docs/10-ai-assistant-architecture.md) | AI 助手详解：LangGraph 状态图 / 六重校验闸 / RAG / 三模型 / 工具回环 / HITL |
| [11-lowcode-engine-impl](./docs/11-lowcode-engine-impl.md) | 低代码引擎：schema SSOT / 物料契约 / 自研表达式沙箱 / 运行时渲染器 / 设计器 |

---

## 架构图（`docs/diagrams/`）

按图类型采用**混合风格**，各取所长：流程/状态/概念图用 Excalidraw 手绘风（亲和、文件小），架构/拓扑/ER 图用 draw.io 精确风（对齐稳、连线吸附准）。每张图都有可编辑源文件 + 导出的 SVG（文档内嵌）。

### 🖊️ Excalidraw 手绘风（流程 / 状态 / 概念类）

源文件 `.excalidraw`，用 [excalidraw.com](https://excalidraw.com) 拖入编辑，或本仓脚本渲染（见下）。

| 图 | 源文件 | 用于 |
|----|--------|------|
| 核心闭环 7 步 | `08-core-loop.excalidraw` | 00 / 08 |
| AI Agent 状态机 | `10-ai-state-machine.excalidraw` | 10 |
| Lead 状态机 | `01-lead-state.excalidraw` | 01 |
| 产品路线图 | `02-roadmap.excalidraw` | 02 |
| 三层鉴权链路 | `10-auth.excalidraw` | 10 |
| 多端渲染一致性 | `04-multi.excalidraw` | 04 |

### 📐 draw.io 精确风（架构 / 拓扑 / ER / 分层类）

源文件 `.drawio`，用 [draw.io](https://app.diagrams.net)（桌面版 / VSCode 插件 / Web 版）打开编辑。

| 图 | 源文件 | 用于 |
|----|--------|------|
| 平台全景架构 | `09-platform-overview.drawio` | 09 |
| 留资提交闭环 | `09-lead-flow.drawio` | 09 |
| AI 总体架构 | `10-ai-overview.drawio` | 10 |
| schema 驱动渲染 + 沙箱 | `11-engine-render.drawio` | 11 |
| 核心数据模型 ER | `07-er-model.drawio` | 01 / 07 |
| 总体架构（设计期） | `03-sys-arch-design.drawio` | 03 |
| 后端领域划分 | `05-backend-domain.drawio` | 05 |

### 修改 / 新增图

**draw.io 图**（需本机装 drawio CLI：`brew install --cask drawio`）：
```bash
cd docs/diagrams
drawio -x -f svg -o <name>.svg <name>.drawio
```

**Excalidraw 图**（本仓自带渲染器，一次性装 Playwright+Chromium）：
```bash
# 首次安装依赖（~150MB）
bash scripts/excalidraw/install.sh
# 编辑：去 excalidraw.com 拖入 .excalidraw 改，或改对应 gen-*.py 生成器
# 渲染导出 SVG
python3 scripts/excalidraw/render.py docs/diagrams/<name>.excalidraw --format svg --output docs/diagrams/<name>
```

> 图规范：按领域分色、实线=运行时调用、虚线=依赖/规划、菱形=决策、椭圆=终态。文档通过相对路径 `![](./diagrams/<name>.svg)` 引用，导出后自动更新。

## 文档维护约定

- 变更走 `feature/*` 分支 + PR，不直接提交 `main`
- 架构决策变更须同步更新对应文档，并在 PR 描述记录决策理由
- 文档与代码冲突时：**代码实现为事实**，文档随后校正，并在 commit 说明差异
- 编码 UTF-8 without BOM；图示统一用 Mermaid
