# 同伴验收：只用 Docker 启动
适用当前实现PR #2。同伴只需Docker Desktop（Linux容器模式）和可获取代码的网络，不需要安装Node.js、npm、Go，也不需要手工生成dist。
获取代码可使用Git，也可从GitHub下载对应分支的源码ZIP；首次构建由Docker下载镜像和依赖。

## 1. 获取正确版本
当前main只有已合并规约，PR #2尚未合并。现阶段使用：
```powershell
git clone --single-branch --branch feat/2026-10-28-member-b-foundation https://github.com/zwh9616/campus-claw-plus.git
cd campus-claw-plus
```
PR #2合并后，可直接克隆main。验收时记录实际提交号，同伴和被验收者须核对同一版本。

## 2. 只做一次的本机配置
启动Docker Desktop，等待引擎可用。在仓库根目录：
```powershell
Copy-Item .env.example .env
```
用编辑器填写.env：
```dotenv
HTTP_PORT=18080
```
已有.env不要覆盖。18080须空闲；前端5173也须空闲。没有数据库、模型密钥、数据库初始化或其他手工文件。
缺失配置会明确失败，这是规约要求，不自动填隐藏默认值。

## 3. 一条命令构建并启动
```powershell
docker compose up --build -d --wait
```
前端的npm ci/build、后端的Go编译均发生在Docker镜像内部。仅启动系统时，不要再执行npm ci、npm run setup或本机go build。

## 4. 同伴检查与留证
```powershell
docker compose ps
curl.exe -i http://localhost:18080/health
docker compose logs --no-color --tail 10 backend
```
macOS/Linux把curl.exe换为curl即可。

应看到：
- 浏览器访问http://localhost:5173/，出现CampusClawPlus、Hello World、项目启动说明。
- backend状态healthy；仅running不算后端健康通过。
- /health为HTTP200，application/json，响应为{"status":"ok","dependencies":{}}。
- 响应头有X-Request-ID，Go请求日志为单行JSON，同一请求标识一致。
- 没有外部依赖时空对象表示未配置依赖，不能当成数据库或模型已健康。

这些localhost地址指同伴自己的电脑。同伴需要在自己的电脑执行上述命令，不能仅打开B电脑提供的localhost链接就算复现。

## 5. 停止与再次启动
```powershell
docker compose down --timeout 15
docker compose up -d --wait
```
停止后本项目两个地址不再提供响应，再启动恢复。命令只作用于本项目，不要停止其他项目来抢端口。

## 同伴填写的验收记录
保存到docs/lesson-07/，真实执行后填写，不由代码作者代签：
- 执行成员及GitHub账号：
- 执行日期/时间：
- 自己电脑的系统、Docker与Compose版本：
- 被验收提交号：
- 实际HTTP_PORT：
- 完整启动命令、退出结果、docker compose ps截图：
- 首页截图、健康状态码/JSON/请求标识、日志：
- 停止与再次启动结果：
- 问题、修正与复测：
此记录与已有CI/同一电脑全新目录验证不同，只有同伴自己实际运行后才能标记跨机器验收通过。
