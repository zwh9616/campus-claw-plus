# 02规约提交检查

执行人：小张授权AI辅助；日期2026-11-05。基线main `2bf12e223e9a1e3bdd9044e32f7e8067df1f7afa`；分支`codex/2026-11-05-frontend-foundation`。验证对象为本提交四份规约，执行时为未提交新增文件，不伪造本提交自身SHA。Windows、Node v25.2.1、OpenSpec 1.13.0（复用根工作区已安装锁定工具，没有安装新依赖）。

```text
node ../../node_modules/@fission-ai/openspec/bin/openspec.js validate 2026-11-05-frontend-foundation --strict
Change '2026-11-05-frontend-foundation' is valid
退出码0

node ../../node_modules/@fission-ai/openspec/bin/openspec.js validate --all --strict
✓ change/2026-11-05-frontend-foundation
✓ spec/project-bootstrap
Totals: 2 passed, 0 failed (2 items)
退出码0
```

全量两项只指本main基线工作区中的02和历史主规约，不冒称同时校验远端01/10。规约六条FEF需求、十五个Scenario，每条有未来验证方式及任务对应；此映射不等于已实现测试。

## 交付检查边界

- 只新增OpenSpec四份文件及元信息、文档证据和共享表；frontend/backend/Compose/配置/依赖/脚本没有修改。
- 仅引用00六个冻结认证操作；无planned业务请求。班级ID输入是明确待审方案，不假造班级列表接口。
- mock测试、真实MySQL/HTTPS联验及人工视觉截图分列，均尚未执行；没有运行页面/容器或伪造样板截图。
- G2/02批准未满足，不apply；G3未满足，不合并业务实现；未发生小葛审批、样板确认或归档。
- 01审查与00终审事实见共享表的真实PR链接；本会话不作BC-SC-01独立阅读证据。
- 单独执行文档链接/场景与任务映射、其他行保留、差异检查，实际结果写入spec-check-results.json。

## 给小葛的审查重点

请按D1的页面范围与教师ID输入、D3/D4的恢复与写请求结果不确定、D5四态、D6线框/组件、D7样板和同版本两档截图、D8 mock/real分离逐项审查。D9未决项必须显式处理，不能以文件齐全或严格校验通过代替可实施性。意见绑定当前head；小张修订后再审。

## main同步补记

00现已合入4cfd61d，本PR已同步main并附00实际集成记录，只有共享表冲突按行整合。上方2项严格校验是初稿时结果；同步后应为00/02两个change加历史主规约共3项。G2现已由00的main CI和本机复验满足；本change批准及D9其他前置未齐，仍不apply。原有链接/任务/场景证据保持原执行版本，后续结果单列。

同步后实际严格校验：00/02两个change及历史主规约，3 passed/0 failed；diff检查退出0。规约正文未改变，00更新仅实际进度/证据与准入索引。
