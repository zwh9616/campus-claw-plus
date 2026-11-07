# 00 公共合同 business-contracts/v1

执行依据：`2026-11-04-business-contracts` 的D1—D9、BC-01—06；规约head `221be733194830daa9b35f810c37f035679e51bb` 已获[小张授权的复审批准](https://github.com/zwh9616/campus-claw-plus/pull/3#pullrequestreview-5765025797)。00实现已获小葛对75cadbf终审批准，合入main 4cfd61d并通过main CI和本机check/verify；G2已成立，证据见[集成记录](../../reports/changes/00/main-integration-2026-11-05.md)。下游仍须自身批准与依赖，G3未成立。

## 从这里开始

| 入口 | 用途 |
| --- | --- |
| [openapi.yaml](openapi.yaml) | OpenAPI3.1.0；JSON文本也是合法YAML，解析与引用均由工具校验 |
| [schemas](schemas/) | JSON Schema2020-12唯一类型源；OpenAPI仅引用，不复制第二套类型 |
| [endpoint-register.json](endpoint-register.json) | current/frozen操作清单、planned能力的负责人及缺少内容 |
| [config-register.json](config-register.json) | 当前active空值配置键及其他未来配置职责、未启用的MCP出站例外 |
| [change-dependencies.md](change-dependencies.md) | G0/G1/G2/G3与每个变更前置 |
| [migration-register.md](migration-register.md) | 数据库迁移编号、上下行真实摘要与公共文件协调方法 |
| [rule-alignment.md](rule-alignment.md) | 规则冲突如何迁移、怎样检查 |
| [acceptance-map.md](acceptance-map.md) | 每条BC场景的检查与未来运行责任 |

## 当前实现和规划的区别

- **current**：`GET /health`与六个身份操作已经在本分支默认入口接线；健康真实Ping，200/mysql=up、503/mysql=down。最终终审/部署及前端联验仍以共享表为准。
- **frozen**：本轮六个身份操作已转current，没有额外开放业务接口。
- **planned**：资料、任务、成绩、流式会话和审计等操作只有责任登记，不出现在OpenAPI paths中，也不能接线或生成假入口。Task、Turn、Citation、GradeResult、SSE、Audit等Schema用于候选类型检查，不表示该能力已冻结为可调用API。
- `Page.schema.json`是明确的`Page<Audit>`实例，items引用Audit；未来Material分页必须先定义Material及新的明确分页Schema，不使用裸object占位。

认证传输采用`Authorization: Bearer ...`、`X-CSRF-Token`与`Origin`，刷新Cookie传输名选为`campus_refresh`（00落地的具体命名，需本实现PR审查；01若调整须同步合同）。Cookie属性/期限遵循D3/D9；logout无成功body。auth/me只开放各操作声明的错误集合；通用Error还容纳后续已约定错误码，但不凭其存在开新路由。HTTP层拒绝未知/重复键及64KiB上限属于01运行检查，普通JSON Schema无法检测解析后已丢失的重复键。

## 本机与CI使用同一入口

```text
npm ci
npm run setup
npm run check:contracts
npm run check
npm run audit
npm run secret-scan
npm run verify
```

Node最低版本提升为22.19.0以符合锁定校验工具要求；CI原有Node22入口会安装该系列版本。Go/容器检查未删除，所有子检查失败仍非零阻断。`check:contracts`已纳入原`npm run check`，因此原CI无需新增平行流程。没有新增进度表提交检查的自动CI；该要求仍由AGENTS与PR审查落实。

工具为精确锁定的swagger-parser13.1.0（结构校验支持3.1）、Ajv8.20.0的2020导出、ajv-formats3.0.1与yaml2.8.3，均MIT。已核对安装包的`lib/validators/schema.js`确有3.1分支；类型方言还由82组双路径样例验证。依据：[OpenAPI3.1](https://spec.openapis.org/oas/v3.1.0.html#schema-object)、[Ajv2020说明](https://ajv.js.org/json-schema.html)。canonical Schema $id只作标识，检查器映射到已加载本地文件；禁HTTP读取和越出合同目录的引用，不依赖外网解析Schema。

## 怎样写新合同

1. 改对应OpenSpec和端点/配置登记，说明受影响变更，由该变更两人确认。00归档后通过新change修订相应主规约，不倒改archive；“先改00”指维护这套公共合同，不重新修改历史证据。
2. types只改schemas；端点operation只引用schemas。新增对象封闭属性、列必需字段；可空用null联合，不用3.0 nullable。planned升级须完整输入、成功/失败响应、权限、场景及审查依据。
3. 正反例加入fixtures：结构例由双路径检查；求和/跨字段/可信rubric等由语义测试检查。每个新Schema需要正例及缺项/额外字段/边界反例。
4. 运行原门禁；关键条件临时破坏确认失败，立即恢复重跑并留证。不能将这些内存合同样例称为真实数据库并发或模型测试。

SSE fixture的`{event,data}`只是测试表达：真实wire仍为`event:`与JSON `data:`两行加空行；`SSEMeta/Token/Done/Error`分别约束data。断网不承诺终结帧送达，后续07A必须实际验证持久化查询。Grade语义检查要求可信rubric上下文；模型自己给的max_score不能当权威。

## 交接证据

实现证据见[00 apply记录](../../reports/changes/00/apply-verification.md)及[main集成复验](../../reports/changes/00/main-integration-2026-11-05.md)。所有凭据样例都是不可用测试文本，禁止替换为真实值。小葛终审与main集成复验已完成，G2已成立；[BC-SC-01真实独立阅读](../../reports/changes/00/independent-reading-2026-11-05.md)首次未通过，错题订正主路径需补充复验，00尚不归档；G3仍待10前置门禁验收，不能将G2当作G3。

## 01公共依赖冻结（2026-11-06）

[公共变更](../../openspec/changes/2026-11-06-identity-public-contracts/proposal.md) 收口 PCR-IDF-01..03；[identity-phase.json](identity-phase.json) 是阶段及迁移保留号的机器登记，配置登记的 frozen 与 active 严格分开。新健康Schema已成为当前 `/health` 唯一responses；旧空依赖成功已停用。01 同一实施提交原子激活所有受影响实现/探针/规则/配置/用例，无环境回退或双成功合同。版本、HTTPS、迁移恢复与初始化见公共设计及01 runtime-plan；当前默认入口已激活MySQL和身份路由，真实页面、终审和集成验收尚未通过的仍待办。

## 三条用户路径的文档入口

见[00设计D0](../../openspec/changes/2026-11-04-business-contracts/design.md)：资料答疑、作业批改复核和错题订正。错题订正为待审流程说明，具体08/09接口仍planned；不以补文档冒充独立阅读或业务实现通过。
