# 小张对01的第二天规约审查

日期：2026-11-05。执行：小张授权AI辅助；不是小陈终审或独立新会话。

- PR：[#6](https://github.com/zwh9616/campus-claw-plus/pull/6)，审查绑定 `7fa394662f92f70b843fe6f9671ee40d4b69df3f`。
- 结论：[REQUEST_CHANGES 5785063604](https://github.com/zwh9616/campus-claw-plus/pull/6#pullrequestreview-5785063604)。没有改小陈来源分支，没有批准apply。
- 对照：00规约 `221be73`、机器合同 `75cadbf`、main `2bf12e2`。读取四份规约、runtime-plan、公共合同请求与准备证据。

| 编号 | 发现与修订要求 | 复审判据 |
| --- | --- | --- |
| R1 | D4未完整定义无效Bearer与错误CSRF等组合失败顺序，与D1/00的401优先有歧义 | refresh与logout/switch分别列Cookie、Bearer、同会话、Origin、CSRF矩阵及零副作用断言 |
| R2 | D3只存CSRF摘要，未定义GET csrf重复/重载如何取得原值及并发行为 | 明确生成、保存或派生方式、稳定性与轮换；多标签页/GET竞争/旧CSRF有确定验收 |
| R3 | runtime-plan R2把数据库总预算超时写成503，而00认证合同规定超时504 | 明确不可用与超时区分、时间预算、状态码与副作用；改变00须原两人确认 |
| R4 | D7未明确限流组合key还是独立限额、窗口算法及容量满策略 | 可控时钟/并发/轮换用户名/容量边界有唯一预期，Retry-After可计算 |
| R5 | 配置/健康/迁移候选仍未确认，HTTPS接线写“10或01” | 决定、确认链接、责任change和前置明确；保留未决阻塞，不默许实现人猜 |

已有明确约束：刷新单赢家且旧刷新不撤销赢家；服务端即时撤销；双班五人、同班个人授权与不存在同构404；MySQL部分DDL dirty检查/前向修复；初始化唯一性、不覆盖口令、事务失败回滚。未把这些文字要求写成已运行通过。

实际文档验证：固定该SHA的隔离Git工作区，Windows、Node v25.2.1、仓库锁定OpenSpec 1.13.0。

```text
node ../../node_modules/@fission-ai/openspec/bin/openspec.js validate 2026-11-04-identity-foundation --strict
Change '2026-11-04-identity-foundation' is valid
退出码0
node ../../node_modules/@fission-ai/openspec/bin/openspec.js validate --all --strict
Totals: 2 passed, 0 failed (2 items)
退出码0
git diff --check HEAD
无输出，退出码0
```

本轮未运行身份代码、真实MySQL或HTTPS测试。小陈修订并逐项回复后由小张绑定新head复审。G2/G3仍未成立。
