# 02真实登录版本合入与main复验

小张（AI辅助）按已授权的审查者直接修复流程收口#15，没有代小葛/小陈批准，没有使用管理员绕过。

| 项目 | 实际结果 |
| --- | --- |
| 01依赖 | #14身份/数据库已合入c2c34a2；#18主机入口经小张批准5816839413及CI42452735458成功后正常合入0596505，main CI42453041413成功 |
| 02最终head | 90976b9a6ef8cef5fdb4f1559b64819dc39a2689；代码收口9ebf44b后的该提交只补同源码原生200%证据 |
| 最终head CI | [42455829549](https://github.com/zwh9616/campus-claw-plus/actions/runs/42455829549) completed/success；9ebf44b的42455299159也completed/success |
| 实际终审 | 小张/zwh9616的[review5816948613](https://github.com/zwh9616/campus-claw-plus/pull/15#pullrequestreview-5816948613)为APPROVED，绑定90976b9；是本人结论，不是另一成员批准 |
| 正常合入 | [PR #15](https://github.com/zwh9616/campus-claw-plus/pull/15)，使用expected_head_sha=90976b9及merge方法，GitHub返回merged=true |
| 实际main | 3ef79f40e184f75ab4b8d1435c9ea57af56014f5；git diff --quiet 90976b9 HEAD退出0，整个代码树完全一致，非仅比较前端目录 |
| main完整CI | [42456168251](https://github.com/zwh9616/campus-claw-plus/actions/runs/42456168251)completed/success，已实际回读同SHA结果 |

此前独立测试与真实浏览器见[最终复审](zhang-final-2026-11-08.md)：11项认证、48态mock与24截图、Windows默认入口正常CA/SAN信任下双班五人12项真实联验、四段完整本机gate、四个实际镜像0 HIGH/CRITICAL。另有小张在干净9ebf44b独立原生200%两档32态及截图，见[清单](zhang-native-200-2026-11-08/manifest.json)。相同运行与测试输入绑定至最终head，最终head再由完整CI验证；main代码树完全一致，主干完整CI也已通过。未用CI代替真实浏览器，未把mock当真实认证。

本次合入后记录仅更新真实进度、README、02 tasks和这些元数据，不改变运行代码、配置、镜像或门禁，不新开教学业务规约。按协作规范第4节第5条提交独立进度更新PR，正式请求小葛复核；自建进度PR不能由小张伪造其他成员批准。尚未取得实际审查或CI时不合并该进度PR。

API原件见[GitHub事实快照](main-integration-2026-11-08/github-facts.json)。4.1终审、4.2真实联验、4.3正常合入及main复验已完成；归档尚未执行，4.4继续待办。本轮未做版本回滚演练，容器重建和数据库恢复不冒充回滚成功。没有创建长期部署环境，不把隔离测试凭据当生产账号。本机原11个暂存证据逐个核对Git对象后完整保留在stash（本机位置不进公共记录）；此前被自动审批拒绝删除的失败测试目录仍在忽略路径，对应测试容器/数据库已销毁且临时令牌失效，未提交任何秘密。
