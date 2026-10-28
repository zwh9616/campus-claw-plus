## Why

CampusClaw 长期面向高校教师与学生，以教学班为隔离边界，使用 RAG 与可控智能体降低重复答疑、辅助批改和学习反馈的成本。团队仓库当前只有 README 与忽略规则，尚无统一工程约定；第7课先建立可复现的最小骨架，避免三人各自实现不一致的接口与启动方式。

## What Changes

- 建立本变更的范围、设计、可观察场景、A/B/C 任务及验收证据关系。
- 由 B 准备工程规范、基础文档及 React 18 + TypeScript + Vite 的 Hello World 页面。
- 由 C 准备 Go net/http 服务、必需配置 HTTP_PORT、GET /health、必要测试及前后端容器。
- 通过根目录 compose.yaml 一套命令启动、检查、停止前后端，并由 B 独立复现、A 核对场景。
- 使用分支与 PR 协作，保存严格校验、贡献、评审及联合验收记录；实际通过后再标记完成和打标签。

### Non-goals

本轮不实现登录、真实用户/课程/作业、数据库、知识库索引、RAG 问答、LLM 调用、智能体工作流、Skill/MCP 业务、自动批改、错题、统计或生产 HTTPS。学期说明中的 MySQL、Qdrant、runner、持久化 worker 等保留后续规划，不能写成本轮已交付；不迁入个人旧仓库的 Python 应用或真实密钥。

## Capabilities

### New Capabilities

- `project-bootstrap`: 最小页面、Go 健康接口、端口配置失败、一键启停、五类规范与可追溯验收。

### Modified Capabilities

无；团队仓库尚无既有能力规约。

## Impact

计划涉及 frontend/、backend/、compose.yaml、.env.example、README.md、AGENTS.md、docs/standards/ 和 docs/verification.md；本 A 分支只提交 OpenSpec 与 A 的校验/交接文档，不替代 B/C 的实现。本轮运行不需要数据库、外部模型、外部密钥或生产基础设施。

任务书的 A/B/C 是本次分工；学期说明中的具名长期角色不用于重新分配本课职责。技术建议已经请求人确认作为评审草案，仍须 B/C 对实现与端口约定进行评审。
