## Purpose

为 CampusClaw 第7课提供可观察、可独立复现的工程启动合同，统一最小首页、公开健康接口、必需端口配置失败和前后端一键启停的验收依据，同时要求规约、规范、实现与协作证据可追溯，避免将后续教学业务规划误报为本课成果。

## ADDED Requirements

### Requirement: PB-01 最小首页明确本课范围

系统 SHALL 在首页显示 CampusClaw、Hello World 和项目启动阶段说明；MUST NOT 提供暗示已完成的登录、问答、作业或批改业务入口。

#### Scenario: SC-01 页面成功
- **WHEN** 前端依文档启动且用户访问配置的首页地址
- **THEN** 返回可阅读页面，能看到 CampusClaw、Hello World 与骨架阶段说明，且无伪装可用的业务入口

### Requirement: PB-02 公开且独立的健康响应

后端 SHALL 对 GET /health 返回 HTTP 200、媒体类型 application/json 和语义等于 {"status":"ok"} 的 JSON 对象；MUST 无需鉴权、数据库、模型或外部密钥即可响应。

#### Scenario: SC-02 健康成功
- **WHEN** HTTP_PORT 为有效空闲端口且后端已监听，客户端不带认证请求 GET /health
- **THEN** 返回200，Content-Type媒体类型为application/json，响应可解析为唯一字段status值ok的对象

#### Scenario: SC-03 不依赖外部服务
- **WHEN** 未配置数据库、模型、向量库及其凭据，仅设置有效HTTP_PORT后启动后端并请求 /health
- **THEN** 服务能够启动且取得SC-02相同的成功响应，不进行外部服务健康请求

### Requirement: PB-03 端口配置失败明确可观察

后端 MUST 从环境读取必需HTTP_PORT，去除首尾空白后只接受1..65535的十进制数字；缺失、空白或非法时 SHALL 指出HTTP_PORT配置问题并非零退出，不静默使用默认端口。监听失败 SHALL 非零退出并提供脱敏原因。

#### Scenario: SC-04 缺少或空端口
- **WHEN** 分别在HTTP_PORT未设置、空字符串或全空白的环境中启动后端
- **THEN** 每次均非零退出，错误包含HTTP_PORT与缺失/无效原因，且未提供健康成功响应

#### Scenario: SC-05 非法端口
- **WHEN** 分别用HTTP_PORT=abc、0、-1、65536启动后端
- **THEN** 每次均非零退出并指出HTTP_PORT格式或范围错误，不静默回退到8080

#### Scenario: SC-06 端口合法与恢复
- **WHEN** 配置为可用端口（例如8080，或带首尾空白的8080）并启动后端
- **THEN** 监听约定的地址与端口并取得SC-02响应；记录此前配置错误修正后的复测结果

#### Scenario: SC-07 端口占用
- **WHEN** 所配端口已被其他进程占用且再次启动后端
- **THEN** 新进程非零退出并说明监听失败，原服务的响应不得作为新进程启动成功的证据

### Requirement: PB-04 一键部署可启动可停止

项目 SHALL 提供前后端源码构建、无敏感值配置示例和一套文档化Compose启停命令。后端 SHALL 配置可运行的健康检查；首页与健康接口 MUST 在新获取代码目录中复现，不依赖个人手工文件或外部业务服务。

#### Scenario: SC-08 干净目录集成成功
- **WHEN** 另一成员在独立目录获取同一提交，按README复制配置示例并执行一套Compose构建启动命令
- **THEN** 前后端镜像构建成功，后端容器达到healthy，首页满足SC-01，健康接口满足SC-02，记录实际服务名和端口

#### Scenario: SC-09 Compose缺少必需配置
- **WHEN** 没有其他环境来源提供HTTP_PORT且未准备必需配置就执行文档中的启动命令
- **THEN** 配置检查或服务启动明确失败，不能报告后端healthy或整体启动成功

#### Scenario: SC-10 停止与再次启动
- **WHEN** 对已启动项目执行文档停止命令，随后按相同配置再次启动
- **THEN** 停止后本项目容器不再运行且不再提供本项目响应，再启动可重新满足SC-08

### Requirement: PB-05 工程规范与文档一致

仓库 SHALL 提供产品、后端、安全、测试、部署五类规范；每类 SHALL 包含可执行规则、简单示例与检查办法。AGENTS与README SHALL 关联规约及规范、角色职责、目录、配置、前端开发/构建、后端测试和完整部署路径；配置示例及日志 MUST 不含真实密钥，版本库 MUST 排除.env、依赖与构建产物。

#### Scenario: SC-11 规范检查
- **WHEN** A/C依本课范围评审B的五类规范、AGENTS和README
- **THEN** 每类有规则/示例/检查入口，页面与接口、端口、配置失败和部署命令均与本规约及同一实现版本一致

#### Scenario: SC-12 配置及提交检查
- **WHEN** 成员按README准备本地.env并检查待提交文件和配置示例
- **THEN** .env及依赖/构建产物不进入提交，.env.example可提交且仅含示例值，日志和截图不泄露真实凭据

### Requirement: PB-06 评审与验收状态可追溯

团队 MUST 将需求、场景、任务、PR与证据关联；四份OpenSpec产物 SHALL 通过所用版本工具的严格校验。PR SHALL 至少经一位其他成员实质评审后合并；公共约定由相关负责人核对。仅实际执行并有证据的任务 SHALL 标为完成；最终验收标签 MUST 对应全组已验收提交。

#### Scenario: SC-13 规约严格校验
- **WHEN** A在团队仓库对project-bootstrap执行OpenSpec严格校验
- **THEN** proposal/design/specs/tasks齐全且校验通过，记录版本、命令、退出码、结果和修正情况，不能据此标记实现验收通过

#### Scenario: SC-14 评审与交接
- **WHEN** A从docs/openspec提交PR并交由B/C评审
- **THEN** PR说明关联任务、验证结果及交接约定；保留他人实际评审记录和未决问题，未评审时不得宣称已批准或已合并

#### Scenario: SC-15 联合验收与版本
- **WHEN** C提供运行证据、B独立复现且A逐项核对全部必验场景
- **THEN** 每项记录执行人/时间、提交号、环境、前置条件、命令、预期/实际、证据位置和结果；失败项保留责任人及复测，只有全部必验项通过后才能由C标记最终版本
