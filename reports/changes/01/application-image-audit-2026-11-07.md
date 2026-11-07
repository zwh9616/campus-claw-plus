# 01 应用制品镜像审计

小陈在MySQL修复后补扫现有前端基础镜像：原固定47928bf摘要实际退出1，1 CRITICAL（brotli-libs）及6 HIGH（curl/libcurl/libexpat）。全部命中、原始JSON压缩件及SHA见[旧扫描](nginx-base-old-scan-2026-11-07.json)。

实际查询官方同版本1.30.6-alpine，获取新固定583b7f2f摘要并远程实扫0，HIGH/CRITICAL均0；Nginx仍1.30.6，Alpine安全重建从3.24.3到3.24.4。见[更新基础扫描](nginx-base-updated-scan-2026-11-07.json)及[工具/范围记录](application-image-audit-preparation-2026-11-07.json)。这只是基础制品扫描，尚不冒称包含项目产物的最终前端镜像已通过。

本提交只替换Dockerfile基础摘要，不改页面源码/接口；本机与CI同一verify增加实际backend/admin/frontend构建、不可变image ID、逐个HIGH/CRITICAL扫描和应用识别断言。扫描不挂Docker socket，不传运行凭据，不忽略漏洞；结果仅归档公开扫描JSON，失败原码阻断并清理本次独占标签/缓存/临时tar。正常/失败/未覆盖样本加入IDF-SC-17测试。当前完整制品和运行回归待新head CI；独立终审/02浏览器未验证。
