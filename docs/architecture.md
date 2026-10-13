# CampusPulse AI Architecture

## Runtime layers

- **Presentation**: Next.js App Router, TypeScript, Tailwind CSS, Animate.css, Framer Motion and ECharts.
- **AI orchestration**: the `/api/ai/analyze` route validates requests, selects demo/live mode and exposes a structured tool trace.
- **Data intelligence**: `src/lib/ai/tools.ts` contains deterministic profiling, aggregation, anomaly detection and action-plan primitives.
- **Ingestion**: `/api/data/preview` accepts CSV, Excel and images; tabular files are previewed with PapaParse/XLSX and images are queued for OCR evidence processing.
- **Persistence**: Prisma models cover users, spaces, memberships, datasets, analyses, evidence and reports.
- **Infrastructure**: PostgreSQL stores metadata, MinIO/S3 stores source objects, and the developer-only watermark audit service stays private.

## Evidence-first AI contract

Every live analysis must attach the dataset ID, selected fields, tool names, evidence references, confidence and locale to its persisted `Analysis` record. The model is instructed to separate facts, inferences and recommendations. The demo mode follows the same response shape so the presentation can run without external keys.

## Motion system

Animate.css handles short entrance, status and feedback transitions. Framer Motion/React Bits are reserved for orchestration states, spotlight surfaces and canvas interactions. Global CSS disables non-essential animation when `prefers-reduced-motion: reduce` is active.
