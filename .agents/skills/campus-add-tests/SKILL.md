---
name: campus-add-tests
description: 为CampusClawPlus当前change补充关联Requirement/Scenario的正常、失败、边界测试，验证失败阻断；不用于纯文档排版。
---
# 按规范补测试
输入为修改范围和已有用例。先读AGENTS、docs/standards/testing.md及当前OpenSpec，确认G1/G2/G3和本change准入。
1. 将当前Scenario映射用例，区分本轮可执行合同、运行实现和未来责任；旧PB/SC只指历史骨架，不能让PB-09或planned端点产生本轮业务代码。00使用BC-SC，后续使用各自change编号。
2. 合同用JSON Schema2020-12单源和OpenAPI3.1解引用双路径检查同批正反例；跨字段、状态序列和可信rubric另测语义。Go测试放包内*_test.go，正常/失败/边界分组，注入环境、日志和监听器，断言真实契约/副作用。未来授权/事务/模型场景必须留真实运行证据，不能以合同fixture替代。
3. 执行npm run check（含check:contracts）；真实容器用npm run verify，npm run audit与secret scan另按README执行。保留旧门禁，缺环境如实报告。
4. 关键逻辑临时做一次可恢复破坏，确认相关测试失败，立即恢复并重跑；不触碰他人未提交改动。
产出用例、当前Requirement/Scenario映射、实际命令/退出码/限制，写reports/changes/<编号>/并同步docs/project-status.md。历史docs/lesson-07与archive保留，不把旧范围例外推广到本轮。不伪造独立会话、他人审查或跨机器通过。
