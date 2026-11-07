# 10 A终审复测

小葛 / gjj6666（AI 辅助），审查 #9 的 07c69f538e0a1fd360d75857adfb50b6bbfffb54，基线为受保护 main 3bf34de。

- 对照 D2/D3 及 DO-SC-03 至 10，统一入口保留原有 npm 检查与 identity-phase 检查，未增加业务入口。复核 #12 实际旧批准变为 DISMISSED，新提交 CI 成功且无冲突，仍为 REVIEW_REQUIRED/BLOCKED。#12 已关闭且未合并。
- 修复阻断项：5ee82a3 新增按三个摘要值全局豁免，超出 #16 已审的历史位置范围。用公开 SQL 摘要构造新的 api_key 字段，同一 Gitleaks 8.30.1 在上游默认规则下退出 1，PR 全局豁免配置下退出 0。恢复主干扫描入口，保留 #16 的两个历史指纹。
- 本机受控删除 Principal.role 的 student 枚举，npm run check:contracts 退出 1。原字节恢复后退出 0，文件无差异。npm run secret-scan 首次下载工具网络超时，使用 SHA-256 校验过的同版本归档解包后重跑通过，扫描 84 个提交。Windows 上 GNU Make 未执行，修复后的完整门禁以新提交的 CI 为准。
- 当前还需对修复后的提交核对完整 CI，随后才提交最终批准并按实际授权集成。3.1/3.2 保持待办，G3 等待主干集成复验。
