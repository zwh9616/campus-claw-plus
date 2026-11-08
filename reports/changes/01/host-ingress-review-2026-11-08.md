# 01 默认HTTPS主机入口修复

小陈/Kevcco（AI辅助）核对#15最新75ec2fd，完整CI42449110803成功。小葛真实隔离联验发现默认frontend仅接internal代理网时主机发布端口拒绝连接，测试时只给frontend补bridge可达；该真实发现见[原始记录](https://github.com/zwh9616/campus-claw-plus/blob/75ec2fd0c4c202f08d891ee4a82dcde187cf56a4/reports/changes/02/real-browser-isolated-2026-11-07.md)。原verify只在容器网络内访问443，未覆盖实际主机发布端口，故旧CI绿色不能关闭此问题。

在原#18补最小修复：默认/隔离Compose仅frontend/gateway增加自管ingress bridge，继续只发布127.0.0.1 HTTPS；backend/MySQL/admin不加入入口网、不发布端口，proxy精确/32、data internal、可信TLS/Origin不变。不加公共配置键，不修改02页面或代其批准。结构依据[Docker官方前端桥接+内部后端网络示例](https://docs.docker.com/engine/network/)，由01两位负责人按原协作规则审定。

IDF-SC-17/18新增结构拒绝断言；原verify从实际Docker客户端主机连接分配的127.0.0.1端口，严格验证CA与DNS SAN、首页200、唯一健康200/mysql up、匿名me401及请求标识、错误CA/SAN拒绝；停止后连接拒绝，重建后重新发现端口再次验证。原容器内身份/授权/数据库恢复、四镜像扫描及统一门禁不删除。主机客户端不伪造Origin，不关闭证书校验、不修改系统信任。

本机受控删除frontend入口网附件后测试退出1，原字节恢复退出0；完整check及audit结果见[实际记录](host-ingress-local-2026-11-08.json)，[红](host-ingress-red-2026-11-08.txt)/[绿](host-ingress-green-2026-11-08.txt)分列。红色报告仅规范化行尾空白，失败内容/退出码保留。

修复head `cf89432fdbf2b4f1e8239037b5af09bced14defa` 的[完整CI42450173795](https://github.com/zwh9616/campus-claw-plus/actions/runs/42450173795)成功；真实Linux运行主机的发布端口与错误CA/SAN、默认容器回归/停机/重建均通过，四个实际镜像高危/严重全部0。实际镜像ID、扫描压缩原件及校验和见[CI证据](host-ingress-ci-2026-11-08.json)。

小陈另同步确切提交到独立Docker目录，npm ci/setup/make gate全部0，check/audit/secret-scan/verify全0，verify实际237434ms，未放宽10分钟门限。实际主机的首页200、健康200/mysql up、匿名me401、错误CA/SAN拒绝、停机后不可达及重建后重新发现端口复验均通过；原身份/迁移/恢复/持久化回归通过。见[独立版本/环境/输入绑定](host-ingress-independent-2026-11-08.json)、[gate](host-ingress-independent-gate-2026-11-08.json)及[接线原件](host-ingress-independent-wiring-2026-11-08.json)。CI和独立执行分列，后续证据收口与14项运行/检查输入逐字节一致；临时凭据/私钥/容器/网络及SSH授权均已清理，重连退出255，本地临时密钥删除。

当前结论：01入口修复已有真实主机端口实证，等待小张按最终head审查后正常合并。原Windows Docker Desktop及正常信任链的原生浏览器仍未由本次独立复验，不写跨平台通过，不用CA校验的Node客户端代替02浏览器验收。

下一步：小张审#18最终head接线与证据；小葛/小张将确认后的同SHA修复接入#15并亲自复跑原平台/正常证书链及多标签边界。#18原合入补证保留，01/02归档与整轮完成继续待办。
