# 小张对镜像修复的独立本机复验

小张 / zwh9616（AI辅助），2026-11-07；最终实测源码为 **2ec6668475fa99f46d25206a1da8249b784ca4ad**。保留小陈的原失败扫描、最小修复、首轮构建失败及新CI证据，不冒称这些修复是小张编写。

## 实际结果

本机`npm ci`、`npm run setup`在2a06bf8执行退出0；2ec6668的根/前端锁文件逐字节未变，复用该安装。随后在2ec6668运行`npm run gate`退出0。统一门禁四项check/audit/secret-scan/verify全部通过；verify没有跳过扫描，实际构建、导出并扫描MySQL、backend、admin、frontend四个运行制品，全部HIGH=0、CRITICAL=0。Trivy固定摘要、漏洞库元数据、实际image ID、报告SHA及完整原始JSON均保留。Go二进制/Nginx覆盖断言通过，未用空报告当扫描成功，也未忽略未修复项或添加漏洞豁免。

MySQL仍是8.4.13，原官方entrypoint和降权行为保留；实际UID/GID999断言通过。真实默认Compose验证了可信数据库/HTTPS证书、错误证书拒绝、离线迁移与初始化、重复初始化不覆盖口令、登录/刷新/教师切班/学生拒绝/登出、数据库停机503与恢复、全部容器重建后账号与原口令保留、配置失败/日志脱敏/停止回归。原完整真实MySQL身份套件再次通过，包含并发刷新、授权/撤权、事务与六个DDL断点恢复；没有降低断言或替换为mock。

最终版本的远端[CI42362608142](https://github.com/zwh9616/campus-claw-plus/actions/runs/42362608142)也已成功。之前2a06bf8的本机完整gate0为前一阶段，最终报告以本次包含全部应用镜像扫描的版本为准。

## 证据

- [执行摘要与源文件指纹](zhang-image-fix-verification-2026-11-07.json)：实际执行者、版本、命令/退出码、证据摘要及剩余项。
- `zhang-image-fix-gate-2026-11-07.json`：完整门禁原始输出。
- `zhang-image-fix-mysql-2026-11-07.json`、`zhang-image-fix-applications-2026-11-07.json`：实际制品、工具/漏洞库版本、构建与扫描输出。
- `zhang-image-fix-wiring-2026-11-07.json`、`zhang-image-fix-database-2026-11-07.json`：真实HTTPS/数据库运行与恢复证据。
- `zhang-{mysql,backend,admin,frontend}-scan-2026-11-07.json.gz`：四份完整原始扫描JSON，解压SHA在执行摘要中。只含公开代码制品扫描结果，无运行凭据/证书。

## 当前限制与交接

只读复核还发现`frontend/Dockerfile`已使用新安全摘要，但`scripts/toolchain.json.nginxImage`仍保留旧摘要；已在[原PR评论](https://github.com/zwh9616/campus-claw-plus/pull/14#issuecomment-6705442736)交小陈当前窗口同步，历史lesson-07不改。小陈仍持有修改窗口，其真实CHANGES_REQUESTED尚未收口；本报告不构成另一成员批准，不允许绕过main的1位批准、陈旧批准撤销及check来源限制。

02真实浏览器页面/联验、持有人实际证书部署及01归档仍未完成，不把真实API客户端测试当浏览器已交付。本次测试只启停随机命名的本项目临时资源，已清理；不删除无关Docker网络、容器或持久数据。

## 2026-11-08 后续状态（不改写上述受测版本）

#14已由小陈对9175964真实批准并正常合入main c2c34a2，完整main CI42364596741通过；当时待办的Nginx登记已由9175964修正并加入失败断言。上述11月7日本机原件仍严格对应2ec6668，不冒称覆盖11月8日主机入口修复或真实浏览器。原件本次随#18补入仓库，原工作树暂存内容完整保留。
