# 01运行、迁移与公共合同候选方案

日期：2026-11-05。此文件补全design D3/D6/D8，供小张审查及00原两人确认公共影响；不是已冻结配置或实际部署。01仍处于propose，不安装依赖、不改公共登记/Compose/镜像/主规约。后续确认结果必须回填本文件及公共单源合同，不能一边保留待定一边apply。

## R1 版本、许可及可复现来源

| 组件 | 本次候选 | 官方来源与已知事实 | 实施前仍需完成 |
| --- | --- | --- | --- |
| MySQL | 8.4.13 Community，InnoDB | [官方镜像清单](https://raw.githubusercontent.com/docker-library/official-images/master/library/mysql)含8.4.13；2026-11-05 Registry HEAD解析为mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902；[上游许可](https://raw.githubusercontent.com/mysql/mysql-server/mysql-8.4.13/LICENSE)为GPLv2并有附加许可说明 | 小张评审用途/许可与镜像组成；在Docker执行环境核对平台子摘要、实际版本、安全扫描及隔离启动，不把HEAD元数据当拉取运行 |
| Go MySQL驱动 | github.com/go-sql-driver/mysql v1.10.1 | [go.mod](https://raw.githubusercontent.com/go-sql-driver/mysql/v1.10.1/go.mod)最低Go1.24.0；[许可](https://raw.githubusercontent.com/go-sql-driver/mysql/v1.10.1/LICENSE)MPL-2.0 | 属当前安全规范需先评审的许可；未批准前不引入。保留许可、用途及间接依赖清单，再锁go.mod/go.sum |
| 口令函数 | golang.org/x/crypto v0.58.0 的argon2 | [版本模块](https://raw.githubusercontent.com/golang/crypto/v0.58.0/go.mod)最低Go1.26.0；[许可](https://raw.githubusercontent.com/golang/crypto/v0.58.0/LICENSE)BSD-3-Clause | 仅使用argon2及必要依赖；锁文件、构建和漏洞检查由未来实现验证，不声称选定版本即零漏洞 |
| 迁移 | github.com/golang-migrate/migrate/v4 v4.20.1；仅mysql与iofs驱动 | [发布](https://github.com/golang-migrate/migrate/releases/tag/v4.20.1)、[go.mod](https://raw.githubusercontent.com/golang-migrate/migrate/v4.20.1/go.mod)最低Go1.25.11、[许可](https://raw.githubusercontent.com/golang-migrate/migrate/v4.20.1/LICENSE)MIT | 独立离线迁移入口调用库，凭据不传命令行；补R3校验和机制，不能假设库自动校验已发布SQL内容 |
| HTTPS入口 | 复用当前已锁摘要的Nginx，不另加代理产品 | scripts/toolchain.json登记Nginx1.30.6；[Nginx HTTPS配置](https://nginx.org/en/docs/http/configuring_https_servers.html)提供证书/私钥入口 | 公共合同批准后由01实施接线，TLS配置、只读证书挂载和实际浏览器/客户端验收仍待运行证明 |

当前仓库backend/go.mod为Go1.27.0、工具链锁1.27.3，满足上述模块声明的最低版本只是静态对照，并非已经成功解析、构建。所有精确版本均是候选；apply前重核上游安全信息、校验锁文件和必要补丁，不能使用latest漂移。镜像分发许可和Go驱动许可需由小张明确确认并按00流程登记，不能把本文件当豁免。

口令参数候选：Argon2id v19、m=19456KiB、t=2、p=1，密码学随机盐16字节、输出32字节，保存带版本/参数/盐/输出的可解析格式。19MiB/t2/p1来自[OWASP口令存储建议](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id)，盐与输出长度是本项目待审选择。解析不允许任意超大m/t/p耗尽内存，01只接受本次冻结参数；不存在账号也执行同参数的虚拟口令校验。初始化新口令候选12..128 Unicode码点；登录仍按00接收1..128，不偷偷改变LoginRequest。改密服务采用同一创建规则，不做自动trim。必须用SC-02/03/17和固定资源基准验证，不能因耗时直接降参数。

## R2 配置空键及失败合同（尚未登记/生效）

本表只列拟议键名，不包含值；当前.env.example仍只能HTTP_PORT=。小张审查后，00原两人确认config-register/部署规范的变更，再在01实现中扩展样例。服务器固定900/604800秒及冻结限流参数，不新增可绕过安全值的环境开关。

| 候选空键 | 使用者 / 机密 | 必填和校验 | 失败与时限 |
| --- | --- | --- | --- |
| MYSQL_DSN= | 后端 / 是，含连接凭据 | 只允许TCP目标及确定库名；禁止root、skip-verify、preferred降级、multiStatements与明文连接；专用DML账号 | 缺失/空白/格式非法启动非零，错误只写键名；连接/读/写各3秒，首个需DB操作起单请求共用5秒截止；明确不可达503，截止到期504 |
| MYSQL_MIGRATION_DSN= | 受控迁移/初始化入口 / 是 | 单独DDL账号；服务进程不读取；迁移用独立连接允许工具所需multiStatements，不可复用到业务池 | 入口缺配置非零；连接3秒、迁移锁等待10秒、每条DDL30秒；失败标dirty且非零；检查实际结果再恢复 |
| MYSQL_CA_FILE= | 服务及迁移入口 / 路径非机密，内容是信任材料 | 只读CA文件，服务端证书链及目标主机名必须验证；实际TLS要求不靠DSN自行关闭 | 缺失/不可读/证书无效启动或迁移非零；不把CA、DSN或底层错误正文写日志 |
| AUTH_TRUSTED_ORIGIN= | 后端 / 非机密 | 单个HTTPS origin，含准确主机/端口；不含userinfo/path/query/fragment/通配符/null | 缺失/非法启动非零；不匹配请求403，无隐藏HTTP回退 |
| AUTH_TRUSTED_PROXY_CIDRS= | 后端 / 非机密 | 仅在同源代理接线阶段启用，填已登记的代理对等端CIDR；拒绝0.0.0.0/0、::/0、空段和未识别地址；Nginx覆写单一X-Real-IP，后端仅在对等端命中登记范围时读取并校验该单一IP | 接线时缺失/非法启动非零；不信任客户端自报X-Forwarded-For；其他对等端只使用直连源 |
| HTTPS_CERT_FILE= | Nginx接线 / 非机密路径 | 只读证书链文件，SAN匹配运行主机 | 缺失/不可读/证书不匹配不启动或验收失败 |
| HTTPS_KEY_FILE= | Nginx接线 / 私钥及其运行路径按机密管理 | 只读、最小权限；不入Git/构建上下文/镜像 | 缺失/不可读不启动；不自动创建或打印私钥 |

MYSQL_DSN等敏感值通过运行环境或受控文件注入，禁止在脚本命令参数/日志/错误里展开。5秒预算从请求完成传输框架校验、即将进行首个依赖DB的操作时开始，连接/查询/事务共用同一截止，不为重试重置；连接明确拒绝/断开为503 DEPENDENCY_UNAVAILABLE，截止到期为504 UPSTREAM_TIMEOUT。提交前失败回滚，不能签发Cookie/访问凭证；若数据库COMMIT结果不明，返回504且不发新凭证，标记待核查，不自动重试或断言数据库一定未改变，须核对会话版本后恢复。MySQL容器自身初始化账号、卷及证书配置由01实施接线覆盖，10后续复用并验证运行观测；不能只列应用键便宣称完整Compose已具备。HTTP_PORT沿用当前合同。会话凭证使用随机量和持久摘要，不额外创造未评审JWT签名密钥。

## R3 迁移编号、校验和及恢复

建议申请候选编号000001..000003，见下表。00当前实际迁移清单为空，此处仅为小张确认的编号申请，不占号、不创建SQL；如小张已分配号码则整体顺延并同步依赖。小张在00迁移登记确认起止号后，才固定文件名、依赖和兼容范围。SQL通过embed.FS/iofs只读内嵌到离线迁移程序；不在server启动时自动DDL，不引入ORM或所有数据库驱动。

| 候选编号 / up文件 | 内容及依赖 | 兼容和失败修复边界 |
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

HTTPS候选采用同源Nginx：/提供前端、/api/v1/转发到本项目后端；运行时提供SAN匹配且客户端信任的证书，私钥只读挂载，后端不公开到非本机接口。浏览器与命令客户端都校验证书，禁止用忽略TLS校验当验收。可信origin取运行配置，不内置某个人的域名、证书、IP或端口；不安装系统信任、不生成密钥作为本次工作。代理只传可信网络源，默认不信任客户端X-Forwarded-For，CSRF/Origin检查仍在后端，Cookie Secure不变。01获准实施包中小陈负责Compose/Nginx/TLS/MySQL接线并把提交交小张审；小张负责Go身份装配和迁移，小陈复审其实现。10仅后续接手运行观测/门禁，不将01接线悬置于“10或01”。

提交00原两人确认的健康候选：引入MySQL的版本仍公开GET /health；200时status=ok、dependencies仅mysql=up；3秒预算PingContext失败时503、status=error、dependencies仅mysql=down，不输出连接串/错误详情。每次请求检查真实连接，不把启动成功缓存成永久up。请求标识/日志合同保留；Schema、OpenAPI、配置登记及/server --healthcheck必须同一变更同步，探针只接受该阶段批准的精确成功响应。此提案尚未被00确认，当前健康实现与骨架历史不变；参数如被退回则先改本提案，不同时支持两套规范。

小陈准备条件：能运行Docker Compose的执行环境、隔离MySQL数据卷、双班五人凭据、受信HTTPS证书和故障注入权限。2026-11-05已在ab91417实际复跑现有骨架检查，Docker28.3.3/Compose2.39.1、Node22.23.4及固定摘要Go1.27.3工具链可用，check/verify等命令退出0，见[实际结果](../../../reports/changes/01/docker-check-2026-11-05.json)；尚未连接真实DB、创建账号或验证证书。未来身份集成仍须在同一集成SHA保存配置来源、实际版本、迁移与请求/DB断言，不能复制骨架或00/CI结果当作身份集成运行。

## R6 给小张的确认清单

确认R1版本/许可和Argon2id参数、R2空键/超时/TLS约束、R3工具/编号/恢复、R4输入/重跑冲突、R5同源HTTPS及提交00的健康候选；同时复审D3刷新单赢家/D4凭据优先级。确认以绑定修订head的明确记录为准。公共字段/配置/健康由00两人同步单源；未确认项保持阻塞，01不进入apply。规格通过也不能代替小陈准备真实运行条件或后续终审。
