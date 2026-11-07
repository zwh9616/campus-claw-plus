## Purpose

冻结身份实现所需公共依赖，同时保证当前骨架的运行、配置和证据边界真实且唯一。

## ADDED Requirements

### Requirement: ICF-01 Phase-specific health contract
公共合同 SHALL 按 design D1 单独登记 skeleton 当前健康和 identity 未来健康；同一运行制品只能使用一个阶段，不能用联合类型或失败回退掩盖 MySQL 故障。

#### Scenario: ICF-SC-01 Future health is precise
- **WHEN** 检查 identity 健康 Schema 与 OpenAPI 扩展
- **THEN** 成功仅 200/status=ok/mysql=up，失败仅 503/status=error/mysql=down，匿名且真实 Ping 总预算 3000ms
- **AND** 双路径正反例拒绝缺项、额外字段、null、未知依赖和错误状态；真实 Ping 留给 01 实现验证

#### Scenario: ICF-SC-02 Freezing does not activate runtime
- **WHEN** 合入本公共冻结，或只改阶段标记/当前健康引用而不实施完整切换
- **THEN** 当前仍为原空依赖响应；提前激活必须被合同检查拒绝
- **AND** 01 实现按 D1 在同一提交同步实现、探针、Schema 引用、配置、用例和规范，不保留双成功合同

### Requirement: ICF-02 Frozen secure configuration
配置登记 SHALL 按 design D2 保留七个未来必需键及安全、使用者、时限与失败规则；未来值不能进入仓库，当前样例只含 active 键。

#### Scenario: ICF-SC-03 Complete future configuration
- **WHEN** 检查 config-register.frozen
- **THEN** 七键唯一且齐全，使用者、机密分类、必需性、所属变更、空白/非法失败及超时均明确
- **AND** backend 不能读取迁移 DSN，未来 MySQL/HTTPS 使用可信证书；实际缺失/空白/非法/TLS 测试由 01 执行

#### Scenario: ICF-SC-04 Early configuration and missing policy are blocked
- **WHEN** 将冻结键提前放进 active/样例，或移除安全元数据/伪造所属变更
- **THEN** 检查非零失败，恢复正确登记后通过；HTTP_PORT 的原边界检查保留

### Requirement: ICF-03 Reserved migrations and honest evidence
迁移登记 SHALL 按 design D3 固定号码、顺序和负责人；没有 SQL 或真实执行时不得编造摘要、成功状态或恢复结果。

#### Scenario: ICF-SC-05 Reservation collision and false execution fail
- **WHEN** 检查 000001..000003 保留号，或注入重号、未来依赖、缺失依赖、applied 状态和伪造摘要
- **THEN** 正确保留记录通过；上述错误均失败；当前实际迁移清单仍为空

#### Scenario: ICF-SC-06 Recovery is a required implementation deliverable
- **WHEN** 01 引入实际 SQL 和离线迁移入口
- **THEN** 需提供 up/down 字节摘要、结构前后置检查、逐条 DDL 故障注入、经验证前向修复及 dirty 恢复步骤
- **AND** 部分 DDL 不假称可事务回滚，不盲目 force 或删库；重复初始化不覆盖口令，DML 失败整体回滚；真实执行证据不得用本轮合同测试代替
