# 00 修订规约复审（小张授权，AI辅助）

日期：2026-11-04。审查对象为小葛PR #3的完整head `221be733194830daa9b35f810c37f035679e51bb`，基线main `2bf12e223e9a1e3bdd9044e32f7e8067df1f7afa`。旧head的六项问题及其当时结论保留在[首次审查](zhang-spec-review.md)，不能将旧记录当作本次结论。

**复审通过，G1成立，仅允许小张实施00公共合同、规则及检查。** 已通过连接账号zwh9616提交[APPROVE评审5765025797](https://github.com/zwh9616/campus-claw-plus/pull/3#pullrequestreview-5765025797)，绑定上述head；六条旧讨论已逐条确认并解决。此批准不等于小葛对实现的终审，也不成立G2/G3。

| 意见 | 对修订的核对与结论 |
| --- | --- |
| R1 幂等与截止顺序 | D5/BC-SC-13明确先重新认证授权，再重放已提交的同键同载荷原202；同键异载荷409，新键才检查截止与版本。旧pending只是原受理快照；通过。 |
| R2 SSE取消与断流 | D6/BC-SC-14区分可写连接唯一CANCELLED/error、断网仅保证持久化；completed/cancelled胜出后不被断网覆盖，取消与完成竞争只有一终态；通过。 |
| R3 下游准入 | D8、PB-09 delta、tasks与BC-SC-11统一G1仅00、G2后下游apply、G3后业务合并；00/10门禁自身无循环依赖；通过。 |
| R4 类型方言 | D1/BC-SC-17统一OpenAPI3.1及2020-12单源，明确null、闭合对象、双路径正反例与工具不兼容须失败；通过。 |
| R5 冻结不完整 | D9补6个认证/me端点、完整AuthSession/CSRF、鉴权和错误集合；其他操作planned登记且禁止占位operation；通过。 |
| R6 旧worker写入 | D5/BC-SC-15/16明确epoch、执行者、未过期租约、running以及取消标志写入条件，领取次数上限及事务边界；运行验证留给05/08；通过。 |

C1目录责任已明确为冲突协调窗口，不是固定编码分工或第三审批。C2保留16行共享台账，`reports/progress.md`仅作为入口。C3前端样板及视觉审查要求记录在产品规范，由02再落实具体页面。

重新执行`npm run check:spec`：退出0，change/business-contracts与spec/project-bootstrap共2 passed / 0 failed。规约文字审查不是未来授权、并发或真实模型运行验证。

BC-SC-01仍未执行：本会话有历史上下文，不能称无历史会话。tasks 1.5拆分显示已完成的PR复审与未完成的独立阅读，1.6根据真实批准勾选；D8将G1定义为当前head批准，并将真实新会话证据保留在00归档前，不减少任何验收要求。

后续apply和限制见[实现记录](apply-verification.md)。00实现终审仍由小葛执行；合入main后的集成提交与复验必须另留证。
