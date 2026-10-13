# Prisma migrations

The initial SQL migration is generated from `prisma/schema.prisma`. On a fresh server run `npx prisma migrate deploy` after PostgreSQL is healthy. Create future migrations locally with `npx prisma migrate dev --name <change>`.
