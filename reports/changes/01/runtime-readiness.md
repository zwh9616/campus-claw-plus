# 小陈运行条件准备

日期：2026-11-04；基线main 2bf12e2。本次仅盘点，不声称部署或依赖已连通；未读取.env或令牌值，未创建真实配置或启动/停止服务。

| 条件 | 实际观察 | 后续准备与归属 |
| --- | --- | --- |
| 历史骨架 | main含React18静态首页、Go health、frontend/backend两服务与v0.0.1-skeleton；此前真实证据保留docs/lesson-07 | 不改写历史，不当新业务已完成 |
| 本次终端Node | 默认Node20.12.2低于package要求22.12；捆绑Node24.22.1可用于文档检查；CI配置Node22 | 显式选择合适Node，避免旧PATH冒充通过 |
| 依赖目录 | 根与frontend node_modules存在，不代表最新锁文件已重装 | 本次无依赖变更；业务实现按锁文件npm ci/setup |
| 本次终端Docker/Go/make | PATH均未找到；根.env不存在 | 完整Go/容器验收未在本次终端执行。实际Docker执行环境由小陈准备，再记录版本与当次输出；不把他人/CI结果写成本机复跑 |
| Compose当前范围 | 仅frontend/backend；主机frontend5173，backend读HTTP_PORT；样例仅空键HTTP_PORT= | 不在01起草中接MySQL/Qdrant/队列/MCP；后续按01/03/10已审规约增量接线 |
| MySQL与初始化 | 当前main未接数据库，无迁移工具/编号/初始化账号 | 小张审01并确认版本/工具，协调00迁移登记；小陈准备隔离数据库、健康和故障恢复环境；真实凭据只在运行环境 |
| 真实模型与密钥 | 本次未检查、未调用；main无模型配置 | 07A按真实提供方/模型/超时/额度确认，密钥不发到仓库或日志；固定资料及拒绝题先准备 |
| MCP | 03未交接，未验证工具协议或容器；00候选地址例外尚未启用 | 等小葛03规约后检查协议/Schema/令牌/超时；不得提前放开私网出站 |
| 统一门禁 | 现有npm ci/setup/check/audit/secret-scan/verify；00实现候选新增合同检查 | 10前置门禁需G2后、规约通过才apply；make入口尚未实现，不能写成可用 |
| GitHub保护 | main当前未保护且规则列表为空；CI成功不等于失败合并被强制阻断 | 小葛/小张及有权限管理员确认required checks；10保留真实红绿和拒绝链，不尝试合并失败版本 |
| 公网/HTTPS/告警 | 本次未验证地址、证书、通知接收人、备份恢复或压测资源 | 10/12按审定方案准备；不因骨架可启动就宣称生产可用 |

下一步先等00 G2及小葛交付03/10规约；小陈审规约后按手册优先10门禁、再03。01现在只起草并交小张审查，不与01实现责任混淆。

## 2026-11-05补充

本次终端重新查询docker/go/mkcert/openssl/caddy，均未在PATH找到，未连接数据库、启动容器或验证HTTPS。仓库锁定Go1.27.3、go.mod1.27.0，这是文件事实而非本机工具已安装。00当前候选75cadbf只追加排班，main仍2bf12e2。

已将运行准备从笼统待定细化为[runtime-plan候选](../../../openspec/changes/2026-11-04-identity-foundation/runtime-plan.md)：MySQL8.4.13及Registry索引摘要、Go驱动v1.10.1、crypto v0.58.0、migrate v4.20.1及各许可/最低Go要求；六个拟议空配置键、TLS/超时/失败行为；迁移校验和和部分DDL恢复、初始化输入以及复用Nginx的同源HTTPS。只核对元数据与官方说明，未安装、拉取、运行或评审批准。MySQL GPLv2与驱动MPL-2.0须按安全规范先确认，不能省略。

可独立推进的准备已写成方案；下一责任人为小张确认01内部选择、00原两人确认公共健康/配置，随后小陈在可用Docker与可信HTTPS环境留真实运行证据。无需生成真实口令或改动现有共享服务来完成文档准备。

## 第二天要求落实后的命令实跑

见[环境检查原始结果](environment-check-2026-11-05.json)和[第二天交接](day-two-checkpoint.md)。显式Node24.22.1/npm10.5.0可用；npm run check退出1，前端类型/构建和foundation通过，因无Docker/Go而在backend检查失败；npm run audit退出0、根与前端0漏洞。npm run verify未运行，未创建.env或启停服务；Go、DB、HTTPS保持未验证。上述是c733ff2上的实际结果，不覆盖原先文档检查与CI记录。
