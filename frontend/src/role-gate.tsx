import { Redirect } from "expo-router";
import React from "react";

import { Role, roleHome, useAuth } from "@/src/auth";
import { Loading } from "@/src/ui";

export function RoleGate({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading testID="role-loading" />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== role) return <Redirect href={roleHome[user.role] as any} />;
  return <>{children}</>;
}
