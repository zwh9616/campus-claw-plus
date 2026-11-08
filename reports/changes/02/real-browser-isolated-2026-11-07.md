# 02 同步生产身份与真实浏览器联验

执行人：小葛（AI辅助），2026-11-07。前端源码253cdf8、01主干c2c34a2、同步候选5f18e23。保留认证和样板隔离检查、新主干接线检查、四段verify及制品扫描上传。[同步候选完整CI](https://github.com/zwh9616/campus-claw-plus/actions/runs/42380871605/job/128428015012)成功。

本机 npm run verify:identity-wiring 初次因 Docker Hub 认证超时退出1。仅给验证命令使用本机代理后，生产镜像构建、真实MySQL/TLS、迁移初始化、登录及旧凭据失效、停库503与恢复、重建持久化、清理全部通过，退出0。服务端测试在容器网络内访问 HTTPS。

主机浏览器另验：保持默认前端网络时，Docker Desktop 的发布端口不可达，固定空闲端口18443也复现 ECONNREFUSED。在同一个隔离项目的 Compose override 中只给 frontend 增加普通 bridge（browser_ingress），backend 与 mysql 不加入该网络；代理内部固定地址及浏览器与API同源不变。该测试入口下 Node 使用临时CA验证 campus.test 的证书和主机名，Edge 仅对本次临时叶证书公钥做进程级匹配，未改系统信任。未拦截或替换网络请求。

Edge 实际登录双班五个临时账号，覆盖错误口令、角色显示、刷新恢复、教师切班、学生无切班入口、HttpOnly/Secure/SameSite=Strict Cookie、退出204及再次访问受保护页拒绝。通过记录见[浏览器结果](real-browser-isolated-2026-11-07.json)。临时项目、卷、网络和密钥均已清理。

4.2仍待使用默认主机入口及浏览器正常信任链复验，确认多标签竞争等其余边界并由两位负责人核对。默认入口的 Windows Docker Desktop 端口现象交01负责人复核，不在02中改生产网络。3.5完整视觉和4.1小张独立终审继续待办。
