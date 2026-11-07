# 小张：默认身份服务接线与自测

执行人zwh9616/小张，2026-11-07。基线小陈交接41e8ed2，整合main55f0e83；本次实际执行代码是本提交的工作树，输入指纹见activation-source-manifest.json，最终提交CI另查。没有伪造小陈终审、G3共同登记或浏览器认证验收。

## 结果

正式cmd/server调用identityapp.New，启动核对可信MySQL及离线迁移状态，不自动DDL/初始化、不读DDL凭据。默认Compose提供MySQL命名卷、正式backend、HTTPS frontend，admin在tools profile；只发布环回HTTPS，保留DML/DDL进程隔离与代理精确/32。已接受R7五个输入，同提交激活十三键空样例、current身份操作与唯一200/mysql up、503/mysql down健康、严格probe及规则/README。SQL状态available带真实上下行摘要，不冒称所有持有人数据库已迁移。

完整npm run gate退出0：check、audit、全历史/暂存secret-scan、verify全部通过。保留13项门禁编排回归、24 Schema/99正反例+6语义输入、40接口示例、9合同组、2接线组、类型/构建/Go/严格7/7；41→40接口例是去掉旧空依赖health成功例后的唯一当前健康响应，不删除历史Schema反例。Windows无GNU Make的诊断保留，未冒称本机真实Make通过；远端CI另在Linux执行make gate。

默认Compose/正式二进制的可信HTTPS客户端实际验证：空库迁移/结构检查、重复初始化不改口令；健康每次真实Ping且请求标识不同；错误CA/主机名及超64KiB JSON拒绝；登录/me/CSRF/刷新、旧刷新Cookie401、教师切班后旧访问401、学生切班403且身份仍有效、退出204及旧访问401、错误口令401不发Cookie；停库健康/登录503、恢复、完整容器重建后原账号/班级和原口令保留。客户端侧没有关闭TLS验证。测试临时CA/五个随机身份不进入实际运行默认值，所有资源/秘密文件仅清理本轮随机项目。

旧15项骨架回归类别保持：Compose缺配置、真实启动healthy、两次健康/标识、静态页HTTPS、七类非法HTTP_PORT进程、占用端口、合法Trim端口及严格探针、单行JSON/查询与客户端标识不入日志、实际停止不可达及重启。健康只接受新的mysql up/down合同；健康成功仍保留原2000ms性能上限，依赖故障按批准的3秒预算加500ms传输余量。另完整执行原真实身份套件，覆盖并发轮换、同班/跨班授权、撤销、事务/初始化回滚、六个DDL断点、摘要/结构和显式恢复。

故意去掉真实Ping的可编译变异，使第二次健康错误返回200，用例确实失败；恢复原字节后通过，见activation-health-mutation.json。原有班级条件红绿证据继续保留。全局公开哈希豁免已移除，只沿用主干精确历史指纹和全部默认检测规则。

## 失败与修正

- 首次默认Compose验收因本机Docker自动地址池耗尽失败；未删无关网络。仅为临时data网络选择不与现有Docker网段重叠的显式IPAM覆盖，服务/健康/安全策略不变。原结果activation-first-wiring-failure.json。
- 新测试初次错误假定刷新必须立即撤销旧访问令牌；已按已批准01 D3修正为旧访问在900秒/撤销边界内仍有效，只旧刷新Cookie立即401；切班/退出仍必须撤销旧访问。未修改服务规则以迁就测试，原失败activation-refresh-test-assumption-failure.json。
- fixture从代理网络直连数据库做类ID查找失败，证明数据库未对该网络开放；改为只在数据网络做可信测试准备并写非秘密ID文件，API客户端仍留代理网络，不新增类列表业务API。原失败activation-fixture-network-failure.json。
- 数据库down阶段没有凭据时测试证明文件序列化null，调用者错误展开；改为只在确有秘密时更新测试排除文件。原失败activation-empty-secret-proof-failure.json。真实产品响应仍符合503，未改业务断言。

## 证据和下一步

activation-gate.json为完整输出；activation-gate-steps.json为四步退出码；activation-wiring-results.json为默认生产入口真实容器/可信HTTPS；activation-identity-results.json为原完整真实MySQL身份回归。报告和源码无真实配置值，测试材料随验证删除。只更新当前变更证据，不追改archive。

仍待小陈对最终head真实终审及镜像扫描；G3共同记录见待审#17，不能代其确认；#15已由用户原生200%截图配合既有样板复核收口2.3，但真实登录页面及全页面3.5/4.2联验未完成。故本PR此时不能自行合并或归档。运行证书/初始化秘密由持有人本机提供，当前未在持有人真实部署环境留运行服务，不把隔离测试CA当生产可信证书。02可直接复用六个current身份接口及相同HTTPS部署方式，禁止接planned教学业务。

补充提交前扫描：源码清单使用文件路径作JSON键时，openapi.yaml中的api字样使其公开文件摘要被误判。重新核对磁盘SHA后，将路径和sha256分为正常独立属性，未增加任何检测豁免；同一配置下随机api_key及旧公开SQL摘要复用到任意api_key字段均退出1阻断，见activation-scan-checks.json。
