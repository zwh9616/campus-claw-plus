# 部署运维规范
本轮两个独立服务frontend/backend，无数据库、模型、持久卷。违反本文件须修复并重新验证。
| 条目 | 规则/示例 | 检查 |
| --- | --- | --- |
| 构建 | Docker分阶段；依赖精确锁定，基础镜像固定摘要；Go静态程序仅复制运行产物，前端仅复制dist | 干净目录同提交构建；禁止COPY .env与使用latest标签 |
| 环境配置 | 开发/测试/生产隔离，同制品换运行配置；本轮唯一必需业务键HTTP_PORT | 缺失/空白/abc/0/-1/65536非零，无隐藏默认；启动示例明确填值 |
| 端口 | 前端127.0.0.1:5173→80；后端127.0.0.1:HTTP_PORT→HTTP_PORT | 8080是示例，可用空闲端口写入.env并记录；不得停止无关项目来抢端口 |
| 健康 | /health免认证，200与status=ok、dependencies={}；镜像内/server --healthcheck检查真实状态/类型/载荷/标识 | 容器healthy而非仅running；不依赖镜像有curl |
| 停机 | SIGTERM/SIGINT停止接新请求、10秒内排空；Compose停止宽限15秒 | 单元验证在途请求完成；实际容器停止后不再提供本项目响应 |
| 日志 | stdout每行JSON，ts UTC RFC3339/level/module/message/request_id；请求加method/path/status/duration_ms | 启动request_id=null；HTTP标识非空、同X-Request-ID，禁止敏感值 |
| 发布留痕 | docs/lesson-07/记录运行；docs/verification.md仅索引；全组验收后归档PR，再给最终提交打标签 | 不提前归档、标签或声称他人批准 |
| 回滚 | 仅本项目compose down，再用上一已验收提交及其配置构建启动 | 没有上一可运行版本时明确未演练，不用停机当回滚成功 |

## 后续运维约束
- 观测至少请求量、错误率、p95耗时、依赖状态；错误率5分钟>5%、p95>500ms或依赖连续失败3次通知当周负责人，C主责排查恢复。本轮未接告警系统，不宣称已运行。
- 数据迁移先加字段→双写→切读→最后删旧；已发布迁移不修改；旧版本须兼容，有备份和回滚/补偿。
- 有持久数据后每日MySQL备份/Qdrant快照保留7天，RPO24小时、RTO60分钟；C在隔离实例恢复演练并记录实际耗时。本轮无数据备份任务。
- 后续写接口/AI按主体限流并在对应规约规定配额；超过配额429且给重试建议。当前无这些业务。
发布相关变更按campus-release-check执行；用户实际授权决定远端操作范围，技能不额外授予权限。

## 记录单位例外
JSON日志正式验收对象为Go应用输出，HTTP完成日志使用duration_ms；Nginx仅提供辅助JSON访问日志，其原生request_time记录为duration_seconds，不冒充毫秒。Nginx内部诊断按原生错误日志处理，不将其作为Go应用JSON证据。
