# 样板CI秘密扫描失败与精确误报处置

f96da699的CI run42244027314：check（含新隔离测试/Go/strict）及audit成功，secret-scan命中2项并退出1，容器verify正常未运行；首次失败保留，不冒称完整CI通过。本机先前只获取部分远端分支，扫描52提交无命中；取全部远端后扫描76提交复现同样2项。

只输出脱敏元数据：历史提交637986f46e826c04f9e57b8fda8650d5cccc852c的backend/internal/migrations/manifest.json第3/4行，规则generic-api-key。逐一解析该清单，六个64位十六进制值均与同提交backend/internal/migrations/sql/下对应SQL的SHA256重算一致；迁移代码verifyFiles也使用SHA256验证。因此两项为不可用作凭据的文件完整性摘要，不是密钥。

.gitleaksignore仅列两条完整指纹（历史commit+固定文件+固定规则+行号）。未允许整个目录、文件或generic-api-key规则，未缩小--all历史、暂存检查、依赖审计或远端保护；新提交/新行不能匹配这两个历史指纹。该精确非机密误报处置须由小张随PR审查，不用管理员绕过。

额外验证：生成仅用于扫描的随机合成api_key canary（不连接任何服务、不入Git、不输出原值），同一Gitleaks8.30.1在.gitleaksignore存在时仍退出1阻断，证明规则未整体关闭；临时canary报告仅在忽略的output/verification，不提交原值。随后重新扫描全部远端历史及暂存，结果按本提交交接记录，不沿用之前局部扫描。
