import { prisma } from "@/lib/prisma";

export async function getPersonalSpace(userId: string) {
  const space = await prisma.space.upsert({ where: { slug: `personal-${userId}` }, update: {}, create: { name: "个人空间", slug: `personal-${userId}`, type: "PERSONAL" } });
  await prisma.membership.upsert({ where: { userId_spaceId: { userId, spaceId: space.id } }, update: { role: "OWNER" }, create: { userId, spaceId: space.id, role: "OWNER" } });
  return space;
}
