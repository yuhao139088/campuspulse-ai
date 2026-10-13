import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Demo from "@/components/demo/reports";
import Production from "@/components/production/reports";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=%2Freports");
  return session.user.id === "demo-user" && process.env.DEMO_AUTH_ENABLED === "true" ? <Demo/> : <Production/>;
}
