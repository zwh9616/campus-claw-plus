# 06 资料页面代表样板交接

样板PR：[#29](https://github.com/zwh9616/campus-claw-plus/pull/29)，交小张/zwh9616实际确认。

执行者：gjj6666（小葛），AI辅助。范围：OpenSpec任务1.1与1.2中的样板制作，MF-05 / MF-SC-10、MF-SC-11；不代表任务2.x或真实资料浏览器链路已验收。

## 准入与当前阶段

#27最终head `9df9704a8a69b6f808659318407aceb7c6f8244b`由gjj6666真实批准（review5857563184），其完整CI43004563696成功。用户明确同意后，使用正常合并接口绑定该head合入main `6ff6287869631b43d48d59487c16eec5c42403b0`，主干完整CI43027475479成功；[GitHub原件](main-27-integration-2026-11-11.json)包含实际账号、head、merge SHA及各检查步骤。任务1.1完成。

任务1.2必须由小张实际查看并确认，本交接保留未勾选。生产页面仍沿用已验收02：只有显式samples模式可以打开本次合成样板。未新增真实认证/资料请求、依赖、后端接口、配置键或数据库变更。

## 可审查的页面

从本分支根目录执行 `npm ci`、`npm run setup`，然后 `npm --prefix frontend run samples -- --port 5196`。

| 页面 | 本机URL | 核对重点 |
| --- | --- | --- |
| 教师列表 | http://127.0.0.1:5196/samples.html?page=materials&role=teacher | 标题/上传入口、显式搜索/清除、三种处理状态、分页 |
| 教师失败详情 | http://127.0.0.1:5196/samples.html?page=material-detail&role=teacher | 原文已保存但暂不可检索；下载、刷新状态、重新处理分组 |
| 学生列表 | http://127.0.0.1:5196/samples.html?page=materials&role=student | 仅可检索资料，没有上传或重新处理动作 |
| 学生详情 | http://127.0.0.1:5196/samples.html?page=material-detail&role=student | 转义正文、原文件下载入口，无教师处理区 |

在URL后添加 `&state=loading` / `&state=empty` / `&state=error` 检查对应状态；添加 `&long=1` 检查200码点标题、19位ID、256码点错误和非BMP长正文。详情空正文显示合同错误，列表空数据有师生各自说明。合成加载态固定展示，用于审查布局；最终10秒截止属于任务2.1。

搜索在样板内过滤合成数据，查询只留组件内存。上传、下载、刷新和重新处理只显示“未发送服务端请求”的说明；不伪装成功，不生成真实文件，不模拟持久化。工作台和账号按钮也仅说明入口，不跳入生产。列表链接保持选中资料的标题/ID/状态。样板中的角色参数只用于合成视图，生产权限须来自可信会话。

布局复用现有主题变量、200px导航、1120px正文和767/768断点。采用稳定导航与分隔线列表的组织方式，无新增UI库、字体、图片或装饰面板。窄屏改成单列，长文字允许完整换行。

## 验证与同版本证据

源码提交为 `164572b920dc3d4522d5d6b19f1581286f9706be`。Chromium141.0.7390.37、Playwright1.56.0，本机Windows；使用浏览器扩展tabs.setZoom/getZoom，未用CSS缩放或截图变形。截图执行时相关源码工作树干净（sourceDirty=false），86张截图/6组键盘检查全部通过，业务请求0、页面脚本错误0。逐图记录URL、角色、状态、视口、zoom、布局宽度和来源，源码文件逐项摘要见[完整清单](samples-164572b/manifest.json)。后续提交只补证据和进度，不改样板源码；如改布局须重截。

| 检查 | 实际结果/证据 |
| --- | --- |
| 360×800、1440×900；767/768断点 | 正常/加载/空/错误及师生差异、200码点标题、19位ID、256码点错误、非BMP与连续长正文均无横向溢出；[教师列表](samples-164572b/teacher-list-short-1440-zoom1.png)、[失败详情](samples-164572b/teacher-detail-short-1440-zoom1.png)、[学生窄屏](samples-164572b/student-list-short-360-zoom1.png) |
| 原生200% | getZoom=2、DPR=2，360/1440布局宽分别180/720；正文可纵向滚动，重新处理/下载可触达；[移动顶部](samples-164572b/teacher-list-normal-360-zoom2.png)、[详情底部动作](samples-164572b/teacher-detail-normal-360-zoom2-action.png) |
| 键盘 | Enter检索/导航/动作、空查询摘要焦点、结果h2焦点、Shift+Tab/Tab可见轮廓；空结果与失败区分，清除回第一页，查询不进路由 |
| 实际计算样式对比度 | 正文/按钮所测最小5.627:1；placeholder4.608:1；输入边界3.632:1；下载按钮外围焦点8.471:1。实际前景/背景与主按钮默认/悬停/按下/焦点/禁用记录在manifest，不以静态色板代替实测 |
| npm ci/setup/check/audit | 全0；check含Go vet/随机顺序测试、合同正反例、原认证11项、类型、构建、生产隔离和strict9/9；audit根/前端0漏洞 |
| 完整npm run gate | check/audit/secret-scan/verify四段全0；verify194635ms，原资料/身份/迁移/真实停库恢复和可信主机HTTPS回归通过；四个实际镜像HIGH=0/CRITICAL=0；[结果和来源说明](sample-gate-2026-11-11.json)、[原始JSON归档](sample-gate-2026-11-11.zip) |
| 受控红绿 | 仅向本分支dist/index.html追加样板标记，隔离检查真实退出1；finally原字节恢复后退出0，未改生产源码；[完整输出](isolation-red-green-164572b.json) |

完整gate首次因未缓存的Gitleaks下载120秒超时退出1，按原规则未运行verify；失败JSON与成功原件一并保存在ZIP。复用本机已有同版本Gitleaks8.30.1后，从头重跑全部入口成功，未调整超时/检查或扫描豁免。gate在文件定稿后开始，执行verify期间形成源码提交，运行输入未改变；浏览器截图在提交后的干净源码上单独执行。初次沙箱check的进程终止测试无法结束，已停止该测试进程；后续具备必要权限的完整门禁正常验证了超时/取消断言。Windows无GNU Make，未声称本机实跑Make，远端Linux检查仍保留。

容器检查是原有生产API回归，不是本次资料前端真实接线。当前样板尚无小张确认；任务1.2、2.x、3.x和真实双班五人资料前端验收继续待办。原02/04/10历史证据不改写。

复跑浏览器时，在本机准备外部Playwright1.56.0及其Chromium；它不写入应用依赖。例：`node reports/changes/06/sample-browser-check.mjs --playwright D:/campusclaw-mygroup/tmp/02-browser-tools/node_modules/playwright --origin http://127.0.0.1:5196 --output output/material-samples`，并将PLAYWRIGHT_BROWSERS_PATH设为本机已安装浏览器目录。截图原始PNG未缩放。

下一责任人：小张/zwh9616，在本PR查看两档、四态、长内容、键盘、200%和角色差异并记录实际确认；通过后由小葛继续2.1—2.5，最终真实联验另交小张。
