import "next-auth";
import "next-auth/jwt";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      authVersion?: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth" {
  interface User { authVersion?: number; }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    authVersion?: number;
  }
}
