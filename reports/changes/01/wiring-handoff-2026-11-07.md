# 01 接线子包验证与交接

执行：小陈 / Kevcco，2026-11-07。原PR #14、原分支`codex/01-identity-implementation`，基线`e814590442b26daf3894b4a4eeaa49132b4233fd`，同步main `3bf34de`后继续。此记录属于候选子包交接，**不是生产原子激活、01整体终审或02浏览器验收**。

## 交付和边界

子包入口：[使用步骤](../../../deploy/identity/README.md)、[Compose](../../../deploy/identity/compose.yaml)、[输入登记](../../../deploy/identity/inputs.json)。提供固定摘要MySQL、命名数据卷、只读TLS输入及0400容器私钥、独立离线迁移/初始化镜像、同源Nginx HTTPS和精确代理/32；MySQL/后端不发布主机端口，仅HTTPS绑定环回。离线工具读取迁移DSN，测试服务只有DML DSN，不自动DDL。

五个Compose输入是现有01 R7候选，交小张确认，不直接追加公共active/frozen规则。`preview`是显式profile下的隔离Go测试装配；默认`compose.yaml`、生产`cmd/server`、原探针、当前健康Schema与`.env.example`未改变。网关将API错误交给Go的64KiB严格读取器，关闭请求缓存并流式转发，避免代理把冻结JSON 413变成HTML；同源HTTPS下实际验证该边界。

## 真实验证

| 范围 | 环境 / 命令 | 实际结果 |
| --- | --- | --- |
| 安装及完整静态/Go门禁 | Windows，Node24.22.1、npm10.5.0、Go1.27.3；`npm ci`、`npm run setup`、`npm run check` | 全部退出0；合同、输入边界、类型、构建、Go vet/test、OpenSpec严格7/7通过 |
| npm审计 | `npm run audit` | 根与前端均0漏洞，退出0 |
| 代理关键断言红绿 | 临时把可信`$remote_addr`改成客户端`$http_x_real_ip`，运行wiring测试，恢复原字节重跑 | 红退出1，恢复绿退出0；没有保留破坏 |
| 完整真实容器回归 | Docker28.3.3、Compose2.39.1、Node22.23.4、同摘要npm10.9.9；`npm run verify` | 退出0；原骨架15项、原身份真实MySQL/TLS/迁移/授权回归、新接线验证器依次执行，原检查未替换 |
| MySQL/TLS/迁移/初始化 | MySQL8.4.13、Go1.27.3固定镜像；`admin migrate/check/initialize` | 空卷迁移及摘要/结构检查通过；同一初始化用不同口令重跑成功，但原账号仍以原口令登录；缺CA退出2，合法但错误的信任证书退出1 |
| HTTPS与身份 | 同摘要Nginx1.30.6，客户端信任临时测试CA并校验SAN，不使用跳过TLS验证 | 同源静态页与真实登录200、me200、CSRF恢复、logout204、旧access401；安全Cookie属性、随机服务端标识及JSON日志关联通过；客户端不信任CA/错误主机名均拒绝；超64KiB返回JSON 413 |
| 依赖故障及持久化 | 实际停MySQL，再启动；随后Compose down不删卷、重建全部容器 | 停库健康503/mysql down、登录503且不发Cookie；恢复200；重建后迁移状态正确、原账号/班级指纹和原口令不变 |
| 清理及秘密 | 每次随机独占Compose项目、网络与卷；日志排除本次全部随机口令/访问/刷新/CSRF凭证 | 测试资源及私钥目录清理通过；没有停止无关服务，未提交运行配置/密钥。全历史及暂存扫描在提交前执行，结果另见同目录扫描输出 |

原始输出位于[同目录wiring证据](wiring/)：`check.txt`、`audit.txt`、`proxy-red.txt`、`proxy-green.txt`、`verify.txt`、`skeleton-results.json`、`identity-results.json`、`wiring-results.json`。源码使用只含已跟踪/暂存内容的归档同步，保留本地四个未跟踪日志；未复制本机配置或Git目录。Docker侧没有Git元数据，原骨架JSON的commit因此为空，不能冒充已验证提交号；[源码指纹](wiring/source-manifest.json)的13个可执行输入已逐个在Docker侧重算匹配。最终PR CI再绑定实际提交head。

健康预算断言是应用3秒加客户端传输余量500ms；实际Go Ping耗时在JSON日志duration_ms中。测试临时CA/随机账号仅用于隔离验证，未安装系统信任，也不提供生产默认证书或口令。这里不宣称已验证生产证书、浏览器交互、备份恢复或整库数据不变。

## 保留的失败

[五次开发失败](wiring/development-failures.json)均退出1：自动分配子网不支持固定IP；低位固定地址与动态peer冲突；容器/调用者UID不同导致覆盖测试CA失败；覆盖entrypoint后未显式给Nginx command、进程正常退出；测试凭据排除文件权限导致调用者读取失败。分别改为显式空闲子网/末端地址、替换公共测试CA文件、显式前台启动和0700临时目录下可读测试证明文件，再完整verify通过。没有把这些失败改为通过，未放宽生产TLS/文件挂载或授权规则。

## 小张接手与未完成项

请小张先确认R7五个输入及本机文件/权限/持久卷/代理选择，按deploy/identity/README复跑离线迁移、初始化和候选启动；生产证书、数据库账号/口令由持有人本机提供，不发送原值。此包推送后交出明确head和#14修改窗口，小陈不并发改公共入口。

小张在同一#14分支完成生产Go装配、默认Compose及七键active/空样例、唯一健康合同/探针/Schema、规范/README/全部阶段用例的一次原子激活；隔离阶段断言也要同步为新的唯一状态，不能直接删掉安全断言。随后小陈对最终head复跑真实数据库、迁移恢复、越权与失效，再终审。

G3仍等小葛终审#9 `07c69f5`（完整CI42353710353成功）、正常合入和main复验。镜像漏洞扫描、生产接线验收、02真实浏览器联验及最终集成main仍未验证，本次不勾01整体完成、不合并业务PR、不归档。#12旧批准失效已真实完成并关闭未合并，其证据已交#9，不再是待验证项。

## 远端提交确认

接线源码提交 c87d29eb469716e27fd93b58a85f871b136549a0 已正常推送原#14分支，同head[完整CI42355754646](https://github.com/zwh9616/campus-claw-plus/actions/runs/42355754646)为success（包含新旧全部真实verify）。本次后续提交仅同步该结果，不改变可执行输入；原始源码指纹继续对应已测代码。最终交接SHA在PR评论绑定，随后修改窗口交小张。没有给予01整体批准，也未绕过G3。
