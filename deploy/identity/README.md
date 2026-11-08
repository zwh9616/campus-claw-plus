# 01 默认MySQL / HTTPS身份部署

R7子包已由小张接受并原子接入根compose.yaml和正式cmd/server；deploy/identity/compose.yaml只保留历史隔离子包，不是默认启动入口。现行配置键见inputs.json及公共active登记。实际终审、页面和集成结果见共享表。

## 持有人准备的本机文件

真实值仅保存在被忽略的`output/identity-local/`，限制目录及文件读取权限，不把文件复制到构建上下文、截图或报告。Node>=22.19、Docker及Compose需可用。

| 文件 | 内容与约束 |
| --- | --- |
| `root-password` | 非空随机MySQL root口令，文件注入，应用不使用root |
| `initialize.sql` | 新卷首次创建确定数据库、独立应用DML账号与离线DDL账号；两者均`REQUIRE SSL`。应用仅SELECT/INSERT/UPDATE/DELETE；离线另加CREATE/ALTER/DROP/INDEX/REFERENCES，不授全局权限。真实用户名/口令由持有人在本机提供，不写仓库。已有卷不自动重跑，变更账号走显式离线管理 |
| `ca.pem`、`server.pem`、`server.key` | 可信数据库CA、SAN含`mysql`的证书及私钥。容器只读输入，启动器复制到tmpfs，mysql私钥0400；持久卷仅保存数据库 |
| HTTPS证书/私钥 | 由既有`HTTPS_CERT_FILE`/`HTTPS_KEY_FILE`给绝对路径，只读挂载。SAN匹配实际运行主机，浏览器/客户端信任CA；不以`-k`验收，不在机器上自动安装信任 |
| `backend.env` | 精确三个键：`MYSQL_DSN`、`MYSQL_CA_FILE`、`AUTH_TRUSTED_ORIGIN`。CA容器路径`/fixtures/ca.pem`，DSN为专用DML账号、`tcp(mysql:3306)`、确定库及`tls=true`。Origin为实际HTTPS主机与发布端口 |
| `admin.env` | 精确三个键：`MYSQL_DSN`、`MYSQL_MIGRATION_DSN`、`MYSQL_CA_FILE`。离线DSN使用不同账号、同一目标，仅此处允许`multiStatements=true`。后端不挂载此文件，不读取迁移凭据 |
| `seed.json` | 持有人本机准备的严格初始化JSON，经STDIN输入；格式、重复执行和回滚遵循01 R4及[离线入口](../../backend/cmd/identity-admin/main.go)。不内置默认密码 |

根本机.env提供HTTP_PORT、五个IDENTITY_*及HTTPS_CERT_FILE/HTTPS_KEY_FILE；其余进程键按上表分别放backend.env/admin.env，代理CIDR由Compose派生精确/32。这是运行输入，不是新增`.env.example`，不要提交。主机、路径、代理地址和端口均由持有人本机填；发布端口1..65535，Origin准确包含非443端口。测试器独占网络中使用端口0仅供Docker自动分配，不能直接抄为部署配置。

## 默认入口启动与管理

先选择与现有Docker/本机网络不冲突的CIDR，显式创建独占内部代理网络：`docker network create --internal --subnet 选定CIDR campus-identity-proxy`。Docker固定代理地址要求用户显式指定子网，单纯自动分配网络不支持。用`docker network inspect --format '{{json .IPAM.Config}}' campus-identity-proxy`查看网段，选择未占用IPv4给Nginx并填`IDENTITY_PROXY_IP`；`IDENTITY_PROXY_NETWORK`填网络名。后端只信任该地址/32，MySQL与后端均不发布主机端口。网络冲突应换本项目网络，不能停止别的项目；自动测试先探测可用网段再显式创建，遇竞争失败即退出。

所有命令从仓库根运行，以下`LOCAL_ENV`代表根本机.env路径，可直接替换；使用`--project-name`保持同一项目名：

```text
node scripts/identity-compose.mjs LOCAL_ENV --project-name campus-identity-review --profile tools build admin backend frontend
node scripts/identity-compose.mjs LOCAL_ENV --project-name campus-identity-review up -d --wait --wait-timeout 120 mysql
node scripts/identity-compose.mjs LOCAL_ENV --project-name campus-identity-review run --rm -T admin migrate
node scripts/identity-compose.mjs LOCAL_ENV --project-name campus-identity-review run --rm -T admin check
```

初始化将本机JSON经STDIN输入：PowerShell用`Get-Content -Raw 本机seed文件 | node scripts/identity-compose.mjs LOCAL_ENV --project-name campus-identity-review run --rm -T admin initialize`；支持重定向的shell用同一命令末尾`< 本机seed文件`。不要把口令放参数。迁移失败非零时先检查dirty/实际结构与摘要，按已有01恢复流程执行`admin repair VERSION`后检查/重试，不盲目force或删库。

```text
node scripts/identity-compose.mjs LOCAL_ENV --project-name campus-identity-review up -d --wait --wait-timeout 90 backend frontend
node scripts/identity-compose.mjs LOCAL_ENV --project-name campus-identity-review down --timeout 15
```

`down`保留命名数据库卷；不得给真实数据环境加`--volumes`。应用不会自动迁移/种子初始化。仅发布`127.0.0.1:配置端口`的HTTPS，前端与冻结身份API同源。网关覆写单一`X-Real-IP`、移除客户端`X-Forwarded-For`，不记录URI/凭据访问日志。数据库探针只是TCP进程存活；真正的TLS/迁移检查由离线工具执行，应用健康每次真实Ping，HTTPS客户端另验载荷和请求标识。

主机入口使用Compose自管的`ingress` bridge，仅frontend加入；内部`proxy`仍用于Nginx精确/32到backend的转发，`data`仍internal，backend/MySQL/admin不加入入口网且不发布端口。不要仅把frontend放在internal网络后就认为主机映射可用。该结构沿用[Docker官方前端桥接+内部后端示例](https://docs.docker.com/engine/network/)；没有新增配置键或放宽TLS/Origin。停止项目时Compose清理自己的入口网，外部proxy网络仍由持有人管理。

不要分享`docker compose config`展开结果或容器完整inspect，它们含凭据。本机包装器仅校验键、文件和Origin，不打印值；它不会签发或替代证书。实际TLS可信性由客户端验证，不存在“配置文件存在即可信”的结论。

## 自动验证和装配交接

`npm run check:identity-wiring`检查输入边界、进程凭据分离、只读挂载及代理规则，已纳入check。`npm run verify:identity-wiring`生成仅测试使用的临时CA/随机凭据，在新建独占项目中验证离线迁移/重复初始化、真实同源HTTPS、错误CA/主机名拒绝、200/503健康、登录/退出/旧凭证401、停库恢复及完整重建后账号/班级不变；最后仅清理自己随机项目及测试卷/密钥，脱敏结果留在`output/identity-wiring/results.json`。完整verify仍先执行原骨架与原身份测试，不以此替换。

小张已接受输入并在本实施提交同步正式入口、默认Compose、严格健康探针/Schema和active空样例；由小陈复核最终head。探针读取真实server健康，拒绝旧空依赖成功。G3、镜像漏洞扫描、02真实浏览器和最终main验收继续按共享表，生产API测试通过也不勾尚未完成的页面/整体终审。

2026-11-08入口补测：`verify`新增从运行Docker命令的实际主机连接`127.0.0.1`随机发布端口，验证证书链与DNS SAN、首页200、唯一MySQL健康200、匿名me401、错误CA/SAN拒绝；停机后连接拒绝、重建后重新发现端口并复验。连接目标使用环回但证书校验仍使用配置的测试主机名，不修改系统信任、不禁TLS验证。容器内原完整身份/数据回归保留。此测试不冒称正常信任链的原生浏览器或Windows Docker Desktop复测；各平台实际结果见共享表。

实现依据：[官方MySQL入口](https://github.com/docker-library/mysql/blob/master/8.4/docker-entrypoint.sh)的`_FILE`及新卷初始化行为；[Nginx代理指令](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)与[HTTPS配置](https://nginx.org/en/docs/http/configuring_https_servers.html)。镜像版本与许可仍沿用01 R1，不新增运行依赖。
