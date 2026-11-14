# 04E Go私有解析客户端与真实互通

小张统一负责，DI-SC-14/I1/I2。#49已获审合入；#51最终97d4f08获Kevcco真实APPROVED5903073379，正常合入main97f25b9，精确main完整CI43575033114成功。本轮从该主干推进下一批，原工作树/持有人数据保留，不冒称本人操作了同伴已执行的合并。

新增backend/internal/documentparser出站适配器，不让领域/存储反向依赖HTTP。构造器只接受固定http://document-parser:8091及canonical32字节token，不读环境，不提供任意URL。代理nil/禁止重定向/连接1秒/头32秒/总35秒/头8KiB/响应8MiB；新上传健康预检独立500ms，原202重放和旧读取仍应由未来服务层绕过预检。关闭闲置连接/响应体，任何错误不返回或记录原始令牌/正文。

响应先严格检查UTF-8、重复字段、surrogate、16层深度与闭合键集合，再按HTTP/状态/原因关联校验。ready正文最多2MiB、不改写CR/BOM/Unicode，按码点检查页/逻辑块、严格递增unit、完整覆盖及两LF分隔；PDF真实页数与Word null页数分别校验。needs_ocr只对PDF生效；busy/断连→worker_interrupted、预算到期→parse_timeout、坏结构/鉴权/重定向等→internal_failure。解析结果不带可授权身份，后续持久发布仍须完整租约CAS及原文回查。

7组Go测试含真实httptest套接字、健康/原字节/MIME/Content-Length、Unicode/码点、坏JSON/缺字段/重复字段/非法surrogate/未知字段/状态映射、重定向请求次数、预检超时/调用方取消及大小限制。真实服务质量不以这些合成响应代替。

脚本额外编译实际客户端，在与准确待扫描解析镜像共享的专属internal网络运行：无宿主端口，双方nonroot/read-only/cap_drop/512MiB无swap/1CPU/32PIDs/tmpfs；Go编译网络none。40份固定PDF/DOCX实际经Go→HTTP→Python子进程，逐份校验ready及gold页/块kind/unit共195位置；错误令牌拒绝，实际删除自身服务后预检false/parse worker_interrupted。原内核CER/负例仍由原检查覆盖，此互通检查不另编造质量分数。每轮随机token仅忽略的本机文件/环境，finally删除，日志校验与脱敏；清理前核对资源专属label，不删除不明来源容器/网络。

当前首轮互通40/195、实际失联与凭据/资源清理0，Go vet/7组测试0。锁定Go镜像缺cgo，首个可选-race尝试未执行成功，如实保留；不声称race通过，也未新增skip。首次超时测试的httptest handler未消费请求体导致清理等待，确认专属容器挂载后仅终止该测试容器；修复测试夹具为先读体、再有界等待，30秒测试上限与500ms客户端断言保留，重跑0。[原件目录](parser-client/go-vet-test.txt)。临时挂载绕过固定origin/token校验的客户端，关键断言真实红1→原客户端绿0，跟踪源码未改，见[红绿](parser-client/origin-red-green.json)。

这仍不是生产装配：默认backend未导入客户端、两个键仍frozen/空样例不新增、当前Target5/22 current/四生产服务保持。配置/私有网络原子激活、五生产镜像及探针、迁移6/中断/备份恢复、持久原件/幂等202/租约队列和公开Document/UI仍待实施。完整check、原verify/实扫/清理、秘密扫描和最终CI按实际结果补证，未完成不勾父任务。

提交前原完整npm run check退出0（含原40合同/Go全包vet/test/类型构建/strict11/11/内核/HTTP组件/真实客户端互通和SQL候选探针）；[输出](parser-client/full-check.txt)/[最终组件报告](parser-client/final-component-results.json)。当前check/scan指纹已包含Go客户端、测试与互通脚本；清理核对专属label，真实40文件/195位置、错误鉴权及实际服务消失、日志安全与凭据/自身资源清理全部通过。锁定Node镜像中原npm run audit两树0，[输出](parser-client/container-audit.txt)。原完整verify/实扫、最终head/CI及真实成员批准仍待执行，不提前声明生产装配、迁移或队列完成。
