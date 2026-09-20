import { Stack } from "expo-router";

import { RoleGate } from "@/src/role-gate";

export default function WalkerLayout() {
  return (
    <RoleGate role="walker">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FDF8F0" } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="partner/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="premium" options={{ presentation: "card" }} />
      </Stack>
    </RoleGate>
  );
}
