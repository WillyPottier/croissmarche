import { useQuery } from "@tanstack/react-query";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { formatEuros, formatNumber } from "@/src/format";
import { spacing, useTheme } from "@/src/theme";
import { Card, ErrorState, Loading, Pill, T } from "@/src/ui";

export default function Dashboard() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useQuery({ queryKey: ["admin-metrics"], queryFn: () => apiFetch("/admin/metrics") });

  if (q.isLoading) return <Loading testID="dashboard-loading" />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  const d: any = q.data;
  const maxR = Math.max(1, ...d.perPartner.map((p: any) => p.redemptions));

  const Metric = ({ label, value, tid }: { label: string; value: string; tid: string }) => (
    <Card style={{ flex: 1 }} testID={tid}>
      <T variant="caption">{label}</T>
      <T variant="number" style={{ fontSize: 30, marginTop: 4, color: colors.brandPrimary }}>{value}</T>
    </Card>
  );

  return (
    <ScrollView
      testID="admin-dashboard"
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandSecondary} />}
    >
      <T variant="title">Croiss'Marche · Admin</T>

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Metric label="Marcheurs actifs" value={formatNumber(d.activeWalkers)} tid="metric-walkers" />
        <Metric label="Partenaires actifs" value={formatNumber(d.activePartners)} tid="metric-partners" />
      </View>
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Metric label="Contremarques validées" value={formatNumber(d.totalRedemptions)} tid="metric-redemptions" />
        <Card style={{ flex: 1 }} testID="metric-revenue">
          <T variant="caption">Revenu mensuel</T>
          <T variant="number" style={{ fontSize: 24, marginTop: 4, color: colors.success }}>{formatEuros(d.monthlyRevenueCents)}</T>
        </Card>
      </View>

      <T variant="subtitle" style={{ marginTop: spacing.sm }}>Validations par partenaire</T>
      <Card>
        {d.perPartner.map((p: any, i: number) => (
          <View key={i} style={{ marginBottom: i === d.perPartner.length - 1 ? 0 : spacing.md }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <T variant="label" style={{ flex: 1 }}>{p.businessName}</T>
              {p.plan === "PAUSED" ? <Pill label="EN PAUSE" tone="muted" /> : null}
              <T variant="number" style={{ marginLeft: spacing.sm }}>{formatNumber(p.redemptions)}</T>
            </View>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.surfaceTertiary, overflow: "hidden" }}>
              <View style={{ width: `${(p.redemptions / maxR) * 100}%`, height: "100%", backgroundColor: colors.brandPrimary }} />
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}
