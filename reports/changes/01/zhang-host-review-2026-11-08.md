# 小张 Windows 主机入口独立复审（2026-11-08）

基线d0db548，实际平台Windows、Node25.2.1/npm11.6.2、Docker Desktop29.8.0。按组长规则直接在#18继续修复和补证，不改已合并#14。

首次完整gate的check/audit/secret-scan通过，四实际镜像扫描0 HIGH/CRITICAL；verify在新ingress创建时因本机默认地址池耗尽失败，原失败见zhang-host-first-*.json。没有删除或停止其他项目、没有放宽网络隔离或失败条件。

只调整隔离验证已有IPAM选择：从现存Docker网段中为data及ingress选择两个不同空闲/24；生产Compose、后端/数据库不发布端口、internal/data及精确代理/32不变。新增占用较大网段/跳过已占用/不同网段/完全耗尽失败回归，check:identity-wiring共5项通过。

修复后先单独verify:identity-wiring退出0，再完整npm run gate四段全0；实际Windows主机环回发布HTTPS、严格CA/SAN、首页200、健康200/mysql up、匿名401、错误CA/SAN拒绝、停止不可达及重建端口复验通过。默认可信TLS身份/越权/旧凭证失效、六DDL恢复/初始化并发幂等回滚、停库503和持久化均保留；四镜像再次实扫全部0 HIGH/CRITICAL，无忽略标志，压缩原件及SHA见JSON。原生浏览器正常信任和02联验另记，不把Node HTTPS当浏览器。

另补入小张11月7日2ec6668本机独立gate与四镜像原件，报告保留原版本及当时未合并事实，后续状态单列；原工作树11份暂存文件完整保留。本次运行输入的SHA随JSON绑定，证据提交不改这些受测文件；最终CI/正式review和实际合并仍按远端当前head办理，01不提前归档。
