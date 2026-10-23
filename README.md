# CampusPulse AI

**让每一次校园决策，都有可追溯的数据依据。**

CampusPulse AI 是面向高校学生、社团与管理人员的双语数据分析平台。将 CSV、Excel、活动海报与截图导入团队空间，由 AI Agent 调用分析工具、关联图片证据、提出行动建议，并生成可编辑、可导出的报告。

## 产品能力

| 能力 | 功能 |
| --- | --- |
| 数据空间 | 表格与图片导入、原文件私有存储、字段字典、缺失值检查、重复行清洗、数据预览与下载 |
| 多模态摄取 | 视觉模型 OCR；不支持图片的模型使用中英文 OCR 引擎识别，再由 AI 提取结构化字段 |
| AI Agent | 检查数据、字段画像、查询、聚合、异常检测、图表建议、知识检索、行动计划与报告工具 |
| 图表画布 | AI推荐可一键或批量导入的柱状图、折线图与饼图，Markdown推荐说明；实际数据聚合、云端保存、新增删除、PNG 导出 |
| 报告中心 | 基于当前数据生成中英文报告，编辑与历史版本，Markdown / DOCX 下载，打印为 PDF |
| 团队协作 | 个人与社团空间、成员邀请链接、角色权限、空间切换、管理员审计与安全策略 |
| 全站配置中心 | 系统管理员配置网站、登录注册、SMTP、短信网关、AI模型及导入限制；管理全站用户、会话与所有空间 |
| 行动闭环 | 将 AI 建议转为行动任务，在工作台跟踪完成情况 |
| 账号安全 | 邮箱验证码注册/找回密码，手机号注册/登录与绑定接口，Microsoft Authenticator兼容2FA和一次性恢复码 |
| 人机验证 | 腾讯普通验证保护验证码发送，无感风险验证保护注册/登录/找回密码；服务端票据校验与一次性登录许可 |
| 账户与偏好 | 中英文界面、主题与减少动效；个人与社团空间权限隔离 |

生产环境使用真实数据库与私有文件存储。统计从当前工作空间计算，AI 使用该空间有权限访问的数据集；不会将固定演示值当作业务分析结果。模型不可用时显示失败或明确说明本地字段画像，避免伪造 OCR、工具调用和分析结论。

## 工作流程

1. 注册并登录，使用个人空间或创建社团空间。
2. 导入 CSV / Excel / 图片，查看字段质量、OCR 证据和原文件。
3. 选择数据集并提出问题，复核 Agent 实际工具调用与证据。
4. 创建图表、保存行动任务，生成和编辑报告。
5. 邀请团队成员，分配权限，查看审计记录并导出交付物。

## 技术栈

- **前端**：Next.js App Router、React、TypeScript、Tailwind CSS、Apache ECharts、Animate.css
- **账户**：NextAuth、bcrypt、SMTP验证码、短信网关、RFC6238 TOTP、AES-256-GCM加密配置
- **业务持久化**：PostgreSQL、Prisma、S3 兼容私有对象存储
- **AI**：OpenAI-compatible Chat Completions、结构化工具调用、知识检索与 OCR
- **验证**：Vitest、Playwright、TypeScript、ESLint

## 本地开发

需要 Node.js 22+、PostgreSQL、S3 兼容存储；如模型不支持图片，还需要安装 Tesseract 和 `chi_sim`、`eng` 语言包。

```bash
npm ci
cp .env.example .env
# 填写数据库、存储、认证及 Carbon AI 配置
npm run db:generate
npx prisma migrate deploy
npm run dev
```

访问 `http://localhost:3000`。默认使用公开首页；业务路由和 API 要求登录。生产环境应关闭 `DEMO_AUTH_ENABLED`。

### AI 配置

```dotenv
CARBON_AI_API_KEY=your-provider-key
CARBON_AI_BASE_URL=https://your-provider.example/v1
CARBON_AI_MODEL=your-chat-model
```

模型应支持结构化输出与工具调用。系统管理员可在后台更换API地址、分析模型、视觉模型、密钥和超时，配置即时生效；视觉模型不可用时由OCR引擎识别文字后交给AI抽取字段。密钥仅在服务端读取。

### 验证码与2FA

配置SMTP后启用邮箱验证码，用户可在个人设置中绑定Microsoft Authenticator。手机服务支持阿里云号码认证（云端发送与核验）、互亿无线模板短信及标准HTTPS短信网关，提供手机注册/登录及邮箱账号绑定手机号；管理员可配置并测试真实发送，未配置时明确不可用。详情见[账号认证与系统配置](docs/authentication.md)。GitHub 授权登录由系统管理员在后台填写 OAuth App 凭据后开启，用户可在设置页关联或解绑；已启用2FA的账号不支持 GitHub 登录，避免绕过第二步验证。

登录先校验主凭据，已开启2FA时才弹出认证码/恢复码窗口。腾讯普通验证与无感验证分别接入发送和身份操作，详见[腾讯人机验证](docs/tencent-captcha.md)。

账号安全操作使用独立窗口，可选择已绑定的邮箱、手机号、Authenticator或恢复码验证。更新密码先确认身份，再在新窗口输入并确认新密码；最终提交再次要求腾讯无感验证。验证码发送、身份确认和设备绑定均由服务端校验，安全变更撤销旧会话。

## 生产部署

支持 Docker Compose，或在现有 Nginx / 宝塔服务器上通过 systemd 运行。正式环境需要 HTTPS、独立数据库密码、私有存储凭据、随机会话密钥、数据库迁移与备份。

- 原文件经登录校验后由应用读取，存储端口不直接对公网开放。
- 工作空间和资源权限由服务端校验，管理员操作记录审计。
- 不在 README、代码或 Git 历史中存放 API 密钥、SSH 私钥、证书私钥和生产密码。
- 具体安装、维护与恢复方式见 [部署指南](docs/deployment.md) 和 [Nginx / 宝塔配置](docs/nginx-baota.md)。

## 验证

```bash
npm run typecheck -- --incremental false
npm run lint
npm test
npm run build
npm run test:e2e
```

开发演示页与生产业务页隔离；演示模式仅用于测试。生产验收应验证真实注册、空间隔离、文件保存、模型工具调用、图表和报告刷新后恢复，以及成员权限限制。

项目提供可重新生成的原创CSV/Excel、OCR图片、重复/缺失/异常及拒绝导入素材，见[测试指南](docs/testing-guide.md)。测试数据与真实业务资料应分开使用。

## 团队

郑宇豪 · 尤一龙 · 高超  
指导教师：冯玉雷 · 张兴华

CampusPulse AI 为传智杯 AI WEB 网页开发挑战赛项目。请遵守导入数据的使用授权，AI 提供有证据的分析与建议，关键运营决策仍需由团队复核。
