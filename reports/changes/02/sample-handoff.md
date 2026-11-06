# 02登录及教师账号样板交接（AI辅助）

准入main13bc04f：G2、02/#8和视觉/#11及01公共冻结/#6均已合入。公共设计明确02 mock可先行；真实01 MySQL/HTTPS仍待接线。按openspec-apply-change只推进2.1/2.2，先样板、待小张确认后才扩展。

## 运行与边界

根目录npm ci、npm run setup；npm run samples --prefix frontend，打开http://127.0.0.1:5174/samples.html。账号样板加?page=account；state=normal/loading/error、long=1用于合成的19位ID与256字错误。不填真实账号密码。主应用生产首页仍为原骨架；样板仅显式samples模式可打开，生产dist不包含样板或模拟身份，不存在真实登录/切班/登出成功。

组件与样板复用集中北大红#94070A/暖白主题，登录单列表单、账号定义列表及切班/退出分区；借鉴既有视觉规约中的稳定导航和清晰分组，不生成课程/统计/假班级列表。没有新增应用依赖、远程字体或图片。测试用Playwright1.56.0（Apache-2.0）仅安装在本机临时工具目录，不进入应用依赖或运行镜像；浏览器脚本在apitest/ui/sample-proof.cjs，NODE_PATH指向该工具目录，BROWSER_PATH指定安装的Edge可执行文件。

## 证据判读

截图及manifest绑定实际样板源码提交，sourceDirty=false表示frontend/scripts/package.json与该提交一致；证据提交自身只增报告/状态，不将旧截图冒称新UI。实际样板/浏览器版本/URL/视口/fixture来源/颜色对比值在samples/manifest.json。

浏览器24个组合覆盖360/1440/767/768px，登录正常/错误、账号正常/加载/错误/256字错误、19位ID。实测无横向页面溢出、文字对比>=4.5:1、Tab/Enter错误焦点、切班打开收起焦点返回、非法ID、当前班不重复执行、密码清空及无API请求。未做真实认证、多标签页/迟到响应或服务端副作用验收；这些留3.x及4.2。原生浏览器200%缩放、控件边界/焦点对比>=3:1和全部交互态的最终人工验收仍由小张按2.3/3.5检查，未冒充完成。

隔离检查check:sample-isolation已纳入原npm check（build之后），检查普通dev入口404、显式测试模式200、生产输出无测试入口/夹具。临时关闭隔离条件检查退出1，逐字节恢复退出0。原检查未删除，完整本机check因Docker缺失失败；实际输出另存sample-local-checks.json，CI按当前head另查。没有将环境失败或mock截图当真实运行通过。

请小张实开同版本两档样板并按视觉规范第5节确认或修正，记录实际结论；2.3前不扩展工作台或真实认证接线。G3及业务合并/归档条件不提前通过。

正式交接PR #15：https://github.com/zwh9616/campus-claw-plus/pull/15 ，requested reviewer zwh9616。截图在14c15c6证据提交中，捕获的UI源码为fcdf726；本提交只补PR链接/交接，源码未改，原清单继续作为该源码证据，不冒称新UI通过。
