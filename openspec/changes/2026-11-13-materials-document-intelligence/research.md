# A解析选型核对（2026-11-13，小张）

此页为候选依据，不代表依赖已加入、已扫描或运行已通过。

- [pypdf官方项目元数据](https://pypi.org/project/pypdf/)与[官方JSON](https://pypi.org/pypi/pypdf/json)：本轮核对7.0.1，BSD-3-Clause，Python>=3.10；能提取PDF文字。A1.2须再次锁定精确版本、轮子SHA、许可和漏洞结果，旧快照不替代最终制品扫描。
- [pypdf官方文字提取说明](https://pypdf.readthedocs.io/en/latest/user/extract-text.html)：扫描图片不等于可提取文字；复杂PDF内容流可能造成很高内存占用，坐标和复杂版式也存在局限。因此A不能承诺OCR/公式结构化；文件大小之外，必须有展开流、进程内存、时限和人工核对语料，不能直接在Go HTTP事务里调用解析。
- DOCX是受限ZIP/XML读取候选，优先不增加Office渲染或宏运行时；只读正文和表格内段落，逻辑块作为稳定出处，不伪造Word页码。安全结构/展开量/顺序和实际清晰集质量仍需A1.1/A2.2运行验证。

本轮不安装OCR/embedding依赖，不指定云模型或发送课程资料，不新增active配置/服务。B1.2/C1.2有明确选型、许可、质量、出站与预算冻结任务后再apply。

本轮已实际下载pypdf-7.0.1-py3-none-any.whl（416136字节），SHA-256为6131b764b046282357037309e7ef2a1b7679d4a5c53eed3db2bfbf7c673ddc2b，与官方JSON一致且CRC通过；BSD-3-Clause许可原文与依赖元数据保留。OSV公开包/版本查询本次返回无已知记录，此结果不替代生产镜像扫描；未安装或激活运行。见[元数据](../../../reports/changes/04E/dependency-research/pypdf-candidate.json)及[OSV原文](../../../reports/changes/04E/dependency-research/pypdf-osv-raw.json)，A1.2其余项仍待完成。
