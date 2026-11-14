# 04E 私有解析HTTP组件

小张统一负责；对应DI-SC-14/I1，基线main670ac0c。实际核对#49最终4acd495获Kevcco真实APPROVED5902350597后正常合入，精确main完整CI43567519679成功；无未解决审查线程。#48协议已获审合入，因此本轮可以实施私有组件，不需再冻结另一套协议。

`server.py`严格解析8KiB头、拒绝重复头/Transfer-Encoding/未知查询/额外已缓冲正文，只接受受控两路径与PDF/DOCX原字节；Bearer恒定时间比较先于读体。固定8091，读取DOCUMENT_PARSER_TOKEN须canonical32随机字节，错误不回显。头/体各5秒绝对预算、整个请求35秒；有界连接16，解析锁并发1，busy立即503，健康仍可响应。调用已有独立30秒/384MiB子进程，临时原件结束清理；不在HTTP进程内直接执行解析核心。输出JSON/长度/Connection close/no-store和服务端request_id，日志只含受控路径/状态/耗时/新ID，不记录原件或令牌。

默认镜像入口仍是离线CLI，默认Compose、active空样例、四生产镜像、公共22 current及Target5保持；组件只在显式隔离启动或测试中运行。这还不是A1.2b全部完成：Go客户端、配置/出站原子激活、真实五生产镜像和部署探针仍待接；迁移6/备份恢复及持久队列/HTTP/页面接线也仍待实施。

检查器保留原8组内核/40语料/25负例验收，在同一实际镜像和同等network=none/read-only/nonroot/512MiB无swap/1CPU/32PIDs/64MiB tmpfs下追加7组真实套接字测试。40份文件实际经HTTP→子进程解析；7种失败码映射通过受控替身单独验证，不伪称实际HTTP超时/OOM均复现。实际慢请求头与不完整正文各5秒预算、认证先于大正文、busy/健康、坏帧恢复、临时目录和安全JSON日志另验。组件无数据库访问，不复用05批改Task。

首次启动的镜像尚无额外正文拒绝，追加边界测试发现声明1字节却发送2字节被解析为损坏PDF，422≠400，原失败保留；随后增加拒绝已缓冲额外字节并重新构建/完整重跑。测试期间补充了边界场景，因此该首轮不作为稳定版本成功证据。完整check/audit/秘密扫描/原verify及制品扫描、受控红绿、最终CI/真实批准按实际结果补记；未执行不写通过。

本轮组件检查已退出0：原8组内核、40清晰/25负例及私有HTTP7组/40实际文件全部通过，包含两项真实5秒绝对读取预算；[原件](parser-rpc/component-results.json)/[内核](parser-rpc/core-results.json)。[首次失败](parser-rpc/initial-failure.json)保留。另在专属隔离容器仅覆盖挂载变异server.py（临时移除Bearer判断），真实HTTP测试红1→原镜像绿0，跟踪源码逐字未变、自身镜像清理0，见[红绿](parser-rpc/auth-red-green.json)/[红输出](parser-rpc/auth-red.txt)/[绿输出](parser-rpc/auth-green.txt)。这只是组件门禁，不代表Compose或数据库接通；完整gate/最终CI仍待核。
