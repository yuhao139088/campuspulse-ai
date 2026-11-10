# CampusPulse AI

CampusPulse AI 是面向高校社团与校园组织的双语运营数据工作台。它把分散在表格、活动图片和团队协作中的信息，整理为可核对的数据记录，并辅助完成分析、图表、报告与后续任务。

在线演示：[cam.yuhaocloud.cn](https://cam.yuhaocloud.cn)
项目仓库：[yuhao139088/campuspulse-ai](https://github.com/yuhao139088/campuspulse-ai)

评审账号：judge@campuspulse.ai（系统管理员）。该账号具有全站管理权限；登录凭据通过评审专属受控渠道提供，不在公开仓库、视频或公开文档中发布。

## 项目场景

社团活动的报名、签到、预算、问卷和图片记录经常分散在不同文件中。人工汇总需要重复整理，分析结论也不容易追溯到原始记录。CampusPulse AI 提供从资料导入到复盘协作的一体化流程，让团队可以在同一空间内检查数据、追问指标依据、生成图表和报告，并把建议转为可跟进的任务。

## 功能概览

| 模块 | 主要能力 |
| --- | --- |
| 工作空间 | 个人与社团空间、成员邀请、角色权限、操作审计 |
| 数据管理 | 导入 CSV、Excel 和图片；查看字段、预览、质量提示与来源证据 |
| AI 分析 | 用自然语言提问；按权限限定数据集；查看工具轨迹、计算结果和引用 |
| 可视化 | 将建议图表加入画布；图表按数据集隔离；支持编辑、保存与 PNG 导出 |
| 报告与任务 | 生成中英文报告、修订及查看版本；把行动建议整理为团队任务 |
| 账号安全 | 邮箱及已配置的手机号登录、TOTP 双重验证、恢复码和敏感操作验证 |
| 平台管理 | 配置登录、邮件、短信、人机验证、AI 服务、导入规则及 GitHub OAuth |

## 设计原则与 AI 边界

- 模型通过 OpenAI-compatible Chat Completions 接口接入；服务端将当前账号有权访问的数据集和允许使用的工具限定在本次分析范围内。
- 求和、计数、平均、比率等数值由服务端代码根据当前数据计算。模型负责理解问题、选择工具并组织解释，不负责凭空产生统计值。
- AI 分析保留实际工具结果和数据来源。用户可回到记录、字段和 OCR 证据进行核验。
- 图片识别由视觉模型或可用 OCR 引擎完成。版式复杂、图像质量较差时可能误读，结构化内容需要人工复核。
- 校园运营知识来自项目维护的知识卡，并通过词项相关度排序。目前没有向量数据库或 MCP 协议实现，不将关键词检索描述为向量检索。
- 模型自评置信度未经统计校准；异常检测只给出待复核候选，不证明成因或因果关系。
- 示例空间中的数据是原创合成数据；当前材料不宣称已完成真实校园试点、商业化验证或独立模型基准测试。

## 技术栈

Next.js App Router、React、TypeScript、Tailwind CSS、Apache ECharts、PostgreSQL、Prisma、NextAuth、S3 兼容私有对象存储、Vitest 与 Playwright。

## 本地运行

### 环境要求

- Node.js 22 或更高版本
- PostgreSQL
- S3 兼容对象存储
- 可选：视觉模型/OCR 服务、SMTP、短信认证及腾讯云验证码配置

### 安装

    npm ci
    cp .env.example .env

填写本地数据库与会话配置。外部服务凭据按需填写；不要把真实密钥、个人数据或生产环境配置提交到 Git。

    npm run db:generate
    npx prisma migrate deploy
    npm run dev

默认地址为 http://localhost:3000。环境变量名称与用途以 .env.example 为准。

## 质量检查

    npm run typecheck
    npm run lint
    npm test
    npm run build
    npm run test:e2e

测试素材和手动验收步骤见 [测试指南](docs/testing-guide.md)。浏览器测试需要 Chromium；端到端业务测试还需按指南配置隔离的测试服务。测试通过不等于真实用户研究或模型效果认证。

## 文档

- [作品介绍](docs/作品介绍.md)
- [系统架构](docs/architecture.md)
- [认证与系统配置](docs/authentication.md)
- [生产部署](docs/deployment.md)
- [竞赛技术说明](docs/competition-technical-document.md)
- [测试指南](docs/testing-guide.md)
- [演示脚本](docs/demo-script.md)
- [安全说明](docs/security.md)
- [竞赛核对清单](docs/competition-checklist.md)

已整理的 PDF 评审材料和演示脚本见 `output/pdf/`；可导入的原创测试素材见 `data/test-materials/`。

## 团队

开发成员：郑宇豪、尤一龙、关博然。指导教师：冯玉雷、张兴华。

---

CampusPulse AI · 2026
