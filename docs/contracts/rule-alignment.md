# 00规则迁移对照

此表随合同实现交小葛终审。当前应用仍是骨架；G1允许实施00文档与门禁，G2成立后才允许下游业务apply。历史archive及docs/lesson-07不修改。

| 原约束 / 冲突 | 当前约定与目标文件 | 检查 / 证据 |
| --- | --- | --- |
| AGENTS永久仅骨架 | 明确当前运行与G1/G2/G3阶段，链接BC及合同入口 | 共享表/准入登记，终审检查G2未提前标成通过 |
| 仅HTTP_PORT与未来配置 | security、deployment按config-register.active验证，00仍只有HTTP_PORT空值；planned键不启用 | foundation保留忽略与秘密文件检查，空值/缺项/重复/未登记键反例 |
| 所有接口只能health | backend保留health当前载荷，冻结auth只是机器合同；后续批准后才生成业务路由 | 原Go/verify断言全部保留；operation阶段清单检查 |
| PB/SC是唯一测试编号 | testing和campus-add-tests改为当前change Requirement/Scenario；旧PB/SC语义不变 | BC-SC-02/06/09/14/17/18映射与合同/语义测试 |
| 所有证据进lesson-07 | 两技能与testing/deployment新增reports/changes/<编号>，旧目录历史只读 | 当前apply记录与原目录无差异 |
| 两服务与未来依赖 | deployment保留当前两容器；后续change同时改接口、探针、测试及健康合同 | 此轮verify仍断言仅frontend/backend，未来增加服务前必须新规约 |
| 全禁私网与MCP接入 | security仅登记http://mcp:8090/mcp候选，enabled=false；03/07C审查及部署证据满足后才启用 | 登记值和禁userinfo/query/fragment/redirect规则检查，未来真实SSRF用例归03/07C/11 |
| 前端不调用API/无业务入口 | product保留当前静态页，G2后02按批准合同扩展；增加样板和两档视觉审查交接 | 00无前端代码改动；02/06/09运行和截图待验 |
| 两套Schema可能不一致 | docs/contracts以2020-12为唯一源，OpenAPI3.1引用 | 82个正反例双路径一致、全部operation示例通过、planned误入反例 |
| 旧归档范围例外 | 两技能明确仅适用于旧骨架，不成为本轮豁免；新会话、终审与集成未做保持待办 | BC-SC-01与小葛终审不预勾；不改历史证据 |
| 旧入口可能绕过新检查 | package.json在npm run check内加入check:contracts，其余阶段保持 | 根check失败非零、受控红绿；CI仍调用同一check |

回退本变更须成组回退合同、规则、检查入口和锁文件，使骨架与旧规则一致；00没有运行数据，无数据库回滚操作。不能只删除失败断言或恢复旧说明以制造通过。
