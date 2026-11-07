# 01 小陈最终生产入口独立复核

小陈/Kevcco（AI辅助）在独立Docker测试目录同步确切源head2ec6668475fa99f46d25206a1da8249b784ca4ad，未包含用户未提交文件。实际Node22.23.4/npm10.9.9、Docker28.3.3/Compose2.39.1/Make4.3，Go为已锁1.27.3镜像。npm ci、setup及make gate均退出0；check/audit/secret-scan/verify四项全0、notRun为空，verify实际406348ms，未放宽原10分钟门限。源码与最终收口的运行输入逐项SHA相等，见[完整绑定与环境记录](chen-final-review-2026-11-07.json)、[gate原件](chen-final-gate-2026-11-07.json)及[脱敏控制台](chen-final-gate-2026-11-07.txt)。

| 独立执行项 | 实际结果 |
| --- | --- |
| 最终四个真实制品 | MySQL/backend/admin/frontend全部HIGH=0、CRITICAL=0，实际镜像ID、数据库版本时间及压缩扫描原件列在JSON；与[CI原件](runtime-image-ci-2026-11-07.json)分开记录，不复制CI充本机结果 |
| 正式Nginx/Go/MySQL链路 | 可信同源HTTPS与DB TLS正常；错误CA/SAN拒绝、必需配置/占用端口失败，健康与日志/探针唯一合同通过 |
| 生产入口越权/失效 | 学生切班403，原身份me仍200；刷新旧Cookie401、切班旧Bearer401、登出旧Bearer/刷新401；不是原生浏览器页面测试 |
| 服务层与真实持久化复核 | reviewer自编独立用例完整重跑：同班本人/他人、跨班及未知动作拒绝；CSRF拒绝六表行不变，登出/用户撤销及审计/日志标识一致；此组使用可信测试HTTPS与真实MySQL，不冒充生产资源路由 |
| 迁移/初始化/恢复 | 六处DDL中断与前向恢复、结构/摘要异常阻断、初始化并发/回滚通过；默认入口重复初始化不改口令、停库503与恢复、重建容器后原账号/班级/口令保留 |

运行详情见[默认接线结果](chen-final-wiring-2026-11-07.json)、[真实身份/迁移结果](chen-final-identity-2026-11-07.json)及[应用镜像](chen-final-app-images-2026-11-07.json)。运行目录中的临时凭据/私钥已清理，测试结束无运行容器；本次临时授权已移除、重连被拒绝，本地临时密钥已删除。

准备阶段失败保留：系统Node12不符合要求；首次提取隔离工具时缺共享库，补齐后直接loader启动又使execPath错误，make gate真实退出2、后续项未运行，见[初次门禁原件](chen-final-tool-bootstrap-failure-2026-11-07.txt)。改用官方校验和验证的Node22.23.4归档后，未改项目断言或门禁，完整重跑全0；失败不被覆盖为通过。

结论：01服务/部署/镜像的本次问题已修复，独立终审所需越权、失效及数据库恢复已真实重放。最终远端批准仍须绑定收口head及其绿CI后正常合并；02真实页面/浏览器、合入后集成main和01归档继续待办，不将本次服务端通过写成整轮完成。

收口补齐小张指出的Nginx元数据：toolchain.json与实际Dockerfile统一为安全摘要583b7f2f…，原foundation检查新增两处摘要必须一致。临时还原旧登记时真实退出1，恢复原字节后退出0；8份压缩扫描原件校验和、19项生产运行输入及57个本地文档链接核对通过，见[收口检查](closeout-local-check-2026-11-07.json)。此检查脚本变动不改变已独立复跑的生产制品/配置；完整远端门禁仍须在当前收口head重跑。
