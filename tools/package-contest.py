from __future__ import annotations

import argparse
import hashlib
import zipfile
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ROOT_FILES = {
    ".env.example",
    ".gitattributes",
    ".gitignore",
    "Dockerfile",
    "docker-compose.yml",
    "eslint.config.mjs",
    "next-env.d.ts",
    "next.config.ts",
    "package-lock.json",
    "package.json",
    "playwright.config.ts",
    "playwright.production.config.ts",
    "prisma.config.ts",
    "tsconfig.json",
    "vitest.config.mts",
}
ALLOWED_TREES = {
    "data/test-materials": {".csv", ".jpg", ".png", ".txt", ".xlsx"},
    "public": {".ico", ".jpg", ".png", ".svg", ".webp"},
    "src": {".css", ".json", ".svg", ".ts", ".tsx"},
    "tests": {".json", ".ts", ".tsx"},
}
REQUIRED_FILES = {
    ".env.example",
    "docs/作品介绍.md",
    "docs/assets/production-homepage-hero.png",
    "docs/assets/production-dataset-detail.png",
    "docs/assets/production-login.png",
    "比赛材料/作品介绍.pdf",
    "比赛材料/技术说明.pdf",
    "比赛材料/演示视频.mp4",
}
PACKAGE_README = """# CampusPulse AI

面向高校社团与校园组织的双语运营数据工作台，覆盖资料导入、数据质量检查、AI 辅助分析、图表、报告与团队跟进。

## 快速开始

需要 Node.js 22+、PostgreSQL 和 S3 兼容对象存储。复制 `.env.example` 为 `.env`，填写本地服务配置后运行：

```sh
npm ci
npm run db:generate
npx prisma migrate deploy
npm run dev
```

访问 `http://localhost:3000`。模型、邮箱、短信与验证码服务属于可选集成，按需在本地环境配置；不要提交任何真实凭据。

## 比赛材料

- 作品介绍：`比赛材料/作品介绍.pdf`
- 技术说明：`比赛材料/技术说明.pdf`
- 演示视频：`比赛材料/演示视频.mp4`
- 可编辑介绍稿：`docs/作品介绍.md`

## 验证

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

测试素材位于 `data/test-materials/`。自动化测试结果不代表真实校园试点或模型效果认证。
"""


def package_readme() -> str:
    import json
    import os

    credential_file = os.environ.get("CAMPUSPULSE_REVIEW_CREDENTIAL_FILE")
    if not credential_file:
        return PACKAGE_README
    credentials = json.loads(Path(credential_file).read_text(encoding="utf-8"))
    email = str(credentials.get("email", "")).strip()
    password = str(credentials.get("password", ""))
    if email != "judge@campuspulse.ai" or len(password) < 20:
        raise SystemExit("Reviewer credential file is invalid")
    return PACKAGE_README + (
        "\n## 评审账号\n\n"
        f"- 登录账号：`{email}`\n"
        f"- 登录密码：`{password}`\n"
        "- 权限：系统管理员\n"
    )


def include_file(path: Path, destination: Path) -> bool:
    if path.is_symlink():
        return False
    resolved = path.resolve()
    if ROOT not in resolved.parents:
        return False
    relative = path.relative_to(ROOT).as_posix()
    if resolved == destination.resolve():
        return False
    if relative in ROOT_FILES:
        return True
    if relative in {
        "docs/作品介绍.md",
        "docs/assets/production-dataset-detail.png",
        "docs/assets/production-homepage-hero.png",
        "docs/assets/production-login.png",
        "output/pdf/CampusPulse-AI-作品介绍.pdf",
        "output/pdf/CampusPulse-AI-技术说明.pdf",
        "output/video/CampusPulse-AI-演示视频-比赛版1080p.mp4",
        "tools/package-contest.py",
    }:
        return True
    if relative == "prisma/schema.prisma":
        return True
    if relative.startswith("prisma/migrations/") and path.suffix.lower() == ".sql":
        return True
    for tree, extensions in ALLOWED_TREES.items():
        if relative.startswith(f"{tree}/") and path.suffix.lower() in extensions:
            return True
    return False


def selected_files(destination: Path) -> list[Path]:
    candidates = [ROOT / name for name in ROOT_FILES]
    candidates.extend(
        ROOT / name
        for name in {
            "docs/作品介绍.md",
            "docs/assets/production-dataset-detail.png",
            "docs/assets/production-homepage-hero.png",
            "docs/assets/production-login.png",
            "output/pdf/CampusPulse-AI-作品介绍.pdf",
            "output/pdf/CampusPulse-AI-技术说明.pdf",
            "output/video/CampusPulse-AI-演示视频-比赛版1080p.mp4",
            "prisma/schema.prisma",
            "tools/package-contest.py",
        }
    )
    for tree in ALLOWED_TREES:
        base = ROOT / tree
        if base.exists():
            candidates.extend(path for path in base.rglob("*") if path.is_file())
    migrations = ROOT / "prisma" / "migrations"
    if migrations.exists():
        candidates.extend(path for path in migrations.rglob("*.sql") if path.is_file())
    return sorted({path for path in candidates if path.is_file() and include_file(path, destination)})


def main() -> None:
    parser = argparse.ArgumentParser(description="Package the CampusPulse AI contest source and requested materials.")
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT.parent / f"CampusPulse-AI-比赛提交包-{date.today():%Y%m%d}.zip",
        help="Output ZIP path (defaults to the parent directory).",
    )
    parser.add_argument("--replace", action="store_true", help="Replace the exact output archive if it already exists.")
    args = parser.parse_args()
    destination = args.output.expanduser().resolve()
    if destination == ROOT or ROOT in destination.parents:
        raise SystemExit("The package must be written outside the source repository.")
    if destination.exists() and not args.replace:
        raise SystemExit(f"Refusing to overwrite existing package: {destination}")
    if destination.exists():
        destination.unlink()

    destination.parent.mkdir(parents=True, exist_ok=True)
    entries: list[tuple[Path, str]] = []
    for path in selected_files(destination):
        relative = path.relative_to(ROOT).as_posix()
        if relative == "README.md":
            continue
        if relative.startswith("output/"):
            relative = {
                "output/pdf/CampusPulse-AI-作品介绍.pdf": "比赛材料/作品介绍.pdf",
                "output/pdf/CampusPulse-AI-技术说明.pdf": "比赛材料/技术说明.pdf",
                "output/video/CampusPulse-AI-演示视频-比赛版1080p.mp4": "比赛材料/演示视频.mp4",
            }[relative]
        entries.append((path, f"CampusPulse-AI/{relative}"))

    present = {name.removeprefix("CampusPulse-AI/") for _, name in entries}
    missing = REQUIRED_FILES - present
    if missing:
        raise SystemExit("Required package files are missing: " + ", ".join(sorted(missing)))

    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        archive.writestr("CampusPulse-AI/README.md", package_readme())
        for source, archive_name in sorted(entries, key=lambda item: item[1]):
            method = zipfile.ZIP_STORED if source.suffix.lower() in {".mp4", ".pdf", ".png", ".jpg", ".xlsx"} else zipfile.ZIP_DEFLATED
            archive.write(source, archive_name, compress_type=method)

    with zipfile.ZipFile(destination) as archive:
        names = set(archive.namelist())
        unsafe = [
            name
            for name in names
            if (Path(name).name.startswith(".env") and Path(name).name != ".env.example")
            or Path(name).name == "AGENTS.md"
        ]
        missing_after_write = {f"CampusPulse-AI/{name}" for name in REQUIRED_FILES} - names
        expected_names = {"CampusPulse-AI/README.md"} | {name for _, name in entries}
        unexpected = names - expected_names
        if unsafe or missing_after_write or unexpected:
            destination.unlink(missing_ok=True)
            raise SystemExit(
                f"Package validation failed: unsafe={len(unsafe)}, "
                f"missing={len(missing_after_write)}, unexpected={len(unexpected)}"
            )

    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    print(f"Package: {destination}")
    print(f"Files: {len(entries)}")
    print(f"Size: {destination.stat().st_size} bytes")
    print(f"SHA-256: {digest}")


if __name__ == "__main__":
    main()
