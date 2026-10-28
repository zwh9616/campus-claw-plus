# 第7课 B/C 实现与本机验收
日期：2026-10-28（Asia/Shanghai）。执行账号：zwh9616；B/C技术工作经请求人授权由同一账号完成，未冒用其他组员身份或批准。

## 范围与源码
规约PR #1已合并，基线a651871。当前记录为该基线加本实现PR工作树的真实验证；机器报告中的commit字段是执行时Git基线，不能把它误当尚未提交代码的提交号。实现源码、锁文件和镜像构建随本PR提交，CI对PR实际提交重新执行同一套检查。
当前只有静态前端、Go健康服务、配置失败、日志、探针及双容器。无登录、数据库、模型或教学业务。

环境：Windows / PowerShell；本机Node25.2.1、npm11.6.2；Docker29.8.0、Compose5.5.1。Go工具链1.27.3（固定摘要容器），React18.3.1、Vite8.3.5、TypeScript7.0.2；Nginx1.30.6。精确镜像见Dockerfile和scripts/toolchain.json。
本机.env仅HTTP_PORT=18080，前端5173；8080被无关项目占用，本次未停止该项目。

## 已执行命令与结果
| 命令/操作 | 实际结果 |
| --- | --- |
| npm ci、npm run setup | 按根与前端独立锁文件安装 |
| npm run check | 基础检查、类型、生产构建、Go vet/test/build、OpenSpec严格校验通过 |
| npm run audit | 根与前端均0 vulnerabilities |
| npm run secret-scan | Gitleaks8.30.1，官方包SHA256已校验；全Git历史与暂存内容扫描，无命中，输出全量脱敏 |
| npm run verify | 真实进程/容器配置、健康、日志、停止再启动通过；仅本机，不算跨机器 |
| 技能quick_validate.py（UTF-8） | 两份仓库技能通过 |
| 故意破坏端口上限 | 把>65535临时改为>65536后配置测试退出1；finally恢复后Go门禁通过 |
| 浏览器1440×1000 / 360×800 | 无横向溢出、无假业务入口、无fetch/xhr API请求、无运行时异常；404可通过Tab/Enter返回首页 |
| git diff --check / 工作流YAML | 无空白错误；结构有效 |

## 需求/场景到证据
| PB/SC | 证据 | 当前判定 |
| --- | --- | --- |
| PB-01/SC-01 | HomePage与浏览器截图、页面HTTP200 | 本机通过；另一成员复核待办 |
| PB-02/SC-02/03 | handler_test、probe_test、容器healthy，JSON为status=ok/dependencies={} | 本机通过，无外部依赖 |
| PB-03/SC-04 | 缺失、空字符串、空白分别运行镜像内真实/server | 各退出2，单行JSON包含HTTP_PORT原因 |
| PB-03/SC-05 | abc/0/-1/65536分别真实进程运行；边界单元含1/65535/溢出/全角数字 | 失败均非零，无默认回退 |
| PB-03/SC-06 | 合法端口、首尾空白启动后执行镜像内自检 | 退出0，配置修正后恢复 |
| PB-03/SC-07 | 在已监听的backend容器内启动第二个/server | 新进程退出1且日志指出HTTP_PORT listen failed |
| PB-04/SC-08 | 两镜像源码构建、backend healthy、本机两个地址可访问 | 本机通过，另一成员自己机器未执行 |
| PB-04/SC-09 | 空env文件且移除进程HTTP_PORT执行compose config | 非零且指出HTTP_PORT |
| PB-04/SC-10 | down后两个地址不再服务，再up并访问health | 通过 |
| PB-05/SC-11/12 | 五类规范、AGENTS强制读取、技能、空值样例与忽略检查 | 文件/工具检查通过，实质交叉评审仍待办 |
| PB-06/SC-13 | OpenSpec1.13.0严格校验 | 通过 |
| PB-06/SC-14/15 | PR #1已真实评审/修订/合并；本实现PR待他人评审 | 未宣布最终全组通过或打标签 |
| PB-07/SC-16/17 | JSON日志解析、两次不同服务端ID与X-Request-ID一致；不含测试查询原值/客户端标识 | 本机通过 |
| PB-08/SC-18/19 | 当前仅已有会话实现与一次真实变异测试 | 无历史会话/规则复验仍待执行 |
| PB-09/SC-20..23 | 后续失败合同已写入规约 | 仅文档，未实现/未运行，未获课程豁免 |

## 可复现证据
- [本机容器/进程报告](evidence/local-results.json)，每条包含实际退出码或健康信息。
- [桌面截图](evidence/desktop.png)、[移动截图](evidence/mobile.png)。
- 后端Go单元在backend/internal各包，验收脚本scripts/verify-skeleton.mjs，可直接重跑；机器原始报告/变异日志/扫描结果在output/verification/，默认不入Git。
- Nginx辅助访问日志为JSON，耗时字段duration_seconds；正式Go请求日志duration_ms，单位差异已在部署规范与design D6登记。

## 尚未完成，不能代填
1. 无历史Harness会话仅凭仓库路径/变更名验证SC-18，及后续新会话对产物执行SC-19。
2. 另一成员自己的机器签出同一提交，按README从零启动并留执行人/环境/结果。
3. A/C或其他成员对本实现PR进行实质交叉评审，A核对最终场景；本账号不能假装另一成员已批准。
4. 全部本轮必验项通过后再归档并复核合入、由C打最终骨架标签；当前没有上一已验收运行标签，回滚演练未完成。
