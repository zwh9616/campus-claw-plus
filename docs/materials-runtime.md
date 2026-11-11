# 04 后端运行与复核

对应MR-01..04、MR-SC-01..10。04实现#26已获小张终审并正常合入main6634e51，主干完整CI42987148688成功；本分支仅生成归档候选，见[核对记录](../reports/changes/04/archive-review-2026-11-11.md)及[共享表](project-status.md)。04规约#23和机器合同#25已合入；本轮只开放资料后端，资料前端、作业及AI仍未实现。

## 启动与升级

继续使用README既有可信HTTPS、独立DML/DDL账号、只读CA和持久卷配置，不新增键。先停止写流量并安全备份；构建新admin，按README运行离线`migrate`和`check`，目标必须为4，再启动新backend/frontend。server只检查结构和摘要，不自动迁移。失败不能force/down或删除带数据卷；按[离线恢复](identity-migrations.md)及[04方案](../openspec/changes/archive/2026-11-10-materials-retrieval/migration-plan.md)处理。

01旧六个SQL及摘要不变。000004三张表保存原文件、规范化正文、班级/版本、幂等记录与片段；可执行摘要见manifest及identity-phase。旧版本精确要求3，不能直连4；回退先保全新版库，再在独立库恢复升级前备份并验证旧制品，不能承诺升级后数据自动带回旧版。

## 实际操作与预期

持有人在本机通过既有登录取得短期Bearer，客户端正常验证HTTPS证书和主机名；不在群、仓库、截图或日志放令牌、Cookie、文件内容或密码。Cookie不能替代这些资料操作的Bearer。

| 操作 | 约束与结果 |
| --- | --- |
| POST `/api/v1/materials` | 当前班级教师；multipart恰好title/file各一个，UTF-8 `.txt`原文件1..262144字节、总请求不超过278528；单个16..64字符ASCII Idempotency-Key；首建201，原键同载荷200，异载荷409 |
| GET `/api/v1/materials` | page默认1、page_size默认20且最大50；按ID倒序；教师看到本班非deleted，学生只看到本班ready |
| GET `/api/v1/materials/{id}` | 授权后返回material与规范化body；外班和不存在同构404 |
| GET `/api/v1/materials/{id}/download` | 授权后附件下载；逐字节保留BOM/换行等原始字节，nosniff和no-store |
| POST `/api/v1/materials/{id}/retry-index` | 当前班级教师；无body/query；pending/failed显式重试，ready保持幂等；原键重放上传不会自动重建索引 |
| GET `/api/v1/search` | q去首尾空白后1..2000码点，mode只允许keyword，top_k默认4/最大10；大小写敏感，`%`/`_`为字面字符；引用再查当前持久原文、班级、版本和码点区间 |

上传和重试共享每用户12次/Unix分钟的配额；第13次429并给Retry-After，切班不重置。匿名/过期/切班或退出后的旧访问凭证401；学生写403；跨源写403。非ready不会向学生暴露，索引失败可确认时返回failed，未知结果或依赖不可用503、预算耗尽504。公开健康仍单独使用真实MySQL Ping的3秒预算和原200/503合同。

## 复核入口

`npm run gate`依次执行check/audit/secret-scan/verify；容器测试使用随机独占项目并清理本次资源，所有子项非零阻断。真实授权、并发幂等、故障恢复见Go integration；生产Nginx→server→MySQL、原文/片段随卷重建后的回查见wiring。测试不是生产数据，也不代替小张的独立终审；完整证据写reports/changes/04，不把CI当作另一成员本机复现。
