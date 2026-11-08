# 01 默认HTTPS主机入口修复

小陈/Kevcco（AI辅助）核对#15最新75ec2fd，完整CI42449110803成功。小葛真实隔离联验发现默认frontend仅接internal代理网时主机发布端口拒绝连接，测试时只给frontend补bridge可达；该真实发现见[原始记录](https://github.com/zwh9616/campus-claw-plus/blob/75ec2fd0c4c202f08d891ee4a82dcde187cf56a4/reports/changes/02/real-browser-isolated-2026-11-07.md)。原verify只在容器网络内访问443，未覆盖实际主机发布端口，故旧CI绿色不能关闭此问题。

在原#18补最小修复：默认/隔离Compose仅frontend/gateway增加自管ingress bridge，继续只发布127.0.0.1 HTTPS；backend/MySQL/admin不加入入口网、不发布端口，proxy精确/32、data internal、可信TLS/Origin不变。不加公共配置键，不修改02页面或代其批准。结构依据[Docker官方前端桥接+内部后端网络示例](https://docs.docker.com/engine/network/)，由01两位负责人按原协作规则审定。

IDF-SC-17/18新增结构拒绝断言；原verify从实际Docker客户端主机连接分配的127.0.0.1端口，严格验证CA与DNS SAN、首页200、唯一健康200/mysql up、匿名me401及请求标识、错误CA/SAN拒绝；停止后连接拒绝，重建后重新发现端口再次验证。原容器内身份/授权/数据库恢复、四镜像扫描及统一门禁不删除。主机客户端不伪造Origin，不关闭证书校验、不修改系统信任。

本机受控删除frontend入口网附件后测试退出1，原字节恢复退出0；完整check及audit结果见[实际记录](host-ingress-local-2026-11-08.json)，[红](host-ingress-red-2026-11-08.txt)/[绿](host-ingress-green-2026-11-08.txt)分列。当前提交的真实容器/主机入口和四镜像CI尚待运行；独立Docker待临时授权，原Windows Docker Desktop及正常信任链的原生浏览器仍未复验，不写跨平台通过。

下一步：小陈核对当前head完整CI/独立Docker；小张审#18接线，小葛/小张将确认后的同SHA修复接入#15并亲自复跑原平台/正常证书链及多标签边界。#18原合入补证保留，01/02归档与整轮完成继续待办。
