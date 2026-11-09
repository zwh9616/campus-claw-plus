# 01运行、迁移与公共合同冻结方案

日期：2026-11-06。小陈提出方案，小张依据 72fe59b 的真实复审和组长“审查者直接修复”规则完成公共登记。本文件 R1/R4 是 01 版本、口令及初始化的冻结依据；配置、健康和迁移保留号以 [公共阶段登记](../../../../docs/contracts/identity-phase.json)、[配置登记](../../../../docs/contracts/config-register.json) 和 [原子切换设计](../../2026-11-06-identity-public-contracts/design.md) 为准。最终批准绑定 PR 当前 head；尚未安装依赖或运行数据库。

## R1 版本、许可及可复现来源

| 组件 | 冻结选择 | 官方来源与已知事实 | 实施前仍需完成 |
| --- | --- | --- | --- |
| MySQL | 8.4.13 Community，InnoDB | [官方镜像清单](https://raw.githubusercontent.com/docker-library/official-images/master/library/mysql)含8.4.13；2026-11-05 Registry HEAD解析为mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902；[上游许可](https://raw.githubusercontent.com/mysql/mysql-server/mysql-8.4.13/LICENSE)为GPLv2并有附加许可说明 | 小张已认可课程项目用途/许可处理；实施时保留上游声明与源码获取说明，核对平台子摘要、实际版本、安全扫描及隔离启动，不把HEAD元数据当拉取运行 |
| Go MySQL驱动 | github.com/go-sql-driver/mysql v1.10.1 | [go.mod](https://raw.githubusercontent.com/go-sql-driver/mysql/v1.10.1/go.mod)最低Go1.24.0；[许可](https://raw.githubusercontent.com/go-sql-driver/mysql/v1.10.1/LICENSE)MPL-2.0 | 小张已认可课程项目用途/许可处理，仍待01批准后引入；保留许可、用途及间接依赖清单，再锁go.mod/go.sum |
| 口令函数 | golang.org/x/crypto v0.58.0 的argon2 | [版本模块](https://raw.githubusercontent.com/golang/crypto/v0.58.0/go.mod)最低Go1.26.0；[许可](https://raw.githubusercontent.com/golang/crypto/v0.58.0/LICENSE)BSD-3-Clause | 仅使用argon2及必要依赖；锁文件、构建和漏洞检查由未来实现验证，不声称选定版本即零漏洞 |
| 迁移 | github.com/golang-migrate/migrate/v4 v4.20.1；仅mysql与iofs驱动 | [发布](https://github.com/golang-migrate/migrate/releases/tag/v4.20.1)、[go.mod](https://raw.githubusercontent.com/golang-migrate/migrate/v4.20.1/go.mod)最低Go1.25.11、[许可](https://raw.githubusercontent.com/golang-migrate/migrate/v4.20.1/LICENSE)MIT | 独立离线迁移入口调用库，凭据不传命令行；补R3校验和机制，不能假设库自动校验已发布SQL内容 |
| HTTPS入口 | 复用当前已锁摘要的Nginx，不另加代理产品 | scripts/toolchain.json登记Nginx1.30.6；[Nginx HTTPS配置](https://nginx.org/en/docs/http/configuring_https_servers.html)提供证书/私钥入口 | 公共合同批准后由01实施接线，TLS配置、只读证书挂载和实际浏览器/客户端验收仍待运行证明 |

当前仓库backend/go.mod为Go1.27.0、工具链锁1.27.3，满足上述模块声明的最低版本只是静态对照，并非已经成功解析、构建。小张在[PR #6逐项反馈](https://github.com/zwh9616/campus-claw-plus/pull/6#issuecomment-6659982126)接受上述精确版本及项目用途/许可处理方案，但公共登记、实际解析/构建、镜像扫描和分发声明仍未完成；apply前重核上游安全信息、校验锁文件和必要补丁，不能使用latest漂移，也不能把方案接受当成运行或未来商业分发许可结论。

冻结口令参数：Argon2id v19、m=19456KiB、t=2、p=1，密码学随机盐16字节、输出32字节，保存带版本/参数/盐/输出的可解析格式。19MiB/t2/p1来自[OWASP口令存储建议](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id)，盐与输出长度是本项目已确认选择。解析不允许任意超大m/t/p耗尽内存，01只接受本次冻结参数；不存在账号也执行同参数的虚拟口令校验。初始化新口令12..128 Unicode码点；登录仍按00接收1..128，不偷偷改变LoginRequest。改密服务采用同一创建规则，不做自动trim。必须用SC-02/03/17和固定资源基准验证，不能因耗时直接降参数。

R1镜像修复补记（2026-11-07，小陈审修候选）：原官方摘要独立扫描失败2 CRITICAL/33 HIGH。保留服务端8.4.13、官方基础摘要和entrypoint；[同一衍生Dockerfile](../../../../deploy/identity/mysql/Dockerfile)通过RPM移除未使用mysql-shell，使用原gosu1.19源码及SHA256校验归档、已锁Go1.27.3重建降权程序，保留LICENSE。默认/隔离Compose及真实身份验证复用该构建；`verify`增加实际制品的Trivy0.76.2固定摘要扫描、真实UID/GID降权与版本断言。此为现有01安全命中的最小修复，不改变公共健康/认证/配置合同；构建、扫描和数据库回归实际通过前不得登记安全修复完成，当前结果见共享表。

## R2 配置空键及失败合同（已冻结登记，尚未运行生效）

七键已进入 config-register.frozen；当前 active/.env.example 仍仅 HTTP_PORT。01 引入真实数据库的受审实现提交按公共 D1 同步激活并扩展空值样例；服务器固定900/604800秒和限流参数，不另增绕过安全值的开关。

| 冻结空键 | 使用者 / 机密 | 必填和校验 | 失败与时限 |
| --- | --- | --- | --- |
| MYSQL_DSN= | 后端 / 是，含连接凭据 | 只允许TCP目标及确定库名；禁止root、skip-verify、preferred降级、multiStatements与明文连接；专用DML账号 | 缺失/空白/格式非法启动非零，错误只写键名；连接/读/写各3秒，首个需DB操作起单请求共用5秒截止；明确不可达503，截止到期504 |
| MYSQL_MIGRATION_DSN= | 受控迁移/初始化入口 / 是 | 单独最小DDL权限账号；服务进程不读取；继承业务DSN的TCP目标、确定库名、CA/主机名校验及禁止root/明文/降级规则，唯一允许差异为离线DDL权限和工具所需multiStatements；不可复用到业务池 | 入口缺配置或与业务连接目标/TLS约束不一致时非零；连接3秒、迁移锁等待10秒、每条DDL30秒；失败标dirty且非零；检查实际结果再恢复 |
| MYSQL_CA_FILE= | 服务及迁移入口 / 路径非机密，内容是信任材料 | 只读CA文件，服务端证书链及目标主机名必须验证；实际TLS要求不靠DSN自行关闭 | 缺失/不可读/证书无效启动或迁移非零；不把CA、DSN或底层错误正文写日志 |
| AUTH_TRUSTED_ORIGIN= | 后端 / 非机密 | 单个HTTPS origin，含准确主机/端口；不含userinfo/path/query/fragment/通配符/null | 缺失/非法启动非零；不匹配请求403，无隐藏HTTP回退 |
| AUTH_TRUSTED_PROXY_CIDRS= | 后端 / 非机密 | 仅在同源代理接线阶段启用，填已登记的代理对等端CIDR；拒绝0.0.0.0/0、::/0、空段和未识别地址；Nginx覆写单一X-Real-IP，后端仅在对等端命中登记范围时读取并校验该单一IP | 接线时缺失/非法启动非零；不信任客户端自报X-Forwarded-For；其他对等端只使用直连源 |
| HTTPS_CERT_FILE= | Nginx接线 / 非机密路径 | 只读证书链文件，SAN匹配运行主机 | 缺失/不可读/证书不匹配不启动或验收失败 |
| HTTPS_KEY_FILE= | Nginx接线 / 私钥及其运行路径按机密管理 | 只读、最小权限；不入Git/构建上下文/镜像 | 缺失/不可读不启动；不自动创建或打印私钥 |

MYSQL_DSN等敏感值通过运行环境或受控文件注入，禁止在脚本命令参数/日志/错误里展开。5秒预算从请求完成传输框架校验、即将进行首个依赖DB的操作时开始，连接/查询/事务共用同一截止，不为重试重置；连接明确拒绝/断开为503 DEPENDENCY_UNAVAILABLE，截止到期为504 UPSTREAM_TIMEOUT。提交前失败回滚，不能签发Cookie/访问凭证；若数据库COMMIT结果不明，返回504且不发新凭证，标记待核查，不自动重试或断言数据库一定未改变，须核对会话版本后恢复。MySQL容器自身初始化账号、卷及证书配置由01实施接线覆盖，10后续复用并验证运行观测；不能只列应用键便宣称完整Compose已具备。HTTP_PORT沿用当前合同。会话凭证使用随机量和持久摘要，不额外创造未评审JWT签名密钥。

## R3 迁移编号、校验和及恢复

000001..000003 已在 identity-phase.json 保留，文件名和依赖固定见下表，实际 SQL 尚未创建，不编造摘要。SQL 通过 embed.FS/iofs 只读内嵌到离线迁移程序；server 不自动 DDL，不引入 ORM 或其他数据库驱动。

| 保留编号 / up文件 | 内容及依赖 | 兼容和失败修复边界 |
| --- | --- | --- |
| 000001_identity_users_classes.up.sql | 用户、班级和成员关系；不依赖业务迁移 | 只扩展新表/索引，不插真实账号；逐表后置检查，未完成不得初始化 |
| 000002_identity_sessions.up.sql | 会话和访问摘要；依赖000001 | 新会话表为空才启用身份服务；部分DDL按实际结构完成前向修复，不清空既有用户数据 |
| 000003_identity_auth_audit.up.sql | 脱敏身份审计；依赖000001/000002 | 仅追加审计结构，不提供查询API；缺表/索引时保持dirty、禁止启动，不伪记成功 |

每步另配同编号down文件及manifest摘要；down仅在隔离空库验证，不是带身份数据版本的默认回滚办法。具体列/索引和逐语句修复脚本由小张实现前列清并交小陈检查，不以此编号提案当已运行迁移。

迁移库负责序号、dirty状态和互斥；另以受版本控制的manifest记录每个up/down SQL的SHA-256，迁移前核对内嵌字节，并与数据库中已执行编号/摘要记录核对。摘要记录只在该步完成后写成功。缺失、内容被改或库dirty均阻止新迁移/服务启动；这层校验是待实现要求，不是migrate已自带能力。迁移表与摘要记录更新的故障窗口必须能识别为待修复，禁止将“版本号更新了”视作所有记录都一致。

MySQL DDL存在隐式提交，见[官方说明](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html)。因此部分DDL失败后先停本项目写入入口，读取dirty/版本/实际结构和记录摘要；小张按该步已审的前置/后置检查脚本判断实际完成边界，修复为明确一致状态后方可调整迁移状态并重试。禁止盲目force清dirty或删除整库。实现PR须补各具体SQL对应的恢复脚本、预期结构及数据校验，SC-16注入每个DDL断点复验。带数据环境先有备份并在隔离库验证恢复；保留原数据计数及关键值。

新建测试空库可验证down/up，但正式身份数据创建后不以DROP用户表作通用回退；优先停写、兼容前版本或前向修复，无法兼容时执行已验证备份恢复。真实RPO/RTO与备份由10统一接线，01不代报恢复演练完成。

## R4 离线初始化输入与幂等

拟议入口读取标准输入的一份严格JSON，尚无可运行命令。顶层只允许classes、users；class元素为key/name；user为username/password/role/class_keys，teacher可多个班、student恰一个班。拒绝重复JSON键、未知字段、无效UTF-8、空列表、重复key或username、悬空班级及超过64KiB输入；class key 1..64字符、显示名1..128，用户名及口令按D1/R1。模板仅放占位文本，运行时由持有人安全注入口令，不发群、不复制到证据；不自动生成固定默认口令。

先完整校验、再在事务外生成口令散列、最后一个事务写全部新班/人/成员关系并提交，失败非零且本次新增全部回滚。内部稳定key对应持久唯一约束；重跑时精确匹配身份/角色/成员关系则不重复创建、不覆盖口令，也不把再次输入的口令当改密请求；非口令结构不一致返回冲突并回滚，不静默改班/角色。对已存在账号更改口令必须另走已授权的内部改密服务。并发初始化由同一数据库锁串行化，锁超时非零；锁与事务边界在SC-15真实MySQL断言。

## R5 HTTPS与数据库健康的确认提案

HTTPS采用同源Nginx：/提供前端、/api/v1/转发到本项目后端；运行时提供SAN匹配且客户端信任的证书，私钥只读挂载，后端不公开到非本机接口。浏览器与命令客户端都校验证书，禁止用忽略TLS校验当验收。可信origin取运行配置，不内置某个人的域名、证书、IP或端口；不安装系统信任、不生成密钥作为本次工作。代理只传可信网络源，默认不信任客户端X-Forwarded-For，CSRF/Origin检查仍在后端，Cookie Secure不变。01获准实施包中小陈负责Compose/Nginx/TLS/MySQL接线并把提交交小张审；小张负责Go身份装配和迁移，小陈复审其实现。10仅后续接手运行观测/门禁，不将01接线悬置于“10或01”。

健康已冻结：引入 MySQL 的版本仍匿名 GET /health，每次真实 Ping 预算 3 秒；成功 200/status=ok/dependencies={mysql:up}，失败或超时 503/status=error/dependencies={mysql:down}。不输出原始错误，保留请求标识/日志。阶段切换由新公共 change D1 规定：01 引入数据库的同一受审实现提交更新实现、探针、Schema 引用、配置、测试和规则，不以环境开关容许双成功合同；当前骨架仍为空依赖。

## R6 确认与后续交付

R1—R4 和 D3/D4/D7 边界已由小张绑定72fe59b复审接受；PCR-IDF-01..03 公共登记随本 PR 的 identity-public-contracts 收口。最终 review 必须绑定本次实际 head，CI 通过后正常合并。01 运行实现、MySQL/TLS 子包、真实并发/事务/恢复、02 真实登录联验及 G3 尚未完成，继续按 tasks 留待办。

## R7 2026-11-07 接线子包交接候选（等待小张确认）

按组长共享表B阶段，现有01最小补齐[deploy/identity](../../../../deploy/identity/README.md)及[输入登记](../../../../deploy/identity/inputs.json)：五个Compose专属输入负责本机文件目录、独占网络/代理精确地址、HTTPS主机和端口；复用既有HTTPS证书路径键，不直接加入公共active/frozen列表。MySQL原生root文件注入和首次卷SQL输入以本机文件提供，应用DML与离线DDL账号分开；命名卷持久化，TLS链/主机名验证、只读证书、同源代理及精确/32不放宽。

此提交只提供显式选择的隔离测试装配和可复用接线配置；根入口、阶段、空样例和健康引用保持骨架。小张审查输入与实际证据后，在同一#14分支接手生产原子激活；未确认输入、未激活或未真实浏览器验收的项目不宣称完成。生成证书/随机账号仅为隔离测试临时材料，不产生可用部署默认值，也不安装系统信任。

R7小张接手确认：接受41e8ed2的五个接线输入、文件注入、持久卷和精确代理方案；本实施提交登记active并统一切换默认Compose、正式server、健康/探针/Schema及空样例。测试临时CA仅用于隔离验收，实际运行证书仍由持有人提供；不新增教学业务范围。

R7主机入口修复（2026-11-08）：02真实联验发现frontend仅加入internal代理网时，Docker Desktop主机发布端口拒绝连接。最小修复为仅frontend增加Compose自管ingress bridge，保留本机127.0.0.1发布、内部proxy精确/32和data隔离；backend/MySQL/admin不加入ingress、不发布端口。不新增公共配置键或改变健康/认证合同。原verify补主机真实发布端口的可信TLS/健康/匿名拒绝、错误CA/SAN、停机与重建检查，保留容器内身份回归。当前修复与各平台真实验证见共享表，Windows现象及正常信任浏览器须由实际执行者复验，不以Linux/CI替代。
