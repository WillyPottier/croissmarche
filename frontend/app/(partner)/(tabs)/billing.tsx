import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { formatEuros, formatNumber } from "@/src/format";
import { spacing, useTheme } from "@/src/theme";
import { Card, ErrorState, Loading, T } from "@/src/ui";

export default function Billing() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const router = useRouter();
  const q = useQuery({ queryKey: ["partner-billing"], queryFn: () => apiFetch("/partner/billing") });

  if (q.isLoading) return <Loading testID="billing-loading" />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  const d: any = q.data;

  const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm }}>
      <T variant={strong ? "subtitle" : "body"} color={strong ? colors.onSurface : colors.onSurfaceTertiary}>{label}</T>
      <T variant={strong ? "title" : "label"} color={strong ? colors.brandSecondary : colors.onSurface}>{value}</T>
    </View>
  );

  return (
    <ScrollView
      testID="partner-billing"
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}
    >
      <T variant="title">Facturation</T>
      <T variant="caption">Période {d.month}</T>

      <Card testID="billing-card">
        <Row label="Abonnement mensuel" value={formatEuros(d.subscriptionCents)} />
        <View style={{ height: 1, backgroundColor: colors.divider }} />
        <Row label={`Validations (${formatNumber(d.redemptionCount)} × ${formatEuros(100)})`} value={formatEuros(d.redemptionCents)} />
        <View style={{ height: 1, backgroundColor: colors.divider }} />
        <Row label="Total à régler" value={formatEuros(d.totalCents)} strong />
      </Card>

      <Card style={{ backgroundColor: colors.surfaceTertiary, borderColor: colors.surfaceTertiary }}>
        <T variant="body" color={colors.onSurfaceTertiary}>
          Tu paies {formatEuros(d.subscriptionCents)} d'abonnement plus {formatEuros(100)} par contremarque réellement validée. Aucune validation, aucun frais de validation.
        </T>
      </Card>

      <Pressable testID="partner-logout" onPress={async () => { await logout(); router.replace("/(auth)/login"); }} style={{ paddingVertical: spacing.md }}>
        <T variant="label" color={colors.error} style={{ textAlign: "center" }}>Se déconnecter</T>
      </Pressable>
    </ScrollView>
  );
}
