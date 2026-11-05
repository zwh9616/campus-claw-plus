## Purpose

为CampusClawPlus提供基于可信身份的前端应用基础，明确公开与受保护页面、角色和班级上下文、登录及凭证失效处理、统一布局与交互规则。通过代表页面样板、正常加载空错误四态、键盘与窄屏检查，以及分开记录的mock测试、真实登录联验和同版本截图，让后续教学页面具备可审查、可复验的交付依据。本能力只引用已冻结接口，不提前实现或虚构教学业务。

## ADDED Requirements

### Requirement: FEF-01 Explicit routes and trusted identity
前端 SHALL 按design D1仅提供公开首页、登录、工作台、账号/班级及404；身份来自00冻结合同，不创造planned入口、姓名、班名或班级列表。

#### Scenario: FEF-SC-01 Route and role matrix
- **WHEN** 匿名、学生、多班教师分别进入D1所有路由和未知路由
- **THEN** 受保护页先恢复身份、失败进登录或恢复错误；学生无切班入口，教师按ID输入申请；未知路径404，导航只含工作台和账号
- **AND** 客户端改角色不扩大服务端权限，不请求planned操作，ID不转Number

#### Scenario: FEF-SC-02 Honest empty state and malformed identity
- **WHEN** 工作台无教学功能，或me成功体缺Principal字段/角色非法
- **THEN** 前者显示仅开放账号与班级及唯一有效入口；后者为合同错误并阻止私有内容，不能以空态放行或补假数据

### Requirement: FEF-02 Bounded session recovery
前端 SHALL 按design D2/D3在内存管理凭证，限定恢复与GET重试次数，保留同源HTTPS/Cookie安全；写动作不得自动重放。

#### Scenario: FEF-SC-03 Login normal invalid and boundary
- **WHEN** 提交有效身份、错误口令、空字段、用户名0/1/64/65码点、密码0/1/128/129码点，并连续点击提交
- **THEN** 合法成功才入工作台；本地非法不发请求；401统一文案；原样发送合法输入，失败清密码保留用户名；同一次提交至多一次POST
- **AND** 200后取CSRF失败显示恢复错误，不谎称所有账户操作就绪

#### Scenario: FEF-SC-04 Reload and single refresh
- **WHEN** 重载受保护页面、同时多条GET收到401或刷新后GET仍401
- **THEN** 按D3 csrf→refresh→csrf→me恢复；同标签页至多一个并发refresh，每条GET至多重放一次，再401清身份进登录；加载不闪旧用户
- **AND** 凭证不在URL/持久存储/日志；网络故障可显式重试，没有无限循环

#### Scenario: FEF-SC-05 Multi-tab rotation and revocation
- **WHEN** 两个标签页竞争刷新、另一标签页登出/切班或服务端撤权，旧页重新可见
- **THEN** 竞争失败页清本地状态并提示重新登录，不自动logout赢家；重新验证me，失效身份不显示；广播不含机密且丢失不绕过服务端判断

### Requirement: FEF-03 Context changes cannot leak stale content
前端 SHALL 按design D4串行化认证写操作，切班/登出隔离旧请求，网络不确定时不伪报成功。

#### Scenario: FEF-SC-06 Authorized class switch and forbidden target
- **WHEN** 多班教师提交合法目标、非成员班级、非法ID或当前班级
- **THEN** 成功才替换Principal/清旧缓存并重新取CSRF；403用通用拒绝提示并核验旧会话，非法ID不发请求，当前班仅提示不重复请求
- **AND** 最大合法ID与越界按00字符串规则区分，学生没有任意班级输入入口

#### Scenario: FEF-SC-07 Late responses and ambiguous write results
- **WHEN** 切班期间旧班GET迟到，或切班/logout响应丢失、503/504、本地10秒截止
- **THEN** 旧响应不得回填，新写不自动重发；隐藏私有内容，提示结果未确认并恢复可信身份后才显示，不能自行当成已回滚或已成功
- **AND** 受控移除旧请求代号检查会使对应测试非零，恢复后通过

#### Scenario: FEF-SC-08 Logout and browser history
- **WHEN** 点击退出并收到204，或收到401/网络失败，随后浏览器后退
- **THEN** 204才记服务端登出成功并清内存；401按失效回登录；网络失败保持私有内容隐藏并提示未确认；后退不显示失效缓存，走身份校验

### Requirement: FEF-04 Consistent usable states and accessibility
前端 SHALL 按design D5/D6统一组件、四态和可达性；错误给出下一步，状态不得只靠颜色。

#### Scenario: FEF-SC-09 Four states and error matrix
- **WHEN** 注入成功、延迟、无教学功能、400/401/403/429/503/504、非JSON或不符合Schema响应
- **THEN** D5每种状态有明确画面和动作；请求10秒内结束本地等待；429遵守有效Retry-After，POST不自动重发；request_id可复制且无敏感原文

#### Scenario: FEF-SC-10 Keyboard forms and long content
- **WHEN** 仅Tab/Shift+Tab/Enter完成登录、导航、教师切班、退出，并展示19位ID和256码点错误
- **THEN** label/错误关联正确，焦点可见无陷阱，忙碌不重复提交，关闭切班区回触发点；长文可读可复制且不遮挡动作

### Requirement: FEF-05 Reviewed samples and versioned visual evidence
前端 SHALL 按design D6/D7先确认线框及代表样板，再扩展页面；360px/1440px人工视觉审查不能由代码检查替代。

#### Scenario: FEF-SC-11 Sample checkpoint
- **WHEN** G2与02规约批准后，小葛提交登录和教师账号代表样板
- **THEN** 同SHA的正常/错误/加载样板按360×800与1440×900截图，交小张明确确认或返修；确认前不批量扩展其余页面
- **AND** 当前规约阶段只审线框，不生成假样板通过记录

#### Scenario: FEF-SC-12 Responsive final visual review
- **WHEN** 小张在同一候选SHA打开师生页面、四态、404，按两档视口及200%缩放检查
- **THEN** 无水平页面溢出、重叠、裁切、不可达按钮或读不到的错误；清单记录SHA/浏览器/视口/状态/来源/截图路径，不复用旧版本截图

### Requirement: FEF-06 Evidence and integration gates
交付 SHALL 按design D8/D9分别记录mock、真实认证联验和视觉证据，遵守两人审查、G2/G3及共享进度规范。

#### Scenario: FEF-SC-13 Mock isolation and effective checks
- **WHEN** 执行客户端正常/失败/边界测试并构建生产制品
- **THEN** mock仅测试启用，生产不能模拟登录或走假API；测试关联FEF场景并实际检查请求次数/状态/清理，受控破坏变红恢复变绿；原npm门禁保留且失败非零

#### Scenario: FEF-SC-14 Real authentication integration
- **WHEN** 同版本前端和01真实MySQL/HTTPS服务使用隔离双班五人及多班教师执行登录、me、刷新、切班、旧凭据拒绝、登出和再访问
- **THEN** 实际Cookie/CSRF/Origin与失效符合冻结合同，记录前后端SHA、共同集成SHA及真实输出；与mock记录分开，未接01保持待集成验收

#### Scenario: FEF-SC-15 Unmet gates and honest handoff
- **WHEN** G2/02批准未满足，或尚无样板确认、真实联验/视觉证据、G3
- **THEN** 分别阻断apply、扩展、归档或业务合并；本PR只写规约，实际PR和待确认项同步共享表，不能自批、擅自合并或冒充独立新会话
