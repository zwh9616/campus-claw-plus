# 04E Go私有解析客户端与真实互通

小张统一负责，DI-SC-14/I1/I2。#49已获审合入；#51最终97d4f08获Kevcco真实APPROVED5903073379，正常合入main97f25b9，精确main完整CI43575033114成功。本轮从该主干推进下一批，原工作树/持有人数据保留，不冒称本人操作了同伴已执行的合并。

新增backend/internal/documentparser出站适配器，不让领域/存储反向依赖HTTP。构造器只接受固定http://document-parser:8091及canonical32字节token，不读环境，不提供任意URL。代理nil/禁止重定向/连接1秒/头32秒/总35秒/头8KiB/响应8MiB；新上传健康预检独立500ms，原202重放和旧读取仍应由未来服务层绕过预检。关闭闲置连接/响应体，任何错误不返回或记录原始令牌/正文。

响应先严格检查UTF-8、重复字段、surrogate、16层深度与闭合键集合，再按HTTP/状态/原因关联校验。ready正文最多2MiB、不改写CR/BOM/Unicode，按码点检查页/逻辑块、严格递增unit、完整覆盖及两LF分隔；PDF真实页数与Word null页数分别校验。needs_ocr只对PDF生效；busy/断连→worker_interrupted、预算到期→parse_timeout、坏结构/鉴权/重定向等→internal_failure。解析结果不带可授权身份，后续持久发布仍须完整租约CAS及原文回查。

7组Go测试含真实httptest套接字、健康/原字节/MIME/Content-Length、Unicode/码点、坏JSON/缺字段/重复字段/非法surrogate/未知字段/状态映射、重定向请求次数、预检超时/调用方取消及大小限制。真实服务质量不以这些合成响应代替。

脚本额外编译实际客户端，在与准确待扫描解析镜像共享的专属internal网络运行：无宿主端口，双方nonroot/read-only/cap_drop/512MiB无swap/1CPU/32PIDs/tmpfs；Go编译网络none。40份固定PDF/DOCX实际经Go→HTTP→Python子进程，逐份校验ready及gold页/块kind/unit共195位置；错误令牌拒绝，实际删除自身服务后预检false/parse worker_interrupted。原内核CER/负例仍由原检查覆盖，此互通检查不另编造质量分数。每轮随机token仅忽略的本机文件/环境，finally删除，日志校验与脱敏；清理前核对资源专属label，不删除不明来源容器/网络。

当前首轮互通40/195、实际失联与凭据/资源清理0，Go vet/7组测试0。锁定Go镜像缺cgo，首个可选-race尝试未执行成功，如实保留；不声称race通过，也未新增skip。首次超时测试的httptest handler未消费请求体导致清理等待，确认专属容器挂载后仅终止该测试容器；修复测试夹具为先读体、再有界等待，30秒测试上限与500ms客户端断言保留，重跑0。[原件目录](parser-client/go-vet-test.txt)。临时挂载绕过固定origin/token校验的客户端，关键断言真实红1→原客户端绿0，跟踪源码未改，见[红绿](parser-client/origin-red-green.json)。

这仍不是生产装配：默认backend未导入客户端、两个键仍frozen/空样例不新增、当前Target5/22 current/四生产服务保持。配置/私有网络原子激活、五生产镜像及探针、迁移6/中断/备份恢复、持久原件/幂等202/租约队列和公开Document/UI仍待实施。完整check、原verify/实扫/清理、秘密扫描和最终CI按实际结果补证，未完成不勾父任务。

提交前原完整npm run check退出0（含原40合同/Go全包vet/test/类型构建/strict11/11/内核/HTTP组件/真实客户端互通和SQL候选探针）；[输出](parser-client/full-check.txt)/[最终组件报告](parser-client/final-component-results.json)。当前check/scan指纹已包含Go客户端、测试与互通脚本；清理核对专属label，真实40文件/195位置、错误鉴权及实际服务消失、日志安全与凭据/自身资源清理全部通过。锁定Node镜像中原npm run audit两树0，[输出](parser-client/container-audit.txt)。原完整verify/实扫、最终head/CI及真实成员批准仍待执行，不提前声明生产装配、迁移或队列完成。

## 干净提交与原件收口

代码d9665ed3bbed92a9d05e246ccfdc1e9deb1e74bc已交[PR #52](https://github.com/zwh9616/campus-claw-plus/pull/52)，本机干净原npm run verify退出0，原四生产镜像/HTTPS/数据库重建与隔离恢复及新增组件实扫/互通/实际断连/清理通过。[本机12文件原件](parser-client/local-verify.zip) SHA29a9e344aee0fd04a90e32b5c962db5ef3e44f3ee77a8c997f979a19e780b605/[范围证明](parser-client/local-verify-proof.json)；该包仅含本轮verify与scan，提交前check/audit单独记录，不伪造一次完整原生gate。

[完整CI43577952040](https://github.com/zwh9616/campus-claw-plus/actions/runs/43577952040)实际success，artifact14106773051已实际下载；[16文件原件](parser-client/first-ci-runtime.zip) SHAa83f1855e392f9a7b28a7ab9f6d2be1a6d76077ac0e83b5d49dd3f19a4cc545d等于GitHub digest。[原运行核对](parser-client/first-ci-runtime-verified.json)/[内核核对](parser-client/first-ci-core-verified.json)/[新增真实客户端核对](parser-client/first-ci-client-verified.json)：四段0/verify246290ms、check与scan各40真实Go/Python文件/195位置/错误鉴权/实际服务消失及标签核对/秘密清理通过，原7组HTTP/8组内核/25负例/45关键句、四生产镜像+候选零HIGH/CRITICAL、18组05/五恢复/三HTTPS/SQL候选16拒绝与全部清理通过，原件解包秘密扫描0。两平台完整原始字节指纹各自保存，不把不同换行/证据元数据误称跨机器相同。

本补证只修改共享表/tasks与报告，不改代码或受审合同；自身最新CI与真实批准另核。#52交小陈实际审查，未收到批准、未合并。新配置/网络生产激活、迁移6/五DDL中断/repair/旧制品拒绝/备份恢复以及独立解析持久队列仍待后续实际实施和验收，不勾这些父任务。
