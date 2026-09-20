import { useQuery } from "@tanstack/react-query";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { formatNumber } from "@/src/format";
import { spacing, useTheme } from "@/src/theme";
import { Card, ErrorState, Loading, Pill, T } from "@/src/ui";

export default function Users() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useQuery({ queryKey: ["admin-users"], queryFn: () => apiFetch<any[]>("/admin/users") });

  if (q.isLoading) return <Loading testID="users-loading" />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  return (
    <ScrollView
      testID="admin-users"
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm }}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandSecondary} />}
    >
      <T variant="title" style={{ marginBottom: spacing.sm }}>Marcheurs ({q.data?.length ?? 0})</T>
      {(q.data || []).map((u) => (
        <Card key={u.id} testID={`admin-user-${u.id}`}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <T variant="label">{u.firstName}</T>
              <T variant="caption" style={{ marginTop: 2 }}>{u.email}</T>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <T variant="number" color={colors.brandPrimary}>{formatNumber(u.ccBalance)} CC</T>
              <Pill label={u.plan} tone={u.plan === "PREMIUM" ? "warning" : "muted"} />
            </View>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
