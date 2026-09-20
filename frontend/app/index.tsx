import { Redirect } from "expo-router";

import { useAuth, roleHome } from "@/src/auth";
import { Loading } from "@/src/ui";

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return <Loading testID="boot-loading" />;
  if (!user) return <Redirect href="/(auth)/login" />;
  return <Redirect href={roleHome[user.role] as any} />;
}
