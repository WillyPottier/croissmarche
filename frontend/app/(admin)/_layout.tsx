import { Stack } from "expo-router";

import { RoleGate } from "@/src/role-gate";

export default function AdminLayout() {
  return (
    <RoleGate role="admin">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FDF8F0" } }} />
    </RoleGate>
  );
}
