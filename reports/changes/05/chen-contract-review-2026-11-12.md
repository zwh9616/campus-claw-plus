# 05机器合同：小陈审查与直接修复

2026-11-12，小陈 / Kevcco（AI辅助）。在原[PR #35](https://github.com/zwh9616/campus-claw-plus/pull/35)来源分支审查小张的 `f253ae7e91feda514f37e8e5988da39d4f9e54e2`，基线main `b4b13fde47bf39f2d478ff6a2721df23a04680d9`。G2/G3、01及#31规约批准已有真实记录；本轮不实施05业务。当前修复对应本提交工作树，正式review需绑定实际最终head。

## D9审定矩阵

| 项目 | 对照与结论 |
| --- | --- |
| 九个操作/单源Schema | 对照D1/D2和00 D2/D3；请求、两种具体Page、任务动作及封闭字段一致。逐对象比较原13个current操作与main完全相同；九个05操作仅frozen |
| 授权/原班级与本人链 | Bearer可信会话、动作角色优先、task→submission→assignment完整资源链、教师只读任务、学生本人写；跨班/他人/不存在同构404，声明反例覆盖 |
| 405及deadline | 405为空body并列实际Allow，沿用现有HTTP边界；创建deadline不晚于DB now是400输入错误，既有作业新提交逾期是409业务冲突，不另设错误体系 |
| 配额/Origin/请求字节 | 独立05 user_id桶12次/分钟、切班不重置；授权后已提交重放/异载荷冲突先于新配额；Origin若出现同源，JSON未知/重复键及整个64KiB上限与码点上限分列 |
| 幂等摘要/202快照 | 原202 pending快照授权后重放，scope与00 D5相同；保留期首期不自动删除；固定Go结构体字段顺序及默认HTML转义，实际重新生成5组向量并逐字段一致，换行/空白不归一化 |
| Task/三次耗尽 | 安全错误、取消/状态、版本、owner/epoch/未过期CAS声明一致；发现并修复pending/attempt3漏拒，详见下节，不改变00或已批准状态机 |
| 无生产执行器 | 生产不claim、不造成功/分数；测试二进制注入和未来真实数据库/worker/AI验收明确分列，未新增生产mock开关 |
| 迁移/运行边界 | 小张已确认000005候选号及五表；实际SQL/摘要尚未创建，manifest及运行目标仍4。升级/逐DDL失败/隔离恢复按D7留给apply，原Go/前端/Compose/镜像/配置/SQL无差异 |

公共入口曾把本次新增D9也写作#31已批准范围，已精确改为“#31批准D1—D8，D9随本PR审定”；没有扩写历史批准。编号预留不等于迁移available或真实部署。

## 发现、红绿及修复（AT-SC-13/14/15）

原Task单源Schema及validateTaskExample都接受pending/attempt3，但D5规定只有前两次可回pending，第三次失败或过期必须failed，手动retry也不能恢复已耗尽任务。

先新增pending/attempt2正常、pending/attempt3失败结构例和独立语义测试：原`npm run check:contracts`退出1，普通语义测试退出1，分别定位“错误接受该结构例”和“缺少预期异常”。然后仅补Task的pending最大attempt=2及语义断言；恢复同入口退出0，42 Schema、215结构正反例及30动态边界双路径通过，26组合同行为/语义测试全过。第三次running、succeeded、failed及cancelled仍保持正常。原件见[结构红](chen-contract-review/structural-red.txt)、[语义红](chen-contract-review/semantic-red.txt)、[合同绿](chen-contract-review/contracts-green.txt)；没有删除旧断言或放宽检查。

## 实际验证与限制

Windows，Node24.22.1/npm10.5.0/Go1.27.3；npm ci/setup均0。原f253ae7本机完整gate：check/audit/secret-scan均0，verify因Docker命令不可用退出1，后续容器程序未执行，见[原始门禁](chen-contract-review/baseline-gate-results.json)。这不是本机容器通过。5组真实Go向量及13个current对象逐项比对见[来源事实](chen-contract-review/source-facts.json)。

修复工作树再次执行原`npm run gate`：check0（19071ms，26组合同/前端28项/Go/strict10/10）、audit0、secret-scan0；verify1（701ms，缺Docker），见[修复后原始门禁](chen-contract-review/fixed-gate-results.json)。未修改门禁或将失败改为成功；提交前全历史及暂存内容秘密扫描0，foundation0、严格规约10/10和diff检查0。本次最终head真实CI结果按PR实际核对，不能把小张f253ae7的CI43199665270或上述本机前三段当作新head完整通过。

当前D9及机器合同内容无剩余审查阻断，正式批准/正常合入仍须最终head完整CI与有效保护，1.3在实际合入前保持待办。真实05数据库并发/租约/取消/迁移尚未实现，本轮合同例子不替代这些验收。下一步小张在公共冻结正常合入后推进2.x并交小陈独立终审；本轮未代其写业务或增加第三审批人。
