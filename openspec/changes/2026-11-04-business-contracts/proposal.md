## Why

主干2bf12e2已交付最小骨架，但AGENTS、规范、检查脚本仍以“仅骨架”为边界。三人将并行开发身份、页面、检索、任务及AI，必须先冻结公共数据和失败语义，并明确旧规则的适用阶段，否则会出现两套接口或把局部测试当真实验收。

## What Changes

- 00由小葛写规约并终审，小张审规约并落实公共合同与规则；不增加小陈为00审批人。
- 冻结01/02所需认证接口与公共基础字段；SSE、任务、资料、评分等后续候选按端点矩阵明确责任change，冻结前禁止接线或生成任意object占位。
- 明确00到13的起草、apply、合并和真实验收前置；区分G1规约批准、G2合同规则合入复验、G3门禁生效；下游apply须G2，所有业务实现PR合并须G3，10前置门禁自身无循环依赖。
- 小张在00实现PR落实机器可读契约、AGENTS、五类规范、测试/发布技能与规则检查；保留已有npm入口与历史骨架证据。
- 对project-bootstrap的适用阶段作显式修订，不倒改archive和docs/lesson-07，不变更当前健康响应。

### Non-goals

本规约PR不实现登录、数据库、业务API、前端业务、RAG、模型、MCP或任务worker；不关闭现有CI、不放宽历史密钥规则、不假冒小张评审。03/10可提前起草，apply仍受00审查与各自依赖限制。

## Capabilities

### New Capabilities
- `business-contracts`: 业务阶段公共行为、规则迁移与两人交接门禁。

### Modified Capabilities
- `project-bootstrap`: 将PB-01与PB-09的“本轮”明确限定为历史骨架阶段，允许经批准的新change扩展业务，不修改历史运行结论。

## Impact

00实现预期涉及docs/contracts/、AGENTS、五类规范、两项campus技能、scripts/check-foundation.mjs及契约检查入口；新增证据进入reports/changes/00/。本PR只含OpenSpec和规约自检/交接/当天进度，未生成上述实现。身份由01、前端由02、工具服务由03、资料由04、任务由05、AI由07A/B/C、成绩由08分批实现。
