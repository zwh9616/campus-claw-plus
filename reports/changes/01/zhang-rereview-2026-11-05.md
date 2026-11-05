# 01 小张复审与公共依赖交接

日期：2026-11-05；对象PR #6，head `90374c192616ba2243d4b6031490a8adf4335b25`，main `4cfd61d8119c51bc3bf2870a17c9754f0975b3dc`。小张授权AI辅助，未代小陈修改规约、未批准或apply。

[正式复审](https://github.com/zwh9616/campus-claw-plus/pull/6#pullrequestreview-5786143149)为REQUEST_CHANGES。原R1凭据优先级、R2派生CSRF/恢复接受；原R3的503/504及共用预算接受，但SC-12/design D3仍无条件承诺切班失败保留旧凭证，与COMMIT不明可能已提交矛盾。须区分提交前回滚、已提交但结果丢失，给出恢复及真实故障注入判据。原R4阈值/双桶/窗口接受，剩余两桶释放时间不一致与4095桶需两新桶的原子容量边界待补。Purpose及过时PR描述一并请小陈整理。

[逐项候选确认](https://github.com/zwh9616/campus-claw-plus/pull/6#issuecomment-6659982126)已发送给小陈和小葛：小张接受版本/口令/初始化/迁移恢复方案，建议公共修订分配000001..000003；健康和七键给出具体赞成方案及阶段切换、离线TLS要求，由小葛提出公共修订，小张审并落实，不将单方反馈冒充公共冻结。镜像平台摘要/扫描、锁文件构建及真实数据库/HTTPS验收尚未运行。

## 本次实际检查

在干净只读复审工作树90374c1执行，Windows PowerShell、Node25.2.1、仓库锁定OpenSpec1.13.0：

| 命令/检查 | 实际结果 |
| --- | --- |
| node ../../node_modules/@fission-ai/openspec/bin/openspec.js validate 2026-11-04-identity-foundation --strict | valid，退出0 |
| node ../../node_modules/@fission-ai/openspec/bin/openspec.js validate --all --strict | 3 passed / 0 failed，退出0 |
| 人工对照00机器合同及7fa3946到90374c1差异 | 上述剩余问题，文档通过不代表实现可批准 |
| 身份/真实MySQL/HTTPS运行 | 未执行；尚无获准实现，不能复用骨架证据代替 |

核对版本最低Go声明的上游来源：[mysql驱动](https://raw.githubusercontent.com/go-sql-driver/mysql/v1.10.1/go.mod)、[crypto](https://raw.githubusercontent.com/golang/crypto/v0.58.0/go.mod)、[migrate](https://raw.githubusercontent.com/golang-migrate/migrate/v4.20.1/go.mod)，分别为1.24/1.26/1.25.11。仓库Go1.27满足声明，仅为静态对照。许可/算法来源及用途确认见上述逐项候选评论，不宣称已完成漏洞或分发审计。

下一步：小陈修剩余明确项，小葛提出公共修订，两条文档工作可并行。G2已成立；自身批准、公共冻结未满足，不apply；业务合并仍须G3。
