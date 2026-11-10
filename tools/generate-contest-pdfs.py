import json
import os
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf"
ASSETS = ROOT / "docs" / "assets"
FONT_PATH = Path("C:/Windows/Fonts/msyh.ttc")

NAVY = colors.HexColor("#101B32")
INK = colors.HexColor("#24324B")
MUTED = colors.HexColor("#68758A")
MINT = colors.HexColor("#31B8A4")
PURPLE = colors.HexColor("#8067E8")
PALE = colors.HexColor("#F1F5FA")
WHITE = colors.white
LINE = colors.HexColor("#DCE4EF")

pdfmetrics.registerFont(TTFont("CampusCN", str(FONT_PATH), subfontIndex=0))
pdfmetrics.registerFontFamily("CampusCN", normal="CampusCN", bold="CampusCN", italic="CampusCN", boldItalic="CampusCN")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="CampusTitle", fontName="CampusCN", fontSize=27, leading=36,
    textColor=NAVY, alignment=TA_LEFT, wordWrap="CJK", spaceAfter=10,
))
styles.add(ParagraphStyle(
    name="CampusSubtitle", fontName="CampusCN", fontSize=12, leading=20,
    textColor=INK, wordWrap="CJK",
))
styles.add(ParagraphStyle(
    name="CampusH1", fontName="CampusCN", fontSize=17, leading=24,
    textColor=NAVY, wordWrap="CJK", spaceBefore=8, spaceAfter=9,
))
styles.add(ParagraphStyle(
    name="CampusH2", fontName="CampusCN", fontSize=12, leading=19,
    textColor=PURPLE, wordWrap="CJK", spaceBefore=8, spaceAfter=4,
))
styles.add(ParagraphStyle(
    name="CampusBody", fontName="CampusCN", fontSize=9.3, leading=15.5,
    textColor=INK, wordWrap="CJK", alignment=TA_LEFT, spaceAfter=6,
))
styles.add(ParagraphStyle(
    name="CampusSmall", fontName="CampusCN", fontSize=8, leading=12,
    textColor=MUTED, wordWrap="CJK", spaceAfter=3,
))
styles.add(ParagraphStyle(
    name="CampusTable", fontName="CampusCN", fontSize=8.2, leading=12,
    textColor=INK, wordWrap="CJK",
))
styles.add(ParagraphStyle(
    name="CampusTableHead", fontName="CampusCN", fontSize=8.2, leading=12,
    textColor=WHITE, wordWrap="CJK",
))
styles.add(ParagraphStyle(
    name="CampusCoverLabel", fontName="CampusCN", fontSize=9, leading=14,
    textColor=colors.HexColor("#147C72"), wordWrap="CJK",
))
styles.add(ParagraphStyle(
    name="CampusScene", fontName="CampusCN", fontSize=10.2, leading=16,
    textColor=NAVY, wordWrap="CJK", spaceBefore=6, spaceAfter=5,
))


def para(text, style="CampusBody"):
    return Paragraph(escape(text).replace("\n", "<br/>"), styles[style])


def rich(text, style="CampusBody"):
    return Paragraph(text, styles[style])


def table(rows, widths, header=True):
    converted = []
    for row_index, row in enumerate(rows):
        cell_style = "CampusTableHead" if header and row_index == 0 else "CampusTable"
        converted.append([para(str(cell), cell_style) for cell in row])
    result = Table(converted, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    rules = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
    ]
    if header:
        rules.append(("BACKGROUND", (0, 0), (-1, 0), NAVY))
        rules.append(("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PALE]))
    else:
        rules.append(("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, PALE]))
    result.setStyle(TableStyle(rules))
    return result


def cover(title, subtitle, summary, metadata):
    return [
        Spacer(1, 13 * mm),
        para("CAMPUSPULSE AI  /  WEB 项目说明", "CampusCoverLabel"),
        Spacer(1, 8 * mm),
        para(title, "CampusTitle"),
        para(subtitle, "CampusSubtitle"),
        Spacer(1, 8 * mm),
        Table([[para(summary, "CampusSubtitle")]], colWidths=[16.8 * cm], style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#E8F6F3")),
            ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#C7E8E1")),
            ("LEFTPADDING", (0, 0), (-1, -1), 14),
            ("RIGHTPADDING", (0, 0), (-1, -1), 14),
            ("TOPPADDING", (0, 0), (-1, -1), 13),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 13),
        ])),
        Spacer(1, 9 * mm),
        table(metadata, [4.2 * cm, 12.6 * cm], header=False),
        Spacer(1, 8 * mm),
        para("更新日期：2026 年 11 月 10 日", "CampusSmall"),
        PageBreak(),
    ]


def decorate(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.55)
    canvas.line(19 * mm, height - 14 * mm, width - 19 * mm, height - 14 * mm)
    canvas.setFont("CampusCN", 8)
    canvas.setFillColor(NAVY)
    canvas.drawString(19 * mm, height - 10 * mm, "CampusPulse AI")
    canvas.setFillColor(MUTED)
    canvas.drawRightString(width - 19 * mm, 9 * mm, f"{doc.page:02d}")
    canvas.restoreState()


def fit_image(path, max_width, max_height):
    image = Image(str(path))
    scale = min(max_width / image.imageWidth, max_height / image.imageHeight, 1)
    image.drawWidth = image.imageWidth * scale
    image.drawHeight = image.imageHeight * scale
    image.hAlign = "CENTER"
    return image


def reviewer_metadata():
    credential_file = os.environ.get("CAMPUSPULSE_REVIEW_CREDENTIAL_FILE")
    if not credential_file:
        return []
    credentials = json.loads(Path(credential_file).read_text(encoding="utf-8"))
    email = str(credentials.get("email", "")).strip()
    password = str(credentials.get("password", ""))
    if email != "judge@campuspulse.ai" or len(password) < 20:
        raise ValueError("Reviewer credential file is invalid")
    return [["评审登录账号", email], ["评审登录密码", password]]


def document(path, story):
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(path), pagesize=A4,
        rightMargin=19 * mm, leftMargin=19 * mm,
        topMargin=19 * mm, bottomMargin=17 * mm,
        title=path.stem, author="CampusPulse AI",
        subject="校园社团运营数据工作台项目说明",
    )
    doc.build(story, onFirstPage=decorate, onLaterPages=decorate)


def build_project_intro():
    metadata = [
        ["参赛项目", "第九届传智杯 Web 网页开发挑战赛"],
        ["开发成员", "郑宇豪、尤一龙、关博然"],
        ["指导教师", "冯玉雷、张兴华"],
        ["在线体验", "https://cam.yuhaocloud.cn"],
        ["项目仓库", "https://github.com/yuhao139088/campuspulse-ai"],
    ]
    metadata.extend(reviewer_metadata())
    story = cover(
        "CampusPulse AI",
        "作品介绍｜高校社团运营数据工作台",
        "面向高校社团活动复盘的双语数据工作台：从表格与图片资料开始，连接数据核验、AI 辅助分析、图表、报告和协作跟进。",
        metadata,
    )
    story += [fit_image(ASSETS / "production-homepage-hero.png", 16.8 * cm, 9.6 * cm), Spacer(1, 2 * mm)]
    story += [para("图 1｜CampusPulse AI 公开首页。页面上的示例数值用于视觉展示，不代表真实运营统计，也不是经校准的模型指标。", "CampusSmall")]
    story += [para("一、项目详情与使用方式", "CampusH1")]
    story += [para("校园社团在一次活动中会产生报名名单、签到记录、预算表、反馈问卷和现场图片。这些资料往往格式不一、分散保存，负责人需要反复清洗、合并和统计，复盘结论也不容易追溯到原始记录。CampusPulse AI 将上述工作组织在一个双语 Web 工作台中，帮助团队完成从资料进入系统到复盘内容协作的连续流程。")]
    story += [para("系统以工作空间管理成员与数据资产。空间成员按角色访问获授权的资料；全站系统管理员负责网站级账号和服务配置。数据集保存字段、行记录、质量概况及原始导入证据，供后续分析、图表和报告引用。")]
    story.append(table([
        ["步骤", "操作与系统反馈", "评审可核对的内容"],
        ["1. 登录与选空间", "进入工作区，查看空间、成员和数据资产", "账号角色及当前空间"],
        ["2. 导入与检查", "导入 CSV、Excel 或活动图片，查看字段、记录及质量提示", "结构化行、来源文件和 OCR 证据"],
        ["3. 提问与分析", "选择数据集，以自然语言提出统计或比较问题", "工具调用、授权字段及确定性计算结果"],
        ["4. 可视化与报告", "把建议图表加入对应画布，生成并编辑报告", "图表数据源、报告内容与历史版本"],
        ["5. 协作与回溯", "分配行动项，查看成员权限与操作审计", "负责人、状态和关键操作记录"],
    ], [2.7 * cm, 7.5 * cm, 6.4 * cm]))
    story += [para("项目提供原创合成测试素材，涵盖常规运营表、重复与缺失值、中文字段、OCR 活动单、空白图片和不支持格式。评审可先查看预置数据，也可用这些素材验证导入行为；不要向演示环境上传真实学生个人信息。", "CampusSmall")]

    story += [PageBreak(), para("二、项目亮点", "CampusH1")]
    for heading, description in [
        ("围绕真实工作流组织功能", "不是单一聊天窗口：数据空间、分析、画布、报告、行动项和审计围绕一次校园活动复盘相互衔接。"),
        ("让分析过程可检查", "每次分析关联当前数据集，并记录工具调用与结果；使用者可以查看字段、分组和来源，再回到原始记录核实。"),
        ("把模型规划与数值运算分开", "模型理解问题并选择允许的工具；计数、聚合、比率等由服务端代码按授权行计算，减少语言模型直接编造数值的风险。"),
        ("将图片表格转成明细记录", "OCR/视觉识别后的表格结构按明细行归一化，并保留原图及识别证据，便于统计并逐项校对。"),
        ("保护数据源边界", "图表明确关联来源数据集，页面查询按来源过滤，避免在不含对应字段的数据源中展示错误或空白图表。"),
        ("区分空间协作与平台管理", "成员权限限定在所属空间；系统管理员权限用于全站服务配置。审计记录为敏感管理操作提供回溯线索。"),
        ("覆盖不同屏幕尺寸", "桌面、窄桌面、平板和手机布局均通过浏览器多视口检查，重点处理导航、表格、设置面板、图表和触控目标。"),
    ]:
        story += [para(heading, "CampusH2"), para(description)]
    story += [para("典型复盘场景", "CampusH2")]
    story.append(table([
        ["运营问题", "系统辅助内容", "团队核验方式"],
        ["比较不同活动的报名与到场情况", "按活动分组的计数、比率或图表建议", "回看对应名单和签到记录，确认统计口径"],
        ["整理预算、问卷或活动反馈", "字段摘要、聚合结果和报告草稿", "核对原表、问卷范围及缺失记录"],
        ["检查导入表格与图片识别结果", "质量提示、OCR 明细行和来源证据", "对照原始文件修正识别或字段映射"],
    ], [4.1 * cm, 6.4 * cm, 5.7 * cm]))

    story += [PageBreak(), para("三、AI 技术落地与测试", "CampusH1")]
    story += [para("AI 分析通过服务端接入兼容 OpenAI Chat Completions 的模型。用户先指定数据集并描述问题；Agent 根据字段上下文规划调用，服务端重新校验身份、空间角色、资源归属和字段范围，再仅执行允许的工具。模型负责语言理解、工具规划和结果说明，业务 API 与领域服务负责授权和实际计算。")]
    story += [para("数据画像、计数、聚合、平均值和比率等由程序对当前数据集行执行。比率需要明确指定两个字段；无法解析的值、零分母及样本不足按规则处理。异常检测给出需要人工复核的候选，不自动断言数据错误或原因。图表建议可以导入绑定同一数据源的画布。")]
    story += [para("图片资料可经过视觉模型或 OCR 识别，再校验字段并将表格明细展开为多行；系统保留与数据集关联的来源证据。识别文本可能受图片清晰度、字体和版式影响，不能视为无误，使用者应对照原图核验。项目知识卡按词项相关度排序，不使用向量数据库，也未实现 MCP。")]
    story += [para("测试素材与自动化验证", "CampusH2")]
    story += [para("仓库内的 `data/test-materials/` 提供 CSV、XLSX 与 OCR 图片等原创合成样例，可用于体验正常导入、中文字段、重复/缺失/异常值、OCR 行展开、空白图像和无效格式处理。Vitest 覆盖工具输入、字段授权、确定性比率、异常候选、知识检索和图表配置等逻辑；Playwright 检查登录及主要页面在桌面与移动视口的交互和排版。TypeScript、ESLint 与生产构建用于发现类型、规则和打包问题。")]
    story += [para("这些测试验证程序行为和工作流，不等于独立模型准确率评测、真实用户研究或校园业务试点。首页置信度为未经校准的模型自评；异常结果是待核验候选。项目尚无经团队提供的真实校园效果数据，不以合成样例推导商业或社会成效。")]
    story += [para("一次分析请求的处理链路", "CampusH2")]
    story.append(table([
        ["阶段", "执行内容", "边界控制"],
        ["输入", "用户问题与显式选择的数据集", "不把其他数据源混入当前上下文"],
        ["授权", "服务端读取会话、空间角色、数据集和字段权限", "客户端参数不作为授权依据"],
        ["执行", "模型选择允许的工具；领域服务完成数值计算或读取证据", "工具范围与数据行由服务端约束"],
        ["复核", "返回结果、说明及工具轨迹", "使用者对照来源后再作运营判断"],
    ], [2.4 * cm, 8.1 * cm, 5.7 * cm]))

    story += [PageBreak(), para("四、项目关键技术", "CampusH1")]
    story.append(table([
        ["层次", "技术", "用途"],
        ["Web", "Next.js、React、TypeScript", "界面、服务端路由与类型约束"],
        ["可视化", "Tailwind CSS、Apache ECharts", "响应式界面与交互图表"],
        ["数据", "PostgreSQL、Prisma、私有 S3", "业务记录、审计和原始文件"],
        ["AI", "OpenAI-compatible Chat Completions", "工具规划与自然语言解释"],
        ["多模态", "CSV/XLSX 解析、视觉模型或 OCR", "表格导入、图片识别及证据核查"],
        ["安全", "NextAuth、bcrypt、TOTP、腾讯云验证码", "登录、双重验证与服务器端票据核验"],
        ["测试", "Vitest、Playwright、ESLint、TypeScript", "逻辑、浏览器与构建检查"],
    ], [2.6 * cm, 6.1 * cm, 8.1 * cm]))
    story += [para("关键流程与安全边界", "CampusH2")]
    story += [para("浏览器通过 HTTPS 访问 Next.js 页面与 API；API 使用 NextAuth 会话和服务端权限检查调用领域逻辑；Prisma 将结构化业务数据写入 PostgreSQL，原始文件置于私有 S3 兼容存储。模型、邮件、短信和验证码凭据保存在服务端配置中。用户上传内容只作为待处理的数据，不能提升自身权限，也不应覆盖系统指令。")]
    story += [fit_image(ASSETS / "production-login.png", 14.5 * cm, 8.4 * cm), Spacer(1, 1 * mm)]
    story += [para("图 2｜在线登录页面。认证方式由当前部署配置决定。", "CampusSmall")]
    story += [PageBreak(), para("五、项目界面与来源", "CampusH1")]
    story += [fit_image(ASSETS / "production-dataset-detail.png", 16.8 * cm, 10.8 * cm), Spacer(1, 2 * mm)]
    story += [para("图 3｜数据集详情与质量摘要。界面截图由自动化浏览器测试生成，使用原创合成数据，不含真实成员信息。图片按原始宽高比缩放。", "CampusSmall")]
    story += [para("六、发表、获奖与项目来源", "CampusH1")]
    story += [para("截至本说明更新日，团队未提供 CampusPulse AI 在期刊、会议或媒体发表的记录，也未提供其他赛事获奖证明。因此，本说明不将参赛经历表述为已经获奖。赛事页面和参赛信息以主办方公开页面及团队实际报名材料为准。")]
    story += [para("据团队说明，CampusPulse AI 为自主选题和开发，没有以其他商业项目或既有完整应用为底稿进行改名。项目使用公开软件依赖，并按各自许可证使用。此次持续优化围绕本项目本身：调整移动与桌面排版、修复图片表格 OCR 的明细归一化、隔离跨数据源图表、改进 AI 工具与证据核对，并补充测试素材和自动化回归。")]
    story += [para("赛事介绍：https://www.boxuegu.com/matchTrack/detail/?id=10037", "CampusSmall")]
    document(OUTPUT / "CampusPulse-AI-作品介绍.pdf", story)


def build_technical_doc():
    story = cover(
        "技术说明",
        "系统架构、数据流程与 AI 边界",
        "以服务端授权、确定性计算和来源证据，构建面向校园社团运营的可复核数据工作台。",
        [
            ["项目", "CampusPulse AI"],
            ["技术方向", "Web 应用与 AI 辅助数据分析"],
            ["开发成员", "郑宇豪、尤一龙、关博然"],
            ["核心架构", "Next.js / PostgreSQL / 私有对象存储"],
            ["在线体验", "https://cam.yuhaocloud.cn"],
        ],
    )
    story += [para("1. 设计目标与系统分层", "CampusH1")]
    story += [para("项目通过统一工作空间处理活动表格、图片和运营复盘。架构把 Web 交互、业务授权、领域逻辑、持久化和外部服务分层，避免客户端直接接触数据库、短信密钥或对象存储管理接口。")]
    story.append(table([
        ["层次", "主要职责", "关键组件"],
        ["Web 界面", "工作区、数据详情、分析、图表与报告", "Next.js App Router、React、TypeScript"],
        ["业务 API", "输入校验、身份认证、空间及资源授权", "Route Handlers、Zod、NextAuth"],
        ["领域服务", "导入、OCR、Agent、计算、报告与安全", "TypeScript 服务模块"],
        ["持久化", "业务记录、审计、上传对象", "Prisma、PostgreSQL、私有 S3"],
        ["外部适配", "模型、邮件、短信、验证码与 OAuth", "服务端供应商适配器"],
    ], [2.8 * cm, 7.4 * cm, 6.6 * cm]))
    story += [para("2. 数据导入与证据链", "CampusH1")]
    story += [para("服务端对上传类型、大小、编码、表头和数据规模进行校验。CSV 与 Excel 解析为字段字典及行记录；图片经可用视觉模型或 OCR 引擎提取文本，再进行结构化校验。检测到表格明细时将其展开为多行记录，避免把对象数组当作单个单元格。")]
    story += [para("原文件与 OCR 证据保存在受访问控制的对象存储和数据库记录中。结构化记录可用于筛选、统计和作图；原图与识别内容则供使用者回查。OCR 结果可能因图像质量或表格版式而不完整，应由用户对照来源核验。")]
    story += [para("3. AI 分析与计算", "CampusH1")]
    story += [para("用户选定数据集后，服务端再次检查用户、空间角色和数据集归属，向 Agent 提供受限字段及允许的工具。Agent 组织工具调用并解释结果；聚合、计数、比率和异常候选由程序执行。调用轨迹与结果保留在分析记录中。")]
    story += [para("AI 接入使用兼容 OpenAI Chat Completions 的服务。可配置模型用于工具规划与自然语言生成。提示词和返回内容不能替代 API 的权限验证；用户上传文件作为不可信数据，不应当作指令执行。")]
    story += [PageBreak(), para("4. 工具与知识检索", "CampusH1")]
    story.append(table([
        ["能力", "执行原则", "需要人工核验"],
        ["数据画像", "汇总当前数据集字段、类型及质量信息", "确认导入字段与数据范围"],
        ["聚合/比率", "在服务端按有效行计算，显式区分分子、分母和分组", "对照原始行及口径"],
        ["异常候选", "满足样本条件后标注可能偏离的记录", "判断是否确属错误及其原因"],
        ["图表建议", "根据当前数据字段构造图表配置", "确认配置绑定当前数据集"],
        ["知识卡检索", "对项目维护的知识卡按词项相关度排序", "确认来源及适用场景"],
        ["OCR 证据", "返回与当前数据集关联的原始识别内容", "逐字段检查图片识别准确度"],
    ], [3.2 * cm, 7.1 * cm, 6.5 * cm]))
    story += [para("知识检索是轻量关键词排序，不使用向量数据库、不进行自动文档向量化，也未实现 MCP 协议。模型自评置信度未经校准，异常工具输出不能证明因果关系。")]
    story += [para("5. 数据集、图表与空间隔离", "CampusH1")]
    story += [para("业务资源通过空间成员角色和资源归属保护。图表记录关联创建时的数据集，查询和展示均按当前数据源过滤。报告、任务和原始文件也必须通过服务端授权后访问，不能依靠前端隐藏控件。")]
    story += [para("6. 报告、任务与协作", "CampusH1")]
    story += [para("报告将指标、候选异常、证据和行动建议组合成可编辑内容，保留历史版本并支持导出。行动任务便于团队安排负责人和状态。模型生成内容不等于已执行行动或真实成效；团队需审核并跟进实际结果。")]
    story += [para("7. 账号安全及平台配置", "CampusH1")]
    story += [para("系统区分全站系统管理员与空间角色。密码经单向散列；邮件、短信、AI、OAuth 和人机验证凭据只在服务器使用并加密保存。邮箱/手机验证码、TOTP、一次性恢复码和腾讯云验证码各承担不同验证职责。敏感设置操作使用已绑定方式和一次性动作许可。")]
    story += [PageBreak(), para("8. 质量验证与运行", "CampusH1")]
    story.append(table([
        ["检查", "工具", "验证目标"],
        ["领域与 API", "Vitest", "输入边界、权限、数据计算与安全状态"],
        ["静态质量", "TypeScript、ESLint", "类型与规则检查"],
        ["构建", "Next.js production build", "生成可运行的生产产物"],
        ["浏览器", "Playwright", "交互、布局和多视口行为"],
        ["外部服务", "真实配置下的集成检查", "供应商实际接收、核验和错误处理"],
    ], [3.2 * cm, 4.2 * cm, 9.4 * cm]))
    story += [para("自动化测试通过不能证明模型精度、外部供应商长期可用、真实用户满意度或业务影响。每次发布应记录实际环境、命令、测试输出和版本。")]
    story += [para("9. 部署与安全边界", "CampusH1")]
    story += [para("生产运行需要 Node.js、PostgreSQL、持久化 S3 兼容存储、HTTPS 反向代理及受保护的配置。数据库迁移应保持兼容并预先备份。外部密钥不得进入仓库、公开 PDF、终端截图或压缩包。")]
    story += [para("10. 当前限制与后续工作", "CampusH1")]
    for item in [
        "知识检索目前使用关键词相关排序，暂无向量搜索、知识更新工作流或 MCP。",
        "模型自评置信度未经校准；异常结果是候选，需人工核验。",
        "OCR 质量受图像、字体和版式影响，不能保证每次识别完全正确。",
        "项目目前使用原创合成数据，尚未通过真实校园试点证明业务收益。",
        "后续可建立脱敏评测集，测量字段抽取和工具计算质量，并开展经授权的用户试用。",
    ]:
        story.append(para("• " + item))
    story += [Spacer(1, 5 * mm), para("开发成员：郑宇豪、尤一龙、关博然　｜　指导教师：冯玉雷、张兴华", "CampusSmall")]
    document(OUTPUT / "CampusPulse-AI-技术说明.pdf", story)


def build_video_script():
    story = cover(
        "演示视频脚本",
        "对应现有成片约 7 分 51 秒｜16:9、1080p",
        "按现有录屏时间轴讲解产品场景、数据空间、分析、图表、报告与安全边界；不展示口令和真实个人资料。",
        [
            ["录制规格", "建议 1920×1080，最终遵循赛事上传要求"],
            ["录制素材", "原创合成活动表格与 OCR 图片"],
            ["登录方式", "评审账号；凭据通过受控渠道提供"],
            ["在线演示", "https://cam.yuhaocloud.cn"],
            ["注意事项", "不展示密码、OTP、恢复码、密钥或终端"],
        ] + reviewer_metadata(),
    )
    story += [para("录制前准备", "CampusH1")]
    for item in [
        "使用独立浏览器配置文件，关闭通知、密码管理器弹窗和无关标签。",
        "先确认在线站点、评审账号与演示数据可用；若模型服务不可用，说明外部依赖，不伪装为实时结果。",
        "使用原创合成 CSV 和 OCR 图片，不录入真实学生隐私。",
        "浏览器缩放 100%，画面清晰；录制开始前检查桌面和窄屏布局。",
        "录屏和字幕不出现密码、OTP、恢复码、服务密钥或运维凭据。",
    ]:
        story.append(para("• " + item))
    scenes = [
        ("00:00–00:30｜项目定位", "首页展示产品名称、校园运营场景和示例图形。", "大家好，下面演示 CampusPulse AI——面向高校社团活动复盘的数据工作台。报名、签到、预算和问卷记录通常分散在多个文件里；本项目尝试把资料整理、分析核验、图表和报告跟进连接起来。首页的数值是界面演示内容，不代表真实业务结果或经校准的模型评分。"),
        ("00:30–00:55｜登录入口", "展示登录页面后进入评审工作空间；避免录入和呈现账号密码。", "登录入口提供部署环境已启用的认证方式。录屏使用预置演示账号进入工作空间，账号密码不录入画面，也不写进公开材料。账号认证与工作空间的数据权限由服务端校验。"),
        ("00:55–01:40｜运营总览与数据空间", "从总览进入数据空间，浏览已有合成数据集及列表。", "总览提供空间和数据资产的入口。进入数据空间后，可以看到不同主题的数据集，先从名称、记录规模和质量状态了解资料，再进入需要分析的数据源。演示内容是原创合成资料，不包含真实学生信息。需要重点说明：每次分析都必须选定数据集，后续图表与分析结果以该数据源为边界。"),
        ("01:40–02:40｜AI 辅助分析", "选择数据集，输入分析问题；展示分析说明、工具和返回结果。", "在 AI 分析页，我选择当前工作空间中的数据集，并提出关于活动报名、签到或满意度的比较问题。模型负责理解问题和规划允许的工具；服务端重新检查用户权限和字段范围。计数、聚合和比率等数值由程序根据记录计算，不由模型凭空估算。接下来可以检查工具轨迹与结果，核对使用的字段、分组及返回数据。异常检测返回需要人工复核的候选，不等同于已确认错误或原因；模型自评置信度也没有经过统计校准。"),
        ("02:40–03:54｜图表建议与画布", "浏览 AI 图表建议、加入图表，再在画布查看图形和数据来源。", "对适合可视化的分析结果，可以查看图表建议并加入画布。画布展示当前数据集关联的图表，支持查看图形和来源信息。每个图表都绑定创建时的数据源；切换数据集后，不会把其他数据源的图表混在一起，避免字段不存在导致空白或误读。当前片段聚焦于推荐、导入和查看；成片不展示导出图片操作。"),
        ("03:54–04:54｜报告中心", "进入报告中心，查看报告生成表单、生成后的内容和报告列表。", "报告中心把指定数据集的分析整理成报告内容，结构包含指标、发现和建议。生成内容可以继续编辑，供团队讨论和复核。报告是辅助材料，不能替代对原始记录的核验或团队决策；演示中的数据与报告均用于功能展示。成片中展示的是报告工作流和生成结果浏览，不应把它描述为已经落地执行的行动或真实成效。"),
        ("04:54–05:25｜管理空间", "展示空间运营概览与管理员入口，避免点击破坏性或敏感配置。", "空间管理页汇总成员、数据集和使用情况，并提供成员权限、数据资产与审计入口。系统管理员负责全站级配置，空间角色只在所属空间内生效。区分这两类权限，能够减少管理边界混淆。演示时只浏览页面，不修改生产配置。"),
        ("05:25–06:39｜系统配置与审计", "浏览全站服务设置、验证码或连接状态及审计页面；画面中密钥与私密字段须持续遮挡。", "系统管理中心用于配置网站级服务和安全选项。敏感凭据只应由服务端保存，画面不应显示其明文；状态或配置页面也应避免留下账号自动补全弹窗。审计记录提供操作类型与时间线，帮助管理员回溯配置变更。展示管理能力时仅说明配置入口和审计用途，不口播真实密钥、验证码或账号隐私。"),
        ("06:39–07:10｜账号安全与边界", "展示个人安全设置和已启用的二次验证方式，然后回到产品页面。", "账号安全页集中展示已绑定的验证方式和安全选项。用户可按部署配置使用邮箱或手机验证、Authenticator 双重验证及恢复流程。此处演示只浏览状态，不展示验证码、恢复码或密钥。不同验证方式需先完成绑定，敏感操作由服务端校验一次性验证结果。"),
        ("07:10–07:51｜总结", "结束画面回到公开首页，展示项目名称与公开入口。", "CampusPulse AI 将校园社团运营数据整理、可核验分析、图表和报告放在同一工作流中。项目通过合成资料和自动化测试验证功能流程，尚未以真实校园试点或商业数据证明运营收益。后续仍需在授权与隐私保护前提下开展实际使用评估。感谢观看。"),
    ]
    for title, screen, narration in scenes:
        story += [para(title, "CampusScene")]
        story += [para("画面/操作：" + screen)]
        story += [para("口播：" + narration)]
    story += [PageBreak(), para("后期与上传检查", "CampusH1")]
    for item in [
        "确认最终片长、分辨率、编码、声音及上传格式符合赛事当前要求。",
        "逐帧检查是否出现口令、验证码、恢复码、用户隐私、密钥或管理凭据。",
        "字幕与画面同步，关键表格和工具轨迹有足够停留时间。",
        "不要通过剪辑拼接结果伪装为单次实时模型输出；必要剪辑需保持过程真实。",
        "最终视频能正常播放，音量清晰，公开链接拼写正确。",
    ]:
        story.append(para("• " + item))
    document(OUTPUT / "CampusPulse-AI-演示视频脚本.pdf", story)


if __name__ == "__main__":
    if not FONT_PATH.exists():
        raise FileNotFoundError(f"Chinese font not found: {FONT_PATH}")
    for required in [
        ASSETS / "production-homepage-hero.png",
        ASSETS / "production-login.png",
        ASSETS / "production-dataset-detail.png",
    ]:
        if not required.is_file():
            raise FileNotFoundError(f"Required illustration not found: {required}")
    build_project_intro()
    build_technical_doc()
    build_video_script()
    print("Generated three CampusPulse AI PDFs.")
