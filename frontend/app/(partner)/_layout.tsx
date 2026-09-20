import { Stack } from "expo-router";

import { RoleGate } from "@/src/role-gate";

export default function PartnerLayout() {
  return (
    <RoleGate role="partner">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FDF8F0" } }} />
    </RoleGate>
  );
}
