import type { User } from "@prisma/client";
import { prisma } from "../prisma";
import { codeHash, decryptSecret } from "./crypto";
import { matchingTotpStep } from "./totp";

export async function verifyFactor(user: User, input: string) {
  if (!user.totpEnabled) return true;
  if (!user.totpSecret) return false;
  const value = input.trim().replace(/\s/g, "");
  const step = matchingTotpStep(decryptSecret(user.totpSecret), value);
  if (step !== null) {
    const used = await prisma.user.updateMany({ where: { id: user.id, totpEnabled: true, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] }, data: { totpLastStep: step } });
    return used.count === 1;
  }
  const codes = Array.isArray(user.recoveryCodes) ? user.recoveryCodes.filter((item): item is string => typeof item === "string") : [];
  const supplied = codeHash("recovery:" + user.id + ":" + value.toUpperCase());
  if (!codes.includes(supplied)) return false;
  const used = await prisma.user.updateMany({ where: { id: user.id, recoveryCodes: { equals: codes } }, data: { recoveryCodes: codes.filter((item) => item !== supplied) } });
  return used.count === 1;
}
