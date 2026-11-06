# 01公共冻结与审查收口（小张，2026-11-06）

来源：小陈PR #6 head72fe59b；整合main14760f5。用户明确要求完成小张工作、测试、同步共享表、提交合并；按2026-11-05审查者直接修复规则扩展原PR，不冒称小葛批准。本次仅公共合同与规约/检查，无身份业务实现。

## 关闭R5的具体改动

- 新增identity-public-contracts四份规约；健康在01引入真实MySQL的同一受审实现提交原子切换，当前骨架不变。
- IdentityHealthUp/Down单源与OpenAPI未来扩展，3秒真实Ping，200/503精确载荷；当前Health拒绝mysql字段。
- 七键进入frozen，使用者、机密、超时/TLS/代理约束齐全，active/sample仍仅HTTP_PORT。
- 000001..000003已保留，未编造SQL摘要或执行；明确dirty/部分DDL/初始化回滚的真实实施交付要求。
- 01四份规约及runtime-plan同步去除已解决待定项，保留历史请求/审查证据。后续接线输入须先登记，真实验收仍未运行。

## 验证

机器记录见[public-freeze-checks.json](public-freeze-checks.json)。ICF-SC-01..05为本轮合同检查；ICF-SC-06的真实DDL恢复仍由01负责。此前已接受的IDF-SC-01..20没有运行实现，不计通过。

| 检查 | 实际结果 |
| --- | --- |
| npm ci / setup | 退出0，按锁安装，无业务依赖新增 |
| check:contracts | 退出0；24 schemas，99正反例+6语义输入，41接口示例；9组测试通过 |
| 受控破坏 | IdentityHealthUp.mysql const从up改down，未改用例/检查器；退出1；finally逐字节恢复，重跑退出0，摘要见JSON |
| typecheck / build | 退出0 |
| check:spec | strict7/7，退出0 |
| audit | 曾返回根/前端0漏洞退出0；记录复跑遇registry TLS断连退出1，待恢复复跑，不把断网当无漏洞 |
| secret-scan | 全历史58 commits及暂存扫描退出0，无命中；最终提交后再核当前范围 |
| 完整check / verify | check在Docker管道不存在处退出1；verify也实际执行退出1，仅SC-09缺配置断言通过，容器启动/清理均受引擎不可达阻塞，不能冒称15项通过；日志确认sailor-ingest.sock占用 |

## 保护与同伴交接

main保护已实际启用，见[API回读](../10/A/main-protection-applied-2026-11-06.json)。#9 76d3d76的CI42199747856成功，保护后API状态blocked。仅此不证明所有失败状态及旧批准失效均通过实验；小陈补受控证据，小葛终审/正常合并/集成。G3保持未成立，不代其批准或合并#9。

02原规约和北大红已入main；本PR冻结合入后小葛可做登录/账号样板和mock，小张实开确认。01实际实现由小张继续，小陈先交DB/TLS接线输入与真实环境子包。详见[共享表](../../../docs/project-status.md)。最终head、CI、批准、合并与集成复验以随后真实结果追加，不预填。

2026-11-06环境恢复尝试：Docker CLI正常启动/重启超时，核对安装目录后结束残留Desktop宿主进程再启动仍出现相同ingest占用；未重置Docker、未删镜像/卷/业务数据。已请用户在方便时重启Windows，保留本机失败阻断。#9管理员进展已实际交接[评论6682703513](https://github.com/zwh9616/campus-claw-plus/pull/9#issuecomment-6682703513)。

## 推送与远端结果

已推送7d099c9、f50dc87807eb442e8a3a7229add08431217955ff到原PR #6。该head的[CI42203445671](https://github.com/zwh9616/campus-claw-plus/actions/runs/42203445671)状态Success、用时1m30s；工作流未跳过check/audit/secret-scan/真实容器verify。小张已提交[绑定该head的COMMENT复审5799022319](https://github.com/zwh9616/campus-claw-plus/pull/6#pullrequestreview-5799022319)，公共R5内容收口，但未将本机故障写成通过，尚未APPROVE或合并。API确认#6 open、mergeable=true、mergeable_state=blocked，main14760f5。后续台账/报告补证提交仍需其最新head检查；运行合同/测试内容相对f50dc87不变。

## Docker再次启动失败后的排障

2026-11-06约18:55，小张按用户错误报告检查：Linux引擎管道不存在；运行目录中可枚举的项目均为零字节AF_UNIX残留，多个文件反复追加`.stale`。参考[Docker项目中的同类报告](https://github.com/docker/desktop-feedback/issues/692)，这些用户报告可作排障线索，不能保证本机采用相同步骤必定修好。

正常stop超时后，仅结束已核对安装路径的Docker Desktop宿主进程；核对`%LOCALAPPDATA%/Docker/run`为普通目录、没有非零文件/子目录，将其同父目录改名为`run-socket-backup-20261106-185516`，完整保留。没有删除或重置镜像、容器卷、VHDX，没有执行WSL注销或全局关闭WSL。

重新创建run并启动后仍失败：日志转为mkdir目录已存在/监听路径不存在；PowerShell/.NET创建目录返回对象，随后Get-Item/Directory.Exists却找不到它。另一个空诊断目录`run-fresh-check-20261106`同样不可访问，未据此声称根因已确定。所有Docker进程随后已退出；Windows最后启动时间为当天13:52，已建议用户保存工作后执行Windows重启，再恢复本机check/audit/verify。未擅自重启Windows，未把启动命令返回0当成引擎恢复。

此前b43ac50的[完整CI42205319922](https://github.com/zwh9616/campus-claw-plus/actions/runs/42205319922)已成功，[绑定head复审5799054323](https://github.com/zwh9616/campus-claw-plus/pull/6#pullrequestreview-5799054323)为COMMENT。此轮仅追加真实环境记录，不改变规约/代码，不新增apply或批准，合并仍阻断。

## Docker恢复后的验收与批准（覆盖前述环境阻塞）

用户告知重启后，实际docker version返回Server29.8.0；不根据口头重启推断Windows启动时间变化。对干净4c0ad233a0db9a7e9ce085f0c8b82a260e407305运行npm ci/setup/check全部退出0（含Go vet/test/build、合同9组、strict7/7）。秘密扫描全历史66 commits和暂存通过；本机verify15项通过，证据见[检查记录](recovery-checks.json)和[容器结果](recovery-container-results.json)。

Windows原生npm run audit及指定系统代理的尝试均遇registry.npmjs.org TLS断连；首次本机Node容器审计根项目成功、前端遇相同网络错误。未改变包、审计阈值、源或证书校验，使用仓库scripts/toolchain.json锁定的官方Node镜像在本机只读挂载同一工作树，重新执行完整npm run audit，最终根/前端均0漏洞且退出0（Node22.23.4/npm10.9.9）。这是本机容器执行，不冒称Windows原生命令成功。所有失败保留，恢复后通过才解除阻塞。

4c0ad23的[完整CI42206882978](https://github.com/zwh9616/campus-claw-plus/actions/runs/42206882978)成功；小张[实际APPROVE5799304472](https://github.com/zwh9616/campus-claw-plus/pull/6#pullrequestreview-5799304472)绑定该head，R5线程PRRT_kwDOVZ83gM60EZEU已真实resolved。本次仅补证据/台账/tasks，推送后仍须当前head CI及重新批准才能正常合并，不预填合并SHA；实际合并与main复验记录在原PR交接评论，不以规约通过冒充身份实现完成。

小陈#9已推进到e88ed53，missing/pending/failure/cancelled有受保护状态证据，旧批准实验尚待执行。小张已审查#12恢复head01384fa（相对76d3d76只有两份实验文档，运行代码/Schema/工作流恢复原字节，CI42205527375成功），[实际批准5799296188](https://github.com/zwh9616/campus-claw-plus/pull/12#pullrequestreview-5799296188)仅用于DO-SC-07实验输入；#12禁止合并，不代小葛对#9终审，不宣称G3。
