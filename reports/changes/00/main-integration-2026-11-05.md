# 00合入main与集成复验记录

执行：小张授权AI辅助，2026-11-05。用户明确授权“能合并的你合并”。保留本地已有分支和工作区；未合并未批准的规约、未做业务apply、未修改保护规则。

## 实际合并

| PR | 批准与检查依据 | 合并结果 |
| --- | --- | --- |
| [#3 00规约](https://github.com/zwh9616/campus-claw-plus/pull/3) | 小张APPROVE 5765025797绑定221be733194830daa9b35f810c37f035679e51bb；CI 41794352975成功；无冲突 | main合并提交aac0a4a02821db528eb170f14e18835f21e02716 |
| [#5 00实现](https://github.com/zwh9616/campus-claw-plus/pull/5) | 小葛APPROVE 5782045346绑定75cadbf；此后至c6d4e93只有6个进度/审查文档变化，合同/代码/配置/测试/规则路径逐项diff为零；c6d4e93的CI 42030998035成功 | #3先入main后将#5目标改main；重新核对clean及head，带expected_head_sha正常合并，main提交4cfd61d8119c51bc3bf2870a17c9754f0975b3dc |

未使用管理员绕过。main当时protected=false、rulesets=[]，这是10尚待落实的G3工作，不把无保护状态当作允许跳过人工审查。00自身合并不被尚不存在的G3循环阻塞。合并后main内容与c6d4e93完全一致；集成SHA不同，验证记录另记。

## main上的远端集成复验

绑定提交 **4cfd61d8119c51bc3bf2870a17c9754f0975b3dc**，GitHub Actions [42033181713](https://github.com/zwh9616/campus-claw-plus/actions/runs/42033181713)，[check作业127264602356](https://github.com/zwh9616/campus-claw-plus/actions/runs/42033181713/job/127264602356)。实际状态completed/success。

逐项成功：npm ci、npm run setup、npm run check、npm run audit、npm run secret-scan、Verify real containers and process exit codes。最后一项由既有workflow实际执行npm run verify，验证健康JSON/请求标识、配置失败退出、前端HTTP、JSON日志及停机再启动。此记录来自实际main工作流状态，不把PR旧CI移作main结果，不声称本机或独立新会话通过。

## 本机隔离复验（先失败，重启后通过）

隔离工作区固定4cfd61d，开始时Git干净；Windows/Node v25.2.1。只复制本机被忽略的.env作本地准备，未输出配置值、未修改原文件，未提交凭据。

| 命令 | 实际结果 |
| --- | --- |
| npm ci | 退出0，安装96包，审计97包，0漏洞 |
| npm run setup | 退出0，前端安装29包，审计30包，0漏洞 |
| npm run check | 退出1；foundation、22 Schema/82结构正反例/6语义输入双路径、39示例/7操作、6组测试、前端类型及构建通过；backend因Docker Linux引擎管道不存在而失败，串联spec未执行 |
| npm run check:spec（独立补跑） | 退出0，00 change与project-bootstrap共2项通过 |
| npm run audit | 退出0，根与前端均0漏洞 |
| npm run secret-scan | 退出0，37 commits、约913869 bytes，无命中；暂存内容为空。执行时为干净集成版本，不冒称已扫描随后文档 |
| docker version（及显式路径复核） | 退出1，dockerDesktopLinuxEngine管道不存在；尝试只启动一次已安装Docker Desktop后仍不可用 |
| npm run verify | 本机未运行：Docker前置不满足。未把远端容器成功改写为本机成功 |

未重启Windows/WSL、未删Docker运行目录、未prune或停止其他项目。未执行页面视觉审查，因为00不改页面。未执行BC-SC-01，因为本会话有历史；未归档。

## 收口与仍需处理

00已获小葛终审、合入main 4cfd61d，main CI和本机完整check/verify均通过，G2按design D8已成立。下游apply仍须自身规约批准和对应依赖；业务实现合并仍须G3。BC-SC-01是归档前必补，未被错当成本次合并前置；当前未归档，G3仍未成立。

#6仍有小张5项返修；#7仍有小陈1项返修；#8尚无小葛批准，均未合并。为减少重复PR，本记录和最新00/02共享进度随现有#8交接；将main同步到#8时仅共享表发生add/add冲突，按main的00/01事实与#8自己的02行逐行整合，保留其他成员行。未把未批准02写成已实现。

## 用户重启Docker后的实际恢复

用户报告重启后，受限进程先得到管道权限拒绝；允许访问本机Docker后读取Server 29.8.0成功。这与此前管道不存在的症状不同，不据此声称已确认与上次AF_UNIX故障相同根因。固定原main提交4cfd61d、工作树干净，未修改任何断言/运行代码/锁文件，原样重跑：

- npm run check：退出0，foundation、合同6组、前端类型/构建、固定Go工具链vet/test/build、严格规约2项全部通过。
- npm run verify：退出0，15项实际容器/进程验收全部通过；健康200及空依赖JSON、服务端请求标识、7类配置拒绝、端口冲突、合法配置恢复、JSON日志关联、停机与重启均通过。
- 已清理campus-claw-plus-verify验收容器；没有prune、停止其他项目或清理默认网络。
- 原始脚本输出生成output/verification/local-results.json；提交副本为main-container-results-2026-11-05.json，移除实际配置端口值，保留SHA、时间和全部场景。静态前端HTTP不是新的浏览器视觉验收。

原环境失败按上表保留，后续通过不覆盖历史。此复验是小张本机执行，不是小葛机器或BC-SC-01新会话。
