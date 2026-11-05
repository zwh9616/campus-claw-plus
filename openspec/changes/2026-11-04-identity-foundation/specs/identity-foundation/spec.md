## Purpose

定义CampusClawPlus首个身份与数据基础能力的范围：可信登录、会话轮换、班级与个人资源授权、MySQL迁移及安全初始化。这里约束未来实现和真实验收，不提前开放未冻结接口，也不把合同检查或骨架运行结果当作身份业务已通过。

## ADDED Requirements

### Requirement: IDF-01 Credential and HTTP boundary
身份服务 SHALL 按00已冻结HTTP合同和design D1/D2/D7实现登录与身份读取；不得新增未冻结业务入口。失败消息、请求边界、限流及服务端request_id必须可验证。

#### Scenario: IDF-SC-01 Valid identities and selected class
- **GIVEN** 真实MySQL已有双班四身份和同班第二学生，教师T1另有第二班成员关系
- **WHEN** 分别用有效凭据登录并用返回Bearer调用me
- **THEN** 返回200、严格AuthSession/Principal及安全刷新Cookie，expires_in=900；身份和班级来自数据库，多班初始取有效班级ID数值最小者
- **AND** me与当前访问凭证的Principal一致，响应no-store，访问凭证不在Cookie/URL中

#### Scenario: IDF-SC-02 Invalid credentials do not disclose account existence
- **GIVEN** 存在账号、不存在账号、被停用账号及无有效班级账号
- **WHEN** 使用错误口令或不可登录状态尝试登录
- **THEN** 均为同一401错误合同且不发Cookie或凭证，不暴露账号/停用/成员关系细节；除脱敏拒绝审计外数据库无变化

#### Scenario: IDF-SC-03 Validation limits and JSON framing
- **WHEN** 分别发送username长度0/1/64/65、password长度0/1/128/129、类型错误、未知字段、重复JSON键，以及64KiB及超过1字节请求
- **THEN** 边界内有效格式继续正常认证，空值/超长/类型/未知或重复键400，超传输上限413；失败不增加会话或凭证
- **AND** 请求体、口令、伪造role/class_id不能进入日志或扩大身份，request_id服务端生成

### Requirement: IDF-02 Revocable rotating session
身份服务 SHALL 按design D3/D4实现仅摘要持久化的凭证、原子刷新及即时撤销，访问有效900秒、刷新有效604800秒；安全状态必须在服务端验证，不能只依赖客户端删除或令牌签名。

#### Scenario: IDF-SC-04 Refresh rotates token and CSRF
- **GIVEN** 有效刷新Cookie、对应CSRF及可信Origin
- **WHEN** POST refresh并重新GET csrf
- **THEN** 返回200及新访问凭证/刷新Cookie/CSRF，原刷新凭证401；持久化无原始凭证，过期时间按D3更新
- **AND** 新Cookie配旧CSRF发起状态变更403，新的CSRF可用；既有访问凭证仅在有效期且未被撤销时继续有效
- **AND** 有效Cookie的重复/并发GET csrf在页面重载、多标签下返回同一个派生值且no-store；旧Cookie的GET为401，日志/存储不含CSRF原值

#### Scenario: IDF-SC-05 Concurrent refresh has exactly one winner
- **GIVEN** 同一个有效刷新凭证与CSRF，并发请求由屏障同时开始
- **WHEN** 两次refresh竞争同一持久状态
- **THEN** 恰有一次200、一次401；真实MySQL只产生一套新凭证，失败者不撤销成功者
- **AND** 重放旧凭证继续401且不写新凭证，成功者的会话仍可用
- **AND** refresh与switch-class使用同一旧Cookie竞争时也只有一个事务赢家；败者401，不覆盖新Cookie或新班级

#### Scenario: IDF-SC-06 Logout revokes both credential kinds
- **GIVEN** 同会话有效Bearer、刷新Cookie、Origin及CSRF
- **WHEN** logout成功
- **THEN** 204且以同Cookie属性清除；所有该会话访问/刷新立即401
- **AND** 再次带旧Cookie登出返回401，不重新创建会话或改变其他会话

#### Scenario: IDF-SC-07 Exact expiry boundary
- **GIVEN** 可控时钟及已知访问/刷新到期时间
- **WHEN** 分别在到期前、恰到期、到期后请求
- **THEN** 仅未过期凭证有效，now>=expires_at拒绝401，过期刷新不签发新会话
- **AND** 不依赖真实等待或前端计时；过期与撤销均由服务端判断

#### Scenario: IDF-SC-08 Password change and security revocation
- **GIVEN** 一个用户有两个有效会话，另一个用户有独立会话
- **WHEN** 调用已授权的内部改密/停用/撤销服务操作，不新增公开HTTP路由
- **THEN** 对应范围的旧访问/刷新立即401，改密事务要么全部成功要么保持原状态，其他用户不受影响
- **AND** 账号或成员关系被撤销后不能靠旧Principal继续访问；验证口令散列而非明文，禁止测试绕过服务端版本检查

### Requirement: IDF-03 Trusted class authorization and CSRF
身份及授权服务 SHALL 按design D2/D4/D5从可信会话取角色/班级，对每个动作和资源执行授权；失败先于业务副作用，跨班与不存在资源保持相同404合同，学生个人资源还校验本人。

#### Scenario: IDF-SC-09 Missing or forged identity
- **WHEN** 无Bearer、随机Bearer、过期/撤销Bearer，或仅用客户端role/class_id头/参数请求受保护入口
- **THEN** 401；不能通过声明身份变成教师或其他班，不签发或修改会话
- **AND** 对后续资源动作通过授权服务/仅测试探针验证；生产不加入假业务接口

#### Scenario: IDF-SC-10 Student cannot execute teacher actions
- **GIVEN** 学生有效Principal和属于其本班的资源
- **WHEN** 请求仅教师可用动作，包括参数伪造教师角色
- **THEN** 403，业务表/会话/成员关系无变化，仅允许脱敏拒绝审计
- **AND** 教师在有有效成员关系的本班执行对应测试动作通过，防止把所有请求都拒绝造成假绿

#### Scenario: IDF-SC-11 Cross-class and nonexistent resource indistinguishable
- **GIVEN** 双班教师/学生分别互换真实资源ID与不存在ID
- **WHEN** 通过可复用授权服务及仅测试探针请求资源
- **THEN** 跨班与不存在均404、message为资源不存在、fields=[]、details=null，除request_id外响应一致
- **AND** 无资源/授权/凭证副作用；临时去掉班级过滤时测试必须失败，恢复后通过

#### Scenario: IDF-SC-12 Class switch invalidates previous context
- **GIVEN** 多班教师的有效同会话Bearer/Cookie/CSRF和可信Origin
- **WHEN** 切到其有效成员班级
- **THEN** 返回200及对应班级Principal、新访问/刷新/CSRF，session_version递增；旧班访问/刷新立即401
- **AND** 切到非成员班级403；提交前依赖明确不可达503或截止到期504，已确认回滚时原上下文/凭证仍可用，均不创建成员关系；学生不能切到别班
- **AND** COMMIT结果不明返回504、不下发新凭证/Cookie、不承诺旧凭证可用或自动重放；用旧Bearer安全重试GET me核对，旧凭证失效则重新登录。故障注入区分未提交且确认回滚（旧凭证可用）与已提交但确认响应丢失（旧凭证失效、重新登录可用），均无第二次切班写入
- **AND** 切班后新Cookie重新GET csrf可用，旧Cookie的GET为401、新Cookie配旧CSRF为403；事务超时按00返回504

#### Scenario: IDF-SC-13 Origin CSRF and cookie-session binding
- **WHEN** refresh分别携带缺失/无效/过期Cookie、错误Origin/CSRF及任意Bearer；logout/switch-class分别携带缺失/无效/过期Cookie、缺失/无效/过期Bearer、有效但另一会话的Bearer，或缺失/null/错误Origin、缺失/错误/旧CSRF
- **THEN** refresh无效Cookie为401，完全不要求Bearer；logout/switch-class任一凭证无效均401且优先于Origin/CSRF错误；两凭证均有效但会话不一致为403；两凭证有效且同会话时Origin/CSRF错误为403
- **AND** 每组复合错误也按此顺序返回，均无会话、刷新或业务变化；me只用Bearer；正确凭据通过。Cookie保持HttpOnly/Secure/SameSite=Strict/准确Path，HTTP便利模式不得静默放宽；敏感响应no-store

### Requirement: IDF-04 Durable migrations and safe initialization
数据基础 SHALL 按design D2/D6使用真实MySQL、编号迁移和受控初始化；正常/重复/失败/部分迁移必须有可复验结果，不能用内存替代集成或把部分DDL当事务已回滚。

#### Scenario: IDF-SC-14 Empty database and version upgrade
- **GIVEN** 一份空库以及一份停留在前一迁移版本且含已知数据的库
- **WHEN** 分别执行审定的迁移和受控初始化入口
- **THEN** 结构/版本/校验和正确，已有业务数据保留；双班四身份及同班第二学生具备可登录且正确隔离的关系
- **AND** 命令退出0，真实口令不在仓库、参数、输出或明文列

#### Scenario: IDF-SC-15 Initialization idempotency and rollback
- **WHEN** 以相同唯一键重复初始化、并发重复初始化，并在关联数据插入处注入失败
- **THEN** 不重复建用户/班级、不覆盖已有口令；失败那次新增关联数据全部回滚且退出非零，不留半个可登录账号
- **AND** 用户名/成员唯一约束及边界空输入得到明确失败，修复输入后可安全重试

#### Scenario: IDF-SC-16 Partial migration recovery
- **GIVEN** 在迁移部分DDL已生效后人为制造下一步失败
- **WHEN** 执行迁移、按已审定恢复步骤修复并重试
- **THEN** 初次非零、不写成功版本且服务不启动；恢复后版本/校验和和结构一致，已有业务数据不丢失
- **AND** 记录失败步骤与脱敏输出，不清空数据库或删除断言制造通过

#### Scenario: IDF-SC-17 Secrets and correlated structured logs
- **GIVEN** 使用仅测试运行中生成的口令/访问凭证/刷新/CSRF及连接串
- **WHEN** 运行登录成功/失败、刷新、撤销、初始化失败及SQL故障
- **THEN** HTTP/JSON日志和审计能以服务端request_id追溯，但不含上述原值、散列、Cookie头、Authorization、正文或学生原值
- **AND** 凭证表仅存摘要、口令为经审定参数的加盐口令散列，扫描输出不打印待匹配机密

### Requirement: IDF-05 Fail closed and obey integration gates
身份基础 SHALL 按design D7/D8/D9在必需配置缺失、依赖故障及未授权动作时失败关闭；runtime-plan R1..R6的版本/许可/参数、迁移、配置/超时/HTTPS及健康候选必须经对应两人确认。公共健康/配置先对齐00，不得默许两套合同或把文档准备写成实现通过。

#### Scenario: IDF-SC-18 Configuration and database failure
- **WHEN** 移除已冻结的必需配置，或在运行中使MySQL明确不可达/操作超过共用5秒预算，再请求依赖数据库的登录/刷新/me
- **THEN** 配置缺失启动非零且不打印值；明确不可达503 DEPENDENCY_UNAVAILABLE，截止到期504 UPSTREAM_TIMEOUT；提交前失败回滚、不返回新Cookie/访问凭证、不放宽授权
- **AND** 恢复后正常路径可用；数据库健康及探针只按先经00批准的唯一合同验收，批准前本草案不改变原health
- **AND** 覆盖runtime-plan R2每个生效必需键的缺失/空白/非法/证书不可信及时间边界；任何TLS故障不允许降级或跳过证书校验；提交结果不明单列核查、不盲重试或声称数据库无变更

#### Scenario: IDF-SC-19 Login rate and window boundaries
- **GIVEN** 使用小张审定的D7阈值与可控时钟，对存在和不存在账号同样计数；源地址桶与精确用户名桶独立，单实例精确滑动60秒
- **WHEN** 在限额以内、第11次、并发跨限额、时钟恰好到最早记录+60秒、用户名轮换/来源轮换、两桶分别2秒/20秒后释放、4095活跃桶还需两个新桶及4096活跃桶满/释放时尝试
- **THEN** 两桶均未满且容量足够两个所需新桶时才在同一锁内建桶并计数；任一限额或容量不足整次429，拒绝不留下半个桶或计数。双桶都满时Retry-After取两桶等待最大值（上述为20秒）；容量不足时取释放足够槽位的等待，与限额等待取最大值，向上取整至少1秒；4095桶缺一个槽位须先拒绝，释放后恢复，并发不突破单实例限额
- **AND** 不信任任意转发源头，不泄露账号存在性、不签发额外会话；重启清空计数及多实例不具全局保证被明确记录，扩容前另审共享限流

#### Scenario: IDF-SC-20 Personal ownership and default deny
- **GIVEN** 同班两名学生、跨班身份和一项未登记动作
- **WHEN** 经授权服务分别请求本人、同班另一学生、跨班个人资源或未知动作
- **THEN** 本人允许；其他学生/跨班个人资源404且无存在性差异；未知动作默认拒绝，生产无对应未登记路由
- **AND** 失败无业务/授权/凭证副作用，测试不能只断言HTTP状态而漏查数据库；01未过规约批准/G2不得apply，未过G3及终审不得合并业务实现
