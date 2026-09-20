import { useQuery } from "@tanstack/react-query";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { formatCC, formatDate, formatDayLabel, formatSteps } from "@/src/format";
import { radius, spacing, useTheme } from "@/src/theme";
import { Card, ErrorState, Loading, Pill, T } from "@/src/ui";

const STATUS: Record<string, { label: string; tone: "success" | "muted" | "warning" }> = {
  REDEEMED: { label: "Utilisée", tone: "success" },
  ACTIVE: { label: "Active", tone: "warning" },
  EXPIRED: { label: "Expirée", tone: "muted" },
};

export default function History() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useQuery({ queryKey: ["walker-history"], queryFn: () => apiFetch("/walker/history") });

  if (q.isLoading) return <Loading testID="history-loading" />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  const data: any = q.data;

  return (
    <ScrollView
      testID="walker-history"
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandSecondary} />}
    >
      <T variant="title">Historique</T>

      <T variant="subtitle" style={{ marginTop: spacing.sm }}>Contremarques</T>
      {(data.vouchers || []).length === 0 ? (
        <T variant="caption">Aucune contremarque pour le moment.</T>
      ) : (
        data.vouchers.map((v: any) => {
          const st = STATUS[v.status] || STATUS.EXPIRED;
          return (
            <Card key={v.id} testID={`history-voucher-${v.id}`}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <T variant="label">{v.partnerName}</T>
                  <T variant="caption" style={{ marginTop: 2 }}>Code {v.code} · {formatDate(v.createdAt)}</T>
                </View>
                <Pill label={st.label} tone={st.tone} />
              </View>
            </Card>
          );
        })
      )}

      <T variant="subtitle" style={{ marginTop: spacing.md }}>Jours de marche</T>
      <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border }}>
        {(data.days || []).map((day: any, i: number) => (
          <View
            key={day.date}
            testID={`history-day-${day.date}`}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: 14,
              paddingHorizontal: spacing.md,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.divider,
            }}
          >
            <View>
              <T variant="label" style={{ textTransform: "capitalize" }}>{formatDayLabel(day.date)}</T>
              <T variant="caption" style={{ marginTop: 2 }}>{formatSteps(day.steps)} pas</T>
            </View>
            <T variant="number" color={colors.brandPrimary}>+{formatCC(day.ccEarned)} CC</T>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
