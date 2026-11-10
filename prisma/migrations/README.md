# Database migrations

Prisma schema changes are tracked as ordered SQL migrations in this directory.

- For a new local database, configure `DATABASE_URL`, generate the Prisma client, then run `npx prisma migrate deploy`.
- Create schema changes with `npx prisma migrate dev --name <short-description>` in a development database.
- Review generated SQL before applying it to production; back up production data and use the release procedure documented in `docs/deployment.md`.
- Never put production credentials, user data, or environment files in a migration or its documentation.
