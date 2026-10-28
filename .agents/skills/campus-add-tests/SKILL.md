---
name: campus-add-tests
description: 为CampusClawPlus行为变更补充关联PB/SC的正常、失败、边界测试，验证失败阻断；不用于纯文档排版。
---
# 按规范补测试
输入为修改范围和已有用例。先读AGENTS、docs/standards/testing.md及当前OpenSpec。
1. 将Scenario映射用例，标明本轮与未来合同，不能让PB-09产生本轮业务代码。
2. Go测试放包内*_test.go，正常/失败/边界分组；注入环境、日志和监听器，断言真实契约/副作用。
3. 执行npm run check；真实容器用npm run verify，npm run audit与secret scan另按README执行。缺环境如实报告。
4. 关键逻辑临时做一次可恢复破坏，确认相关测试失败，立即恢复并重跑；不触碰他人未提交改动。
产出用例、PB/SC映射、实际命令/退出码/限制，写docs/lesson-07/。不伪造独立会话或他人机器结果。
