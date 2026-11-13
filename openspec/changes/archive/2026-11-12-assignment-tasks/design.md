## Context

基线main `1fa47ee2c3d486ba4fcfb615ee73ea22de0b05c7`：01/02/04已验收归档，G2/G3已成立，数据库精确目标4；06真实资料页面在独立PR #30，本变更不取用其未合入代码。05尚无既存change，本次首次起草。公共依据为[00设计D2/D3/D5/D8/D9](../../2026-11-04-business-contracts/design.md)、[身份主规约](../../../specs/identity-foundation/spec.md)及[依赖表](../../../../docs/contracts/change-dependencies.md)。

## Goals / Non-Goals

交付最小作业资源、真实提交和可恢复任务基础，明确成功受理与批改完成的区别。暂不做作业页面、编辑/删除/归档作业、附件/题库/rubric编辑、AI调用、成绩与错题、MCP或新审计查询接口。首期作业创建后不可编辑，version=1；version校验仍保留，不能为未来编辑绕过乐观并发。

## Decisions

### D0 准入与公共合同确认

本文件所有新增操作和字段是待小张确认的候选，不是已冻结合同。G2、01及G3有共享表既有证据，05仍缺自身规约批准。小张审定当前head并正常合入后，才可准备/提交公共合同冻结；操作登记、单源Schema、正反例和错误集合经两位负责人审定并合入后再实现业务。原13个current操作、健康、配置登记及运行版本4保持不变。

本方案不改00 D5；若审查要求改变幂等顺序、租约、重试或Task字段，须先给00提出明确修订并审定，不能在05另立规则。新增作业资源与任务内错误码按D8列为待确认合同输入。

### D1 候选资源与HTTP边界

沿用00正十进制字符串ID、UTC RFC3339毫秒时间戳、version正整数、JSON未知/重复键400、普通请求体总上限64KiB/413及统一Error；不增加业务码外层。字符串长度按Unicode码点计，拒绝非法Unicode；正文原样保存，不trim、不规范化换行/Unicode。64KiB与字段码点限制同时成立，超过任一即拒绝。

| 资源 | 候选全部字段（无额外字段） |
| --- | --- |
| Assignment | `id, class_id, teacher_id, title, description, deadline, version, created_at`；title为1..200码点且非全空白，description为1..20000码点且非全空白，deadline严格为UTC毫秒格式且创建事务中大于数据库当前时间，version首期恒为1 |
| Submission | `id, assignment_id, assignment_version, student_id, answer, task_id, created_at`；answer为1..20000码点（允许空白原值），assignment_version为正整数；创建后不可修改 |
| SubmissionAccepted | `submission_id, task_id, status:"pending"`；202的持久化业务快照，不因任务后来完成而改为其他status |
| Task | 完整沿用现有[Task候选Schema](../../../../docs/contracts/schemas/Task.schema.json)：task_id/submission_id/status/attempt/execution_epoch/version/cancel_requested/created_at/updated_at/error；不公开worker/租约/内部异常 |

列表为`{items,page,page_size,total}`，page默认1、page_size默认20/最大50，按created_at DESC、id DESC稳定排序；过滤与计数使用同一授权集合/一致性快照。未知查询键、重复键、非正整数、越界值400，不退化为全量查询。无记录为200空列表，详情不存在按D2处理。

### D2 候选操作、权限和失败

除提交外写操作不是可自动重放的创建请求；客户端不得因超时自动重复创建作业。写请求有Origin时必须精确同源，Bearer/认证写规则继承01；不新增Cookie认证旁路。所有操作按认证→角色/动作→当前班级/资源归属→详细业务校验执行，传输层畸形/大小校验沿用00例外。

| 方法/候选路径 | 输入与权限 | 成功 |
| --- | --- | --- |
| POST `/api/v1/assignments` | 教师可信当前任教班级；body仅`{title,description,deadline}`，不接受client class_id/teacher_id/version | 201 Assignment |
| GET `/api/v1/assignments` | 本班师生；仅page/page_size | 200 Assignment列表 |
| GET `/api/v1/assignments/{id}` | 本班师生 | 200 Assignment |
| POST `/api/v1/assignments/{id}/submissions` | 当前班级学生；`Idempotency-Key`及body仅`{answer,assignment_version}` | 202 SubmissionAccepted，含重放 |
| GET `/api/v1/assignments/{id}/submissions` | 本班教师读全班；学生只读本人；仅page/page_size | 200 Submission列表 |
| GET `/api/v1/submissions/{id}` | 本班教师或本班提交者本人 | 200 Submission |
| GET `/api/v1/tasks/{id}` | 本班教师或本班提交者本人，沿submission/assignment校验完整归属链 | 200 Task |
| POST `/api/v1/tasks/{id}/retry` | 本班提交者学生本人；body仅`{version}` | 200 更新后的Task |
| POST `/api/v1/tasks/{id}/cancel` | 本班提交者学生本人；body仅`{version}` | 200 更新后的Task（running时仍为running且cancel_requested=true） |

通用失败：400 VALIDATION_ERROR；401 UNAUTHENTICATED；角色不允许的动作先403 FORBIDDEN；通过动作角色检查后，外班/同班其他学生的私有资源/不存在均404 NOT_FOUND，message=`资源不存在`、fields=[]、details=null，除request_id外同构。必须同时限定资源的原班级和可信会话当前班级，切班后即使同一用户旧资源也不可访问。405含Allow。Error的request_id与服务端X-Request-ID相同。

写配额候选：05创建/新提交/retry/cancel按可信user_id共用12次/分钟固定窗口，跨班不重置，与04配额分离；超限429 RATE_LIMITED并带剩余窗口秒数向上取整的Retry-After。已授权的同键提交查重/冲突按D3先判断，不被新写配额、deadline或当前作业版本挡住。其余业务拒绝只读不创建领域/任务/outbox记录。配额及独立安全审计不是业务成功证据。

409集合：作业已截止/提交版本不匹配、任务version不匹配或状态不允许为CONFLICT；同键异载荷为IDEMPOTENCY_CONFLICT；failed且已claim三次重试为RETRY_EXHAUSTED；对终态取消为TASK_TERMINAL。所有错误details=null，fields按已授权的合法字段给出固定原因，不回显答案/原键。413 PAYLOAD_TOO_LARGE；数据库不可用503 DEPENDENCY_UNAVAILABLE，已开始的业务超过5秒总预算504 UPSTREAM_TIMEOUT；JSON消息与日志不得带SQL、DSN或正文。

### D3 提交事务、幂等及截止

Idempotency-Key沿用00，为HTTP解析后16..64个可打印ASCII字符（0x20..0x7E），重复头拒绝400；应用不再trim，键作为不透明值按字节区分大小写，不进入日志。作用域严格为user_id + class_id + route + assignment_id。有效载荷摘要候选为SHA-256(UTF-8编码的固定顺序JSON对象`{"answer":原字符串,"assignment_version":整数}`)，固定用既有Go工具链的encoding/json.Marshal及按上述顺序声明的结构体，保留默认HTML转义且无尾换行，不trim/换行转换；实现须固化含中文、引号、换行、非BMP与等价转义的跨请求测试向量。

认证、角色与资源授权之后先做确定载荷所必需的类型/大小/键校验，再在事务中检查唯一幂等记录。只有已提交记录可重放：同键同载荷返回保存的原202业务体，即使当前已截止/版本改变、任务已终态；每次HTTP仍生成新的request_id。异载荷先409 IDEMPOTENCY_CONFLICT，不再以新截止/版本覆盖它；会话失效、切班或权限撤销不能重放。

只有不存在记录的新键，才检查当前assignment_version及数据库当前时间；now >= deadline拒绝409且不写入。用作业行锁与幂等唯一约束串行化判定，提交、task(pending/attempt0/epoch0/version1)、outbox事件和202快照同一事务提交才返回202。并发同键请求只创建一组记录；失败回滚/超时不留下部分记录，重试重新查已提交事实。不同新键允许在截止前创建独立提交，不覆盖旧答案；无“同学生自动去重答案”暗规则。

05无作业归档/删除及清理任务，幂等快照与关联提交首期不自动删除，因而不短于00的归档后7天。未来清理须另行受审，不能通过TTL提前丢失去重保证。已受理任务重试/取消不受后来作业截止影响，也不能借retry更换答案。

### D4 持久outbox和worker边界

复用当前MySQL和后端进程，不引入MQ/新服务/配置。outbox保存task引用、可用时间及投递状态，授权业务表保存原答案；outbox/日志不复制答案。生产仓储只有行锁/CAS事务可以claim，轮询使用索引、每次最多取20条、空轮询间隔1秒、最多并发2个执行器；每次数据库操作组沿用5秒预算。

批改执行器为业务层注入接口，不能依赖HTTP。首期生产装配**不绑定批改执行器**：任务保持真实pending、outbox保持可恢复待投递，不claim、不循环制造失败、不标succeeded，不生成分数/GradeResult。启动仅记录一次脱敏能力未接入事件；健康仍只声明原MySQL Ping。202仅代表持久受理，不承诺已开始批改。未来07B/08获准并接入执行器后消费既有任务，须另有真实模型/成绩验收。

测试在测试二进制中显式注入受控执行器，运行真实MySQL仓储/事务和与生产相同的调度/CAS代码，能验证成功/失败/取消的任务机制。不得提供生产可切换的mock环境键、HTTP假批改入口或示例成绩；测试成功不是07B/08完成。

进程重启不依赖内存队列恢复。claim时以同事务登记投递与Task变更；事件重复交付只能尝试claim，不能独立加attempt或新建task。终态时原事件关闭，自动重试时同一事件重新可用，不累积无界重复事件。SIGTERM停止新claim、最多等待10秒并停止续租，未完成工作靠持久租约恢复，容器停止预算仍为15秒。

### D5 租约、重试与终态事务

沿用00：pending→running→succeeded/failed/cancelled；pending可直接cancelled。成功claim（首次/过期接管/手动重试后）在一个事务中使attempt与execution_epoch各加1，attempt全生命周期最多3，每次公开Task字段变更（含claim的attempt/epoch）使version加1并更新updated_at；仅内部心跳不改公开version/updated_at。epoch绝不复用，人工retry只把failed→pending且不加attempt/epoch、不重建task/答案，同时清error/cancel_requested和旧owner/租约，在同事务将原outbox事件重新置为可投递；只有后续claim加计数。pending/running/succeeded/cancelled的error均为null，仅failed带D5安全错误。

租约60秒，心跳每20秒；时间均用数据库时间。每次续租/失败/结果/取消确认均要求task_id + epoch + worker_owner + status=running + lease_until > DB now匹配，续租延到now+60秒；成功写还须cancel_requested=false。租约到期即使尚未被接管，旧worker也不能写；同owner重启不得复用旧凭证。worker_owner为每个进程会话生成的不可预测内部ID，不暴露到公共Task。

数据库可识别的过期running任务：attempt<3且未请求取消才可接管（加attempt/epoch）；attempt=3过期由独立清理事务基于观察到的epoch/version/过期条件改failed，error.code=RETRY_EXHAUSTED且关闭事件，不再claim。若cancel_requested=true，则清理事务直接cancelled/关闭事件，不再执行或claim；该管理事务必须重核行锁/当前epoch及过期条件，不冒充持有未过期租约的worker。

受控执行器报告的临时依赖不可用/执行超时为显式可重试错误：attempt1/2失败时CAS回pending、租约/owner清空、同事件分别延后1秒/2秒可用，error=null；attempt3失败落failed/RETRY_EXHAUSTED。非重试错误直接failed，安全任务内错误候选为EXECUTION_FAILED（message固定`任务执行失败`）；执行详情不进入公共错误。上述失败/退避分支必须在同事务锁定后先检查cancel_requested，已标记取消则持有有效租约的worker只能确认cancelled，不能回pending/failed而丢弃取消；失权worker仍按CAS拒绝。failed且attempt<3允许学生显式retry，version不匹配先409 CONFLICT，状态非failed为409 CONFLICT，attempt=3为409 RETRY_EXHAUSTED。禁止按每次手动retry重置三次上限。

成功、失败或取消确认与安全错误、outbox关闭在同一事务内；05五表不保存执行结果正文，不创建成绩表或假GradeResult。测试在隔离库中创建测试专用回执表，通过同一事务适配器注入写入/失败，验证结果与任务/outbox一起提交或回滚，不把测试表加入生产迁移。真实结果以后续批准的事务适配器接入，08必须同事务写自己的结果或整体回滚。外部模型/消息调用始终在事务外，不能声称外部副作用恰好一次；只有获当前租约授权的最终数据库提交至多一次。CAS不匹配只能丢弃结果，不改任务、成绩、错误或outbox，可独立脱敏记录被拒事件。

### D6 取消与成功竞争

取消事务在授权及body类型校验后先检查终态，终态一律409 TASK_TERMINAL（即使version已变化），以保持00的成功先提交语义；非终态再按version做乐观并发。pending改cancelled、cancel_requested=true并关闭outbox；running仅设置cancel_requested=true、version+1，保留租约，返回200 running。非终态重复请求使用过期version返回409 CONFLICT，客户端先GET，不通过取消请求创建新任务；running已标记取消且使用最新version再取消时返回当前200 Task，不重复改version。

running取消已先提交，则成功CAS必须失败；worker在有效租约中确认cancelled并原子关闭事件，worker失联则由D5到期清理确认cancelled。若成功先提交，则取消返回409 TASK_TERMINAL且不改结果。取消后绝不写成功回执/成绩；已取消任务不能retry。学生只能操作本人当前班级任务，教师首期只读，不开放代学生取消/重试。

### D7 迁移、安全与运行

候选号`000005_assignment_tasks`（依赖干净000004，由小张确认）；计划只追加assignments、submissions、tasks、task_outbox、submission_idempotency五张表，以及外键/唯一幂等作用域/投递和租约扫描索引，不改已发布000001..000004和摘要。答案由既有数据库权限及授权仓储保护，不记日志；SQL参数绑定，拒绝身份字段注入，正文不当模板/指令执行。

apply时才交真实上下行SQL、manifest摘要、逐DDL故障点和前后置检查，原子将离线admin/server精确目标切为5；本次仍为4。MySQL部分DDL可能已提交，dirty/结构/摘要漂移须阻断，按既有离线检查/前向修复复核再重试，不盲force、删库或自动down。空库、4→5、每处DDL中断、重跑及4/5旧新制品拒绝矩阵均需真实验证。

升级前停写并备份，实际隔离恢复到4并用旧制品复验；保留升级后的5库，不承诺把新作业写入带回旧程序，后续再决定恢复写入。生产回退用受验备份恢复，down仅供可丢弃测试库；持有人长期部署/生产回退不由CI代证。延续真实TLS、DML/DDL分离、server不自动迁移及原health/probe/配置；本变更不新增秘密、初始化账号或外部出站例外。

### D8 小张待确认与验收顺序

请审查当前head以下候选：D1/D2的九个操作/全部字段、只读教师任务权限与05配额；D3摘要向量/保留期和多次新键提交；D4未接执行器时pending及测试隔离；D5任务错误与过期取消清理；D7编号/五表/升级回退。未回复即待确认，不写成批准。

批准后先完成公共合同冻结和编号确认，再apply。05所有AT-SC均须映射到check或真实容器verify；本地/CI使用同一入口，任何失败非零。真实数据库采用双班教师/学生及同班另一学生，覆盖持久重启、并发同键、deadline精确边界、旧会话/切班、重复投递、到期未接管旧写、ABA、三次上限、取消两种排序和终态事务故障注入。用可注入时钟/事务屏障控制竞争，不能靠睡眠碰运气或用内存仓储替代持久性证据。

小张apply/自测并同提交同步共享表；交小陈在最终head独立复跑关键竞争与真实HTTPS权限/恢复，按远端保护正常合入，复验main后归档。真实模型、成绩、真实作业页面仍归后续变更，不能用本项受控执行器勾选它们。

### D9 机器合同冻结（2026-11-12，#35已审定合入）

规约#31已由小张批准并合入main da8624c；本节落实D0/D8允许的公共合同冻结步骤。小陈已对#35最终7fe5b5d实际批准5872964547，正常合入main e617cc0并通过完整CI43202284398，1.3完成，可交小张按2.x实施。九个操作在OpenAPI/端点登记为frozen，原13个current操作及精确目标4不变；真实05业务/迁移/worker尚未实现，不能因合同冻结提前改为current。[审定及main验收](../../../../reports/changes/05/contracts-main-integration-2026-11-12.md)

- 资源只使用单源Schema：Assignment/Submission、创建请求、SubmissionAccepted、TaskVersionRequest、两种具体Page及分页/提交幂等键。请求字段引用资源字段，分页复用MaterialListParameters的现有1/20默认、50页长和2147483647页码上限，避免复制类型。对象封闭且字段必需；JSON类型检查不能代替原始UTF-8/重复键/流式字节门禁。
- Task字段名及D5状态机不改。按D5冻结两种安全任务内错误：EXECUTION_FAILED/“任务执行失败”、RETRY_EXHAUSTED/“重试次数已用尽”；failed才可有非空错误、耗尽错误须第三次claim，pending/failed/succeeded的取消标记为false，cancelled为true。版本/epoch/时间的示例关联另做语义检查，真实CAS仍待apply。
- 小陈审查补齐D5已有的三次耗尽边界：pending仅允许attempt=0..2；第三次claim仍可处于running或相应终态，但不能通过自动回排或手动retry成为pending。单源Task Schema与语义例同步拒绝pending/attempt3，不增加执行次数或改变00 D5。
- 创建作业的deadline在创建事务中必须大于DB now；相等或更早按字段验证400 VALIDATION_ERROR，已有作业的新提交逾期仍409 CONFLICT。时间和正文都不归一化，答案允许空白原值；64KiB按整个原始请求计算，与20000码点限制同时成立。
- 405沿用当前身份/资料HTTP方法边界：空body、Allow明确列该路径的GET/POST，不新增METHOD_NOT_ALLOWED业务码；其余已列业务错误用Error，404除request_id外同构。写Origin若出现必须可信同源，Bearer为唯一认证方式。
- 提交作用域含user_id/class_id/route/assignment_id/键。已授权的已提交同键重放及异载荷冲突先于新写配额/版本/截止；202始终原pending快照。05写桶独立于04，只有新写进入05配额；首期不自动删除幂等快照。
- 摘要按D3固定字段顺序及Go encoding/json默认HTML转义，无尾换行。仓库保存5组由固定Go工具链实际生成的canonical UTF-8字节/SHA-256向量，含等价JSON键顺序/转义、中文、非BMP、引号、控制字符及原始换行/空白。JS示例校验器只处理向量中可精确表示的整数，不替代未来Go请求解析器或全范围数值验证。

机器合同同时登记生产未绑定执行器、三次总claim、60秒租约/20秒心跳、完整owner/epoch/running/未到期CAS、取消优先、原子终态与outbox和事务外网络；这些是未来实现必须满足的声明，不是已运行的worker。当前无新增SQL/配置/服务/生产假执行器，000005仅候选方案。

## Risks / Trade-offs

- 未接07B时用户只得到持久受理与pending，不具备批改演示；选择明确暴露真实阶段，避免假成功。
- 无首期清理保留幂等保证但会增长数据；上线长期使用前另审保留/容量/删除策略，不偷偷缩短00保证。
- MySQL轮询有至多约1秒调度延迟，60秒接管可能重复外部计算；CAS只约束持久结果，不承诺模型调用恰好一次。
- 000005为候选预留；如并行变更占号，协调后同提交更新方案/登记，绝不改已发布SQL。
