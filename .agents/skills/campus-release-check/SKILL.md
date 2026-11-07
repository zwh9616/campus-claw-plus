---
name: campus-release-check
description: 按CampusClawPlus当前规约验证构建、配置、日志、容器启停与归档准备，保留真实证据；不自动授权远端合并或生产发布。
---
# 按规范验证版本
先读AGENTS、docs/standards/deployment.md与security/testing规范及当前OpenSpec，确认当前change与G1/G2/G3。
1. 确认目标提交、工作树状态、环境、上一已验收版本（如有）；npm ci、npm run setup、npm run check（包含合同检查）、npm run audit。保留原子项，任何失败阻断。
2. 按README运行secret scan及生效的统一gate；npm run verify验证真实制品、进程与容器。样例只含config-register.active登记的空值键，按identity-phase.current_phase核对当前配置/健康；不把历史00仅HTTP_PORT套用到已激活身份阶段，不打印真实值。仅操作本项目服务，不停止无关容器。
3. 记录健康HTTP/JSON/标识、配置失败退出码、日志单行JSON、停机再启动和实际耗时。当前身份阶段为frontend/backend/MySQL及离线tools，健康每请求真实Ping、200/mysql=up与503/mysql=down；探针只接受精确成功载荷，不保留空依赖回退。真实制品扫描、TLS、迁移/初始化及持久卷按当前01验收；新增依赖仍须在对应已批准change同步接口、探针、测试和规则。未执行的项留待办。
4. 新会话和另一成员自己机器的验收必须真实留证；无上一可运行版本则回滚标未演练。旧第7课例外不自动适用于本轮，合同样例不等于真实业务交付。
5. 本change必验项与两人审查通过后，且已获授权，才按远端门禁合入、在集成提交复验，证据齐后归档/发布；不以本机成功代替小葛终审或全组验收，不伪造他人批准。00的G2及10的G3按design D8判定。
产出reports/changes/<编号>/记录与未完成清单，同步docs/project-status.md；docs/lesson-07与archive保留历史。技能不扩大当前操作授权。
