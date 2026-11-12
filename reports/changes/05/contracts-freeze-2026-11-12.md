# 05机器合同冻结候选与验证

执行人：zwh9616（小张，AI辅助），2026-11-12（Asia/Shanghai）。基线main da8624c，#31已获真实批准5871577319并正常合入，PR CI43185758473与main CI43186361938成功。G2/G3及01/04前置成立；本轮只做05公共机器合同，尚待小陈审定，不apply业务。

## 范围与审定项

- 九个固定操作从planned描述推进为本候选frozen；13个已实现操作仍current，其余planned能力不进paths。没有HTTP/业务/存储/迁移实现，无新增配置/服务/执行器，运行精确目标仍4。
- 10个新增单源Schema：Assignment、Submission、两个创建请求、SubmissionAccepted、TaskVersionRequest、AssignmentListParameters、SubmissionIdempotencyKey、两种具体Page。字段引用及分页复用现有单源；Task名称和字段/状态机不改，细化既有error/status/cancel关联。审定选择见05设计D9，尤其405空体/Allow、创建deadline非法400与提交逾期409的区别、Task两种固定安全错误。
- 所有接口限定Bearer、可信会话当前班级与资源原班级；学生只读本人提交/任务，教师任务只读；跨班/其他学生/不存在统一404，拒绝无领域副作用。字段、权限、错误集合、缓存、配额及完整Task关联链均有独立声明变异反例。
- 幂等先授权及类型校验，再查已提交快照；同载荷原202、异载荷409，先于新配额/版本/截止；原答案/原键不trim。Go固定工具链实际生成5组默认encoding/json字节/SHA-256向量，等价JSON键顺序/转义保持摘要，原换行/空白和版本变化改变摘要。生成器仅用于合成向量，不能当真实请求解析器。
- JSON Schema码点上限与整个原始请求65536字节上限分列；包括65536/65537、20000非BMP导致字节超限、空白答案合法、孤立代理项非法、页计数/创建时间+精确ID顺序及Task状态/错误/版本/epoch示例。

## 已执行与剩余验证

本机Node25.2.1/npm11.6.2及固定Go容器工具链。当前`npm run check:contracts`已通过：42个Schema，213组结构正反例、6个既有语义输入及30组动态边界在独立2020-12/OpenAPI解引用两条路径一致，155个操作示例；原16组合同测试及新增9组AT声明/语义测试共25组通过。5个Go向量生成器实际退出0。

受控将OpenAPI提交操作的authorization_before_lookup改为false，普通合同检查真实退出1，错误定位该声明；finally逐字节恢复后同入口退出0。原首次Task条件缺少显式integer类型的strictTypes失败保留，修复Schema后恢复，不放宽Ajv strict选项。原始日志将随验证归集。

本提交代码与候选准备完成，完整check/audit/secret-scan/verify及四实际镜像扫描待本机执行；未运行不写通过。以下仍全部待apply/独立终审：真实05授权/限流、并发同键、deadline时钟屏障、事务回滚、租约/ABA/取消、崩溃恢复、000005真实SQL与逐DDL失败、4/5制品/备份恢复；本轮内存合同例子不替代它们。

## 交接

小张提交候选供小陈审定。1.2规约批准已有远端事实，1.3仅候选与编号方案已准备，实际两人审定/正常合入前保持未勾，2.x/3.x不提前启动或完成。小葛另审#32/#33及交06资料归档，不冒充他人批准。

提交前扫描首次被固定的合成幂等键样例命中generic-api-key（stdin diff224，定位assignment-semantic-cases.json的SubmissionIdempotencyKey，与schema正例共用同值）；该值仅静态虚构样例，无账号/服务用途。改用同样满足16字符ASCII合同的低熵有效样例，保留高/低边界与动态字符反例；未加任何豁免或改变扫描规则/范围。[原始脱敏扫描结果](contracts/precommit-scan-failure.json)。恢复扫描及完整gate按后续真实输出补记。

## 本机最终结果（代码源码92246e2）

原`npm run gate`的check/audit/secret-scan/verify四段均退出0，notRun为空；四个实际镜像HIGH/CRITICAL全0，原身份/资料/可信HTTPS、停库/恢复、保留卷重建、迁移与隔离备份恢复保留通过。13个现有操作对象与main逐项一致；本轮没有backend/frontend/deploy/Compose/配置或SQL修改。[汇总](contracts/gate-summary.json) · [原始JSON ZIP](contracts/gate-raw-json.zip) · [初次Schema失败/授权红绿/完整门禁日志](contracts/contract-check-logs.zip)

原提交前扫描命中的合成键已替换为有效低熵样例；全历史/暂存扫描及原完整gate中的扫描均通过，没有增豁免或缩小范围。后续仅补本次证据与排版，最终head的PR CI仍须独立核对。真实05业务、并发/任务/迁移测试仍未实施，机器合同1.3仍待小陈实际审定/合入。
