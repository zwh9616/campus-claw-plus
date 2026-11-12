## Purpose

提供继承00公共合同的作业、真实持久提交及可恢复任务基础；与真实模型、成绩和页面验收分开。

## ADDED Requirements

### Requirement: AT-01 准入与合同单一来源

05 SHALL 在自身规约批准及公共机器合同审定合入后才apply，MUST 满足G2、01与业务合并G3；候选操作和迁移不得因草稿提前激活。

#### Scenario: AT-SC-01 草稿不放行业务
- **WHEN** 05只有提案或公共Schema/端点登记尚未审定
- **THEN** 作业/提交/任务保持planned，运行版本仍为4且无新增配置/Compose服务；不能用本PR批准替代07B/08批准

### Requirement: AT-02 作业与提交逐资源授权

系统 SHALL 按D1/D2提供九个已审定操作，身份和当前班级只来自01，输入/分页/错误遵循00及D1/D2。

#### Scenario: AT-SC-02 本班创建与读取
- **WHEN** 教师创建合法作业，本班学生或教师列举/读取
- **THEN** 201返回不可编辑version1作业，列表200使用同授权集合分页/计数和稳定排序，学生不能创建

#### Scenario: AT-SC-03 私有提交与任务
- **WHEN** 外班师生、同班另一学生或不存在ID请求提交/任务，或持有人切换当前班级后请求旧资源
- **THEN** 统一404资源不存在且无领域写入；本班教师可读本班提交/任务，只有提交学生可重试/取消本人任务

#### Scenario: AT-SC-04 输入与配额边界
- **WHEN** 请求含伪造身份字段/未知重复键、非法分页、空标题、超长/非法Unicode答案、超过64KiB或用尽05写配额
- **THEN** 分别400/413/429且无领域写入，429含Retry-After；合法码点与字节边界正常受理，04和05配额分离且切班不重置05配额

### Requirement: AT-03 原子受理与授权后幂等

提交 SHALL 按D3在同事务写submission/task/outbox/幂等202快照，MUST 先授权再判断已提交重放、新键才判断当前版本和截止。

#### Scenario: AT-SC-05 新提交原子受理
- **WHEN** 学生在截止前用新键提交合法当前版本答案
- **THEN** 202前四类记录全部提交，Task为pending/attempt0/epoch0/version1，答案原值保留，重建服务仍可查且不同新键不覆盖旧提交

#### Scenario: AT-SC-06 并发同键与等价JSON
- **WHEN** 多请求同作用域同键同载荷并发，或仅调整JSON键顺序/等价转义
- **THEN** 只创建一组记录，所有成功得到同一202业务快照；摘要不改变答案换行/Unicode，未提交记录不能重放

#### Scenario: AT-SC-07 截止后重放和冲突顺序
- **WHEN** 已提交键在deadline之后/版本变化/任务终态重放，或同键改答案/版本
- **THEN** 同载荷返回原pending的202业务快照，异载荷先409 IDEMPOTENCY_CONFLICT；新键仅在当前版本匹配且DB now小于deadline时受理，等于deadline拒绝且零写入

#### Scenario: AT-SC-08 授权失效与事务失败
- **WHEN** 已提交键由失效会话/外班上下文重放，或首次提交在任一写点故障/超时
- **THEN** 先401/404，不泄露保存快照；失败事务无部分记录，响应丢失后重新查真实提交事实，幂等首期不自动删除

### Requirement: AT-04 持久投递与真实执行阶段

调度 SHALL 使用D4持久outbox及相同仓储/CAS代码恢复，MUST 区分无生产执行器和测试注入，不产出假成绩。

#### Scenario: AT-SC-09 生产未接批改器
- **WHEN** 05首期生产受理后重启后端或数据库恢复
- **THEN** submission/task/outbox仍在，任务保持pending且不claim/假成功；无分数/GradeResult或可对外启用mock的配置/入口，health保持原MySQL合同

#### Scenario: AT-SC-10 崩溃与重复投递
- **WHEN** 测试注入执行器，在claim前后停止进程并恢复，且重复交付同一outbox事件
- **THEN** 真实MySQL任务可恢复，合法claim才加attempt/epoch，重复事件不能创建另一task或重复提交结果，SIGTERM停止claim且按既有预算退出

### Requirement: AT-05 有界租约与陈旧worker拒绝

worker SHALL 按D5在DB时间上持有60秒租约、20秒心跳，并以owner/epoch/running/未到期CAS持久写；租约过期即失权。

#### Scenario: AT-SC-11 到期未接管仍拒绝旧写
- **WHEN** 首次claim租约已到期但尚无新worker接管，旧worker尝试续租/成功/失败/取消确认
- **THEN** 所有CAS失败且任务/结果/错误/outbox无副作用，不能靠相同owner继续旧租约

#### Scenario: AT-SC-12 接管及ABA
- **WHEN** 任务租约过期被新会话接管，旧worker结果迟到，或任务failed后retry再claim
- **THEN** attempt和epoch仅在新claim各加1且epoch不回退/复用，旧写和重复结果被拒绝；只有当前owner及有效epoch可提交一次终态

### Requirement: AT-06 三次总上限与显式重试

自动/手动重试 SHALL 共用全生命周期三次claim上限，MUST 按D5处理退避、终态、version和过期清理，不能重建task规避计数。

#### Scenario: AT-SC-13 自动退避与第三次失败
- **WHEN** 执行器报告明确可重试错误，前两次或第三次claim失败
- **THEN** 前两次原事件分别延后1/2秒回pending且error=null，第三次failed/RETRY_EXHAUSTED，后续不再claim

#### Scenario: AT-SC-14 手动重试与版本
- **WHEN** 学生重试本人failed任务、重复使用旧version、尝试重试其他状态或第三次已失败任务
- **THEN** 仅failed且attempt小于3及version匹配返回200 pending，不立即加attempt/epoch；其余409 CONFLICT或RETRY_EXHAUSTED，原答案/截止不被改写

#### Scenario: AT-SC-15 第三次租约过期
- **WHEN** 第三次running租约到期且worker无结果
- **THEN** 条件清理事务改failed/RETRY_EXHAUSTED并关闭事件，不存在第四次claim；并发新状态/epoch使旧清理条件失败

### Requirement: AT-07 取消与结果互斥

系统 SHALL 按D6对pending直接取消、running标记后确认，MUST 用事务和CAS确定竞争先后，取消后不写成功结果。

#### Scenario: AT-SC-16 pending取消与claim竞争
- **WHEN** 学生取消pending任务与worker claim竞争
- **THEN** 只允许一条有效顺序：先取消则事件关闭不能claim，先claim则取消只标记running；旧version不写入

#### Scenario: AT-SC-17 running取消先提交
- **WHEN** running取消标记先于成功事务提交，或标记后worker失联
- **THEN** 成功CAS失败且无成功回执/成绩；有效worker确认或到期条件清理最终cancelled，不能再claim/retry

#### Scenario: AT-SC-18 成功先提交与终态取消
- **WHEN** 成功事务先提交，随后取消，或取消其他已终态任务
- **THEN** 返回409 TASK_TERMINAL且原结果/任务/outbox不变，不因取消竞争删除已提交成功结果

### Requirement: AT-08 事务回滚与真实验收

05 SHALL 按D5/D7/D8验证终态原子性、迁移与权限，MUST 使用真实MySQL故障注入和最终head证据，测试执行器不能替代07B/08验收。

#### Scenario: AT-SC-19 终态中途故障
- **WHEN** 成功/失败/取消的状态、回执或outbox关闭任一事务写点注入失败
- **THEN** 整个事务回滚，无半份终态/结果；重试只能由有效租约和当前epoch提交，陈旧结果不写审计以外的记录

#### Scenario: AT-SC-20 升级与恢复
- **WHEN** 从空库/干净4升级5、每处DDL中断后修复重试，或旧新制品检查错误目标/dirty/摘要结构漂移
- **THEN** 按受审SQL真实校验且异常非零阻断；隔离恢复4备份后旧制品及身份/资料回归可用，不把down或文件存在当生产回退通过

#### Scenario: AT-SC-21 原门禁与隐私回归
- **WHEN** 执行正常check/audit/secret-scan/verify及故意破坏关键CAS条件的红绿实验
- **THEN** 失败非零且修复后通过，真实HTTPS双班及同班他人隔离、会话失效、DB停启/任务恢复、原身份/资料/健康通过；证据不含答案/凭据/幂等原键，mock/real与本人/搭档实测分列
