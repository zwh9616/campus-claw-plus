# 10-B 第一批自测与交接

执行人：小陈（Kevcco，AI辅助），2026-11-12。基线main `1fa47ee2c3d486ba4fcfb615ee73ea22de0b05c7`，本提交工作树；分支`codex/10-b-service-batches`。原四份未跟踪文本保留；05规约PR #31、06实现PR #30独立推进，不在本分支修改。

## 当前真实执行

| 项目 | 结果 |
| --- | --- |
| 新批次检查/六组正常失败边界 | 本机Node24.22.1，退出0；合成报告仅用于校验器边界 |
| Go probe慢响应头/体与既有合同回归 | Go1.27.3，`go test -count=1 ./internal/probe`退出0，慢3.2秒响应被拒绝 |
| 初次工具调用 | 工作目录导致Go PATH拼错，Go/gofmt不可用，退出1；随后使用正确既有Go路径重跑通过，不以首次未运行当成功 |
| 锁定安装 | `npm ci`及`npm run setup`用Node24/npm10.5.0重跑均0；首次默认npm.cmd启动Node20出现engine警告，改用本机既有Node24 wrapper后复跑，无降低版本门槛 |
| 原完整gate前三段 | Node24.22.1/npm10.5.0/Go1.27.3，check0（strict9/9）、audit0（根及frontend零漏洞）、全历史143提交/暂存秘密扫描0；命令`npm run gate` |
| Docker完整gate | 本机无Docker命令；verify首子项ENOENT，完整gate退出1且后续容器程序未运行；既有测试环境SSH拒绝登录，未伪称本机容器通过，PR CI随后运行同一原gate |
| 关键条件红绿 | 临时将Compose探针3s改4s，原`npm run gate`在check退出1、后续未运行，逐字节恢复后批次检查0；将Go3秒改旧3.5秒，两个3.2秒慢头/慢体用例失败退出1，逐字节恢复后probe全包0 |
| 小葛独立终审、正常合入及main复验 | 未执行 |

## 原检查保留

原npm check各子项、四镜像实扫、默认Compose和真实MySQL/资料/恢复程序均保留。verify薄包装仅增加来源/时间/镜像一致性摘要，原程序任一失败停止且非零，旧报告不能替代。门禁600秒、CI20分钟、部署等待最大120秒、健康DB总预算3秒保持原约定；探针客户端和容器超时收紧至3秒。

测试覆盖DO-SC-11..13：服务/批准来源/配置消费者/网络/固定镜像漂移、3秒与3.001秒边界、原检查入口保留、旧/未来时间/缺失/失败报告、实际镜像不符与高危漏洞拒绝。真实验证另含静态首页不依赖DB、health503与恢复、凭据不入运行镜像元数据/前端和日志。

交小葛审本批4.1..4.3的最终head、自测原件与剩余列表；只在实际终审后填写批准，其他批次和C保持待验。

本机原始输出在忽略目录output/10-b-local-gate.log、10-b-probe-budget-red/green.log和10-b-slow-probe-red/green.log。首次Go PATH错误及默认Node20警告保留原输出，不将失败改写为成功。门禁JSON见[本机结果](local-gate-results.json)；它明确verify失败，不是Docker成功证据。
