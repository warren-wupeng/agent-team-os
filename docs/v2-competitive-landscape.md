# atos v2 Competitive Landscape Analysis

> Date: 2026-03-12
> Author: Kira (CTO)

## TL;DR

多 Agent 协调领域**碎片化严重，没有赢家**。现有方案分三层:

| 层级 | 代表 | 问题 |
|------|------|------|
| 协议/标准 | A2A (Google), MCP (Anthropic), Agent Protocol (e2b) | A2A 是网络协议非 CLI; MCP 是工具接入非 Agent 协调; Agent Protocol 采用率低 |
| 编排框架 | CrewAI, AutoGen, LangGraph, MetaGPT | 全部 Python-first, 重量级, 锁定框架 |
| 原生团队 | Claude Code Teams, OpenAI Swarm | 平台锁定, 不跨运行时 |

**atos 的定位空白: CLI-first, 运行时无关, 轻量级 Agent 协调工具。没有人在做这件事。**

---

## 一、Claude Code 原生团队功能

### 能力

Claude Code 提供两层多 Agent 机制:

**Subagent (Task tool):**
- 父 Agent 派生子 Agent, 单向通信 (子→父)
- 子 Agent 之间不能通信
- Session 内持久, 跨 Session 不持久

**Agent Teams (实验性):**
- 需要 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- Team Lead 协调 Teammate, 支持 1-to-1 DM 和广播
- 共享任务列表 (`~/.claude/tasks/{team-name}/`)
- 文件锁实现任务领取 (防 race condition)
- 支持 tmux/iTerm2 分屏显示

### 关键局限

| 维度 | 状态 |
|------|------|
| 跨平台 | Claude Code Only, OpenCode/Copilot 无法使用 |
| 跨机器 | 不支持, 必须同一文件系统 |
| 持久化 | Session 结束即清空, 无数据库 |
| 审计 | 无内建审计, 需自己写 Hook |
| Session 恢复 | `/resume` 不恢复 Teammate |
| 扩展性 | 无远程 API, 无消息队列集成 |
| 状态 | 实验性, 已知内存泄漏 (23GB/hr on Windows) |

### 社区反馈 (GitHub Issues)

- **#33434**: 多 Subagent 并行时按 Escape 会杀死所有 Agent
- **#33384**: Team Teammate 不继承 Hook 和 MCP Server
- **#33462**: 团队成员看不到 Token 用量
- **#33437/#33337**: 长时间运行内存泄漏严重

### atos 机会

Claude Code Teams 对 Claude 用户是"刚好够用"的内建方案, 但**平台锁定是致命缺陷**。atos 不需要替代它, 而是做**跨运行时的通用协调层** — Claude Code Agent 和 Copilot Agent 通过 atos 协作。

---

## 二、多 Agent 编排框架

### 全景对比

| 框架 | 协调模式 | CLI | 存储 | 跨运行时 | atos 差异 |
|------|---------|-----|------|---------|----------|
| **CrewAI** | 顺序/层级编排, Flows 事件驱动 | 有 (`crewai run`) | Pydantic 状态 | LLM 无关 | 需 Python+UV, 重 |
| **AutoGen** (MS) | 三层架构, 消息传递, Agent-as-tool | AutoGen Studio GUI | 异步消息 | LLM 无关 | GUI 优先, 复杂 |
| **LangGraph** | 状态图 (nodes+edges), 条件路由 | 无 | Checkpoint 持久化 | 运行时无关 | Python Only, 无 CLI |
| **OpenAI Swarm** | Agent 交接 (handoff), 无状态 | REPL demo | 无 (stateless) | OpenAI 锁定 | 已废弃, 教学用 |
| **MetaGPT** | SOP 驱动, 角色层级 | 有 (`metagpt "task"`) | 文件 (workspace/) | LLM 无关 | 重量级, 面向代码生成 |
| **ChatDev** | YAML DAG, 语言交互 | Python SDK | YAML+DB | Provider 无关 | 需 Docker, 重 |
| **Agency Swarm** | 定向消息 (`send_message`) | Terminal demo | 手动回调 | LiteLLM 路由 | Python 3.12+, 手动持久化 |
| **Semantic Kernel** (MS) | Coordinator 模式, Agent 即插件 | 有但未文档化 | Thread+向量DB | 真正模型无关 | SDK-first, 非 CLI 原生 |
| **Swarms** | 多模式 (顺序/并行/图/动态) | pip 安装 | 多记忆系统 | 多 Provider | 企业级, Python Only |
| **Google ADK** | 层级组合 (sub_agents) | 有 (`adk eval`) | Cloud/Vertex | 模型无关 | 功能过重 |

### 最接近 atos 的项目

**TICK.md** — Git-backed Markdown 任务协调
- CLI: `add`, `claim`, `done`, `status`, `list`, `watch`, `graph`, `sync`
- 存储: Git + Markdown (YAML frontmatter)
- 跨运行时: 完全无关 (人/AI 都可用)
- **差异**: 只做 Task, 不做 Mail/Presence/SOP

**Agent Message Queue (AMQ)** — Maildir 格式文件系统消息传递
- 异步消息, JSON 元数据 + Markdown body
- 纯文件系统, Unix 工具操作
- **差异**: 面向 2-3 个本地 Agent, 功能单一

**结论**: 没有人在做 atos 想做的事 — **CLI-native 的完整 Agent 协调工具链**。

---

## 三、协议与标准

### A2A (Agent-to-Agent Protocol) — Google → Linux Foundation

| 属性 | 值 |
|------|-----|
| 传输层 | JSON-RPC 2.0 over HTTP(S) |
| 发现机制 | Agent Cards (描述能力和连接信息) |
| 交互模式 | 同步/流式(SSE)/异步推送 |
| 数据格式 | Text, files, structured JSON |
| 采用率 | GitHub 22.4k stars, SDK: Python/Go/JS/Java/.NET |
| 核心理念 | 不透明 Agent 间的互操作 (不暴露内部实现) |

**与 atos 的关系: 互补**
- A2A 是**网络层协议**, 解决"不同机器上的 Agent 怎么对话"
- atos 是**本地 CLI 工具**, 解决"同一项目里的 Agent 怎么协作"
- **推荐**: atos Phase 3 Remote 模式可以采用 A2A 作为 wire protocol

### MCP (Model Context Protocol) — Anthropic

| 属性 | 值 |
|------|-----|
| 架构 | Client-Server (AI App → MCP Server) |
| 用途 | 工具接入, 数据访问, Prompt 模板 |
| 采用率 | Claude/ChatGPT/VSCode/Cursor 均支持, 850+ tools |
| 能否做 Agent 间通信 | **不能** — 这不是 MCP 的设计目标 |

**与 atos 的关系: 正交**
- MCP: Agent ↔ Tools/Data (工具层)
- atos: Agent ↔ Agent (协调层)
- **推荐**: atos Phase 2 提供 MCP Server, 让 Agent 通过 MCP 调用 atos 命令

### Agent Protocol — e2b.dev / AI Engineer Foundation

| 属性 | 值 |
|------|-----|
| 类型 | REST API 规范 |
| 核心 | `POST /tasks` 创建任务, `POST /tasks/{id}/steps` 执行步骤 |
| 采用率 | GitHub 1.5k stars, AutoGPT/Smol Developer |
| 路线图 | 计划加入 Agent-to-Agent 通信 |

**与 atos 的关系: 可借鉴**
- Task/Step 抽象与 atos 的 `task create/done` 类似
- **推荐**: atos Remote API 可考虑兼容 Agent Protocol 端点

### FIPA (经典 Agent 通信标准)

- 1990-2000s 的逻辑 Agent 通信标准, 定义了 ACL (Agent Communication Language)
- **没有被 LLM Agent 社区复兴**
- 但其 **performative 消息类型** (REQUEST, INFORM, DELEGATE, QUERY) 仍有设计价值
- **推荐**: 借鉴消息类型设计, 不采用其重量级 ontology

### 学术界共识

> "Protocol choice impacts performance by up to 36.5%, yet selection is intuition-driven and lacks standardized guidance."

**标准化尚未发生, 但需求明确。** 多篇论文呼吁建立类似电信协议的 LLM-Agent Communication Protocol (LACP)。

---

## 四、竞争定位

### 定位矩阵

```
              复杂度/基础设施需求
                    ↑
                    |
  ChatDev, Swarms   |   AutoGen, Semantic Kernel
  MetaGPT           |   LangGraph, Google ADK
                    |
  CrewAI             |   Agency Swarm
                    |
  ──────────────────┼──────────────────────→ 运行时无关
  Python 锁定        |        atos ★
                    |
              TICK.md (仅 Task)
              AMQ (仅 Mail)
                    |
  OpenAI Swarm      |
  (已废弃)           |
                    ↓
              轻量/CLI-first
```

**atos 占据右下象限: 轻量 + CLI-first + 运行时无关。这个象限目前是空的。**

### atos 的差异化定位

| 维度 | 现有方案 | atos |
|------|---------|------|
| 接口 | Python SDK, Web UI, 编程 API | **CLI-first** (bash 即可使用) |
| 运行时 | 框架锁定或 Python Only | **任何 Agent** (Claude/Copilot/OpenCode/自定义) |
| 安装 | 包管理器+依赖+环境配置 | **`npx atos`** 即可 |
| 存储 | 数据库/服务器/手动回调 | **SQLite** (零配置) |
| 复杂度 | 图/DAG/层级编排 | **简单消息+任务+SOP** |
| 哲学 | 框架驱动的全栈编排 | **Unix 哲学: 做好一件事** |
| 目标规模 | 企业级/千级 Agent | **2-10 Agent 团队** |

### 一句话定位

> **atos: Agent teamwork in your terminal. 任何 Agent 运行时都能用的轻量协调 CLI。**

---

## 五、协议策略建议

### 不要自己发明协议, 分层复用

```
Layer 3 (远程)  →  A2A (Google) 作为 wire protocol      [Phase 3]
Layer 2 (工具)  →  MCP Server 暴露 atos 能力             [Phase 2]
Layer 1 (本地)  →  atos CLI + SQLite (自有, 最简实现)     [Phase 1]
```

### 关键设计借鉴

| 来源 | 借鉴 | 用于 |
|------|------|------|
| FIPA | Performative 消息类型 (REQUEST/INFORM/DELEGATE) | `atos mail` 消息分类 |
| OpenAI Swarm | Handoff 模式 (Agent 间交接) | `atos task update --assignee` |
| CrewAI | Crew + Flow 双模式 (自主+确定性) | SOP (确定性) vs Mail (自主) |
| A2A | Agent Card (能力声明) | `atos team join --role --persona` |
| LangGraph | Checkpoint 持久化 + 恢复 | SQLite + `atos sync` |
| TICK.md | Git-backed 任务 + Markdown | SOP 文件 + git sync |

---

## 六、风险与注意事项

1. **A2A 可能吞噬 atos 的空间** — 如果 A2A 加了 CLI 工具, atos 的差异化会缩小。但 A2A 目前聚焦网络协议, 短期不会做 CLI。
2. **Claude Code Teams 可能开放** — 如果 Anthropic 把 Teams 做成跨运行时协议, atos 的价值会降低。但当前是实验性 + 平台锁定。
3. **"标准之争"陷阱** — 不要试图成为标准, 先做好工具。协议/标准是用出来的, 不是设计出来的。
4. **Python 生态的惯性** — 大多数 AI 开发者用 Python, atos 用 TypeScript/Node.js 是一个赌注。但 CLI 的用户不关心实现语言。
