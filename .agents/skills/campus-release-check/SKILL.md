---
name: campus-release-check
description: 按CampusClawPlus规约验证构建、配置、日志、容器启停与归档准备，保留真实证据；不自动授权远端合并或生产发布。
---
# 按规范验证版本
先读AGENTS、docs/standards/deployment.md与security/testing规范及当前OpenSpec。
1. 确认目标提交、环境、上一已验收版本（如有）；npm ci、npm run setup、npm run check、npm run audit。
2. 按README运行secret scan；填本机.env，运行npm run verify验证真实进程与容器。仅操作本项目服务，不停止无关容器。
3. 记录健康HTTP/JSON/标识、配置失败退出码、日志单行JSON、停机再启动和实际耗时。未执行的项留待办。
4. 新会话和另一成员自己机器的验收必须真实留证；首版无上一可运行标签则回滚标未演练。
5. 全组必验项通过后，且已获授权，才归档变更并复核合入，再打最终版本标签；不以本机成功代替全组验收。
产出docs/lesson-07/记录与未完成清单；技能不扩大当前操作授权。
