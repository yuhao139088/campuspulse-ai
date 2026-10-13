import { NextResponse } from "next/server";
import { z } from "zod";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

const schema = z.object({ title: z.string().min(1).max(120).default("社团运营月报"), prompt: z.string().max(1000).default("生成本月社团运营报告"), locale: z.enum(["zh", "en"]).default("zh"), markdown: z.string().max(100000).optional(), format: z.enum(["markdown", "docx"]).default("markdown") });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid export request" }, { status: 400 });
  const { format } = parsed.data;
  const markdown = parsed.data.markdown;
  if (!markdown) return NextResponse.json({ error: "Generate or edit a report before export" }, { status: 400 });
  if (format === "markdown") return new NextResponse(markdown, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="campuspulse-report.md"` } });
  const children = markdown.split(/\r?\n/).map((line) => {
    if (line.startsWith("### ")) return new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 });
    if (line.startsWith("## ")) return new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 });
    if (line.startsWith("# ")) return new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 });
    if (line.startsWith("- ")) return new Paragraph({ text: line.slice(2), bullet: { level: 0 } });
    return new Paragraph({ children: [new TextRun(line)] });
  });
  const buffer = await Packer.toBuffer(new Document({ sections: [{ properties: {}, children }] }));
  return new NextResponse(buffer as BodyInit, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="campuspulse-report.docx"` } });
}

