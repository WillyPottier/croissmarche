import { useQuery } from "@tanstack/react-query";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { formatEuros, formatNumber } from "@/src/format";
import { radius, spacing, useTheme } from "@/src/theme";
import { Card, ErrorState, Loading, T } from "@/src/ui";

export default function Stats() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useQuery({ queryKey: ["partner-stats"], queryFn: () => apiFetch("/partner/stats") });

  if (q.isLoading) return <Loading testID="stats-loading" />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  const d: any = q.data;
  const total = Math.max(1, d.newCustomers + d.returningCustomers);
  const newPct = (d.newCustomers / total) * 100;

  return (
    <ScrollView
      testID="partner-stats"
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandSecondary} />}
    >
      <T variant="title">Ce mois-ci</T>

      {/* Headline metric: new vs returning — decides renewal */}
      <Card testID="headline-customers">
        <T variant="label" color={colors.muted}>NOUVEAUX CLIENTS AMENÉS</T>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, marginTop: spacing.xs }}>
          <T variant="display" color={colors.brandPrimary} style={{ fontSize: 64 }}>{formatNumber(d.newCustomers)}</T>
          <T variant="subtitle" color={colors.muted} style={{ marginBottom: 12 }}>nouveaux</T>
        </View>
        <T variant="body" color={colors.onSurfaceTertiary}>et {formatNumber(d.returningCustomers)} clients fidèles revenus</T>

        <View style={{ marginTop: spacing.md, height: 18, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, overflow: "hidden", flexDirection: "row" }}>
          <View style={{ width: `${newPct}%`, backgroundColor: colors.brandPrimary }} />
          <View style={{ flex: 1, backgroundColor: colors.brandSecondary }} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm }}>
          <T variant="caption" color={colors.brandPrimary}>■ Nouveaux</T>
          <T variant="caption" color={colors.brandSecondary}>■ Fidèles</T>
        </View>
      </Card>

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Card style={{ flex: 1 }} testID="stat-redemptions">
          <T variant="caption">Contremarques validées</T>
          <T variant="number" style={{ fontSize: 30, marginTop: 4 }}>{formatNumber(d.totalRedemptions)}</T>
        </Card>
        <Card style={{ flex: 1 }} testID="stat-revenue">
          <T variant="caption">CA minimum généré</T>
          <T variant="number" style={{ fontSize: 26, marginTop: 4, color: colors.success }}>{formatEuros(d.estimatedRevenueCents)}</T>
        </Card>
      </View>

      <Card testID="stat-balance">
        <T variant="subtitle">Rentabilité estimée</T>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md }}>
          <T variant="body" color={colors.onSurfaceTertiary}>CA minimum généré</T>
          <T variant="label" color={colors.success}>{formatEuros(d.estimatedRevenueCents)}</T>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm }}>
          <T variant="body" color={colors.onSurfaceTertiary}>Ce que tu paies (abonnement + validations)</T>
          <T variant="label" color={colors.error}>{formatEuros(d.partnerCostCents)}</T>
        </View>
        <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: spacing.md }} />
        <T variant="caption">
          Calcul basé sur {formatEuros(250)} d'achat minimum par contremarque. Le montant réel dépend du panier de chaque client.
        </T>
      </Card>
    </ScrollView>
  );
}
