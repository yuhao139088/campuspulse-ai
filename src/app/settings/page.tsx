import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Demo from "@/components/demo/settings";
import Production from "@/components/production/settings";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=%2Fsettings");
  return session.user.id === "demo-user" && process.env.DEMO_AUTH_ENABLED === "true" ? <Demo/> : <Production/>;
}
