# 01候选实现审查与独立复测

2026-11-07，小陈（Kevcco，AI辅助）审查PR #14。基线c64e28f41512071ec8d1b148ff325e4689c30d17；本次直接在原PR分支修复、补测试和同步进度，不重建变更或代他人批准。审查覆盖身份/密码、HTTP边界、数据库事务与授权、迁移/恢复/初始化、配置与日志；生产接线仍是待办。

结论：候选核心代码的本次问题已修复，独立授权/撤销复测通过。当前PR仍不可合并；G3、部署接线/原子激活、镜像扫描和部署级终审尚未满足，不以测试HTTPS服务器代替生产Nginx或02浏览器联验。

## 已发现并修复

P2，IDF-SC-18 / runtime-plan R2：ReadIdentity原先接受`https://campus.test:`、端口0或65536，启动校验成功后仍无法按所配置的HTTPS入口正常运行。本次拒绝显式空端口及1..65535之外的端口；保留无显式端口、端口1/65535及带括号IPv6的合法输入。错误仍只含配置键名。

先加用例后运行`go test ./internal/config -run TestIDFConfiguration -count=1`，原代码[退出1](chen-review-origin-red.txt)并报告空端口被接受；修复后[退出0](chen-review-origin-green.txt)。此为实际红绿结果，不将原有用例通过当作新边界已覆盖；命令/版本摘要见[检查记录](chen-review-checks.json)。

## 独立重放与真实副作用

新增reviewer_test.go，使用专用第9号测试库，走真实MySQL适配器及可信测试HTTPS。fixture仅增加一个隔离测试库，不改变部署配置。身份来自真实登录，未用伪造Principal代替认证；完整比较users/classes/class_memberships/sessions/access_credentials/auth_audit行内容，敏感值只在内存比较，不打印。

| 场景 | 真实结果 |
| --- | --- |
| IDF-SC-09/10/11/20 | 匿名me为401；本人资源允许；学生教师动作403、同班另一学生/跨班/不存在资源为授权服务ErrNotFound、未知动作拒绝。资源业务路由尚未实现，不伪称已验证资源HTTP路由 |
| IDF-SC-13 | 有效同会话凭证但错误CSRF的logout为403，严格错误外层、fields=[]、details=null、无Cookie；上述拒绝后六张表所有值不变 |
| IDF-SC-06/17 | logout为204并清除相同安全属性Cookie；旧Bearer与刷新Cookie对应入口均401；同用户另一会话仍200。数据库revoked落盘，HTTP/日志/auth_audit的服务端request_id一致 |
| IDF-SC-08 | 内部Revoke后两个用户会话均已撤销，剩余旧Bearer/刷新入口401，其他用户me仍200；后续拒绝无持久化副作用 |
| IDF-SC-17 | HTTP日志未包含本次密码、访问/刷新凭证及CSRF；伪造请求标识未被采信 |
| 原有集成回归 | 全量verify:identity通过，含MySQL8.4.13、初始化重入/回滚、会话竞争、5秒预算、六个DDL断点与恢复、摘要/结构拦截 |

按campus-add-tests，在隔离测试源码中临时移除班级比较：原作者授权用例和本次独立用例均失败，verify:identity退出1。立即恢复原文件，再执行全量退出0；模型源码恢复后的SHA-256与本地一致，未提交破坏性改动。

本次Docker28.3.3 / Compose v2.39.1，锁定Node镜像实际v22.23.4、Go镜像实际1.27.3、MySQL实际8.4.13；MySQL镜像摘要见原始结果。源码包SHA-256为96bfae722e676c667a75c937dbb51547e89740441c34b899422d6d4f386342ba，同步后匹配；受测源码树570e2ba299d425c15386a7dec051a73b10b71b8a包含本次四份Go修改。后续只追加文档/证据，五份关键源码的本地/测试端字节摘要一致。测试自己创建的容器、网络、匿名卷和临时凭据均已清理。

完整原始结果：[首次通过](chen-review-integration.json)、[移除班级条件失败](chen-review-mutation-red.json)、[恢复通过](chen-review-restored-green.json)。执行人是本次小陈辅助会话，未冒称新的无历史会话或其他成员机器验证。

## 检查和交接边界

Windows Node24.22.1 / npm10.5.0 / Go1.27.3执行完整npm run check退出0（Go vet/test/build、合同检查、类型/构建、strict7/7），npm run audit退出0且根/前端0漏洞。npm run secret-scan全历史81个提交及本次暂存内容均退出0。真实数据库测试结果独立列在上表，不把普通go test未启用integration标签说成数据库通过；最终远端CI须按PR当前head重新执行。

#9已解冲突，最新5ee82a3的[完整CI42345489029](https://github.com/zwh9616/campus-claw-plus/actions/runs/42345489029)通过；仍待小葛最终审查、保护下合入及main集成复验。#12旧批准失效实验按用户要求继续待验证，本次未操作该PR。主干秘密扫描恢复另有小张#16，不能以本分支通过声称main已恢复。

下一步由小陈准备MySQL账号初始化/持久卷、可信证书/代理及配置接线输入，与小张完成同一最终受审版本的生产入口、active空样例、健康Schema/探针原子激活；补镜像扫描与02真实联验。整体终审、合并和归档均不勾选。
