import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { formatCC, formatSteps } from "@/src/format";
import { radius, spacing, useTheme } from "@/src/theme";
import { Card, ErrorState, Loading, Pill, T } from "@/src/ui";

const MAP_URL =
  "https://staticmap.openstreetmap.de/staticmap.php?center=42.6986,2.8954&zoom=14&size=640x300&maptype=mapnik" +
  "&markers=42.6994,2.8946,lightblue1&markers=42.7020,2.8955,lightblue1&markers=42.6962,2.8790,lightblue1" +
  "&markers=42.6975,2.8925,lightblue1&markers=42.6930,2.8968,lightblue1&markers=42.7098,2.8852,lightblue1";

export default function Home() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const home = useQuery({ queryKey: ["walker-home"], queryFn: () => apiFetch("/walker/home") });
  const partners = useQuery({ queryKey: ["walker-partners"], queryFn: () => apiFetch<any[]>("/walker/partners") });

  if (home.isLoading) return <Loading testID="home-loading" />;
  if (home.isError) return <ErrorState message={(home.error as any)?.message} onRetry={() => home.refetch()} />;

  const d: any = home.data;
  const progress = Math.max(0, Math.min(1, d.progress));

  return (
    <ScrollView
      testID="walker-home"
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingBottom: spacing.xl }}
      refreshControl={
        <RefreshControl
          refreshing={home.isFetching || partners.isFetching}
          onRefresh={() => {
            home.refetch();
            partners.refetch();
          }}
          tintColor={colors.brandSecondary}
        />
      }
    >
      {/* Hero — answers "how far am I from my next pastry?" instantly */}
      <View
        style={{
          backgroundColor: colors.brandSecondary,
          paddingTop: insets.top + spacing.md,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xl,
          borderBottomLeftRadius: radius.lg,
          borderBottomRightRadius: radius.lg,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <T variant="caption" color={colors.brandTertiary}>BONJOUR {(user?.firstName || "").toUpperCase()}</T>
          {d.plan === "PREMIUM" ? <Pill label="PREMIUM" tone="warning" /> : null}
        </View>

        <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: spacing.md }}>
          <T variant="display" color={colors.onBrandSecondary} style={{ fontSize: 76, lineHeight: 78 }}>
            {formatCC(d.ccBalance)}
          </T>
          <T variant="subtitle" color={colors.brandTertiary} style={{ marginBottom: 12, marginLeft: 8 }}>CC</T>
        </View>
        <T variant="body" color={colors.brandTertiary}>Croissants Coins disponibles</T>

        {/* Progress to next voucher */}
        <View style={{ marginTop: spacing.lg }}>
          <View
            style={{
              height: 16,
              backgroundColor: "rgba(253,248,240,0.25)",
              borderRadius: radius.pill,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${progress * 100}%`,
                height: "100%",
                backgroundColor: colors.brandPrimary,
                borderRadius: radius.pill,
              }}
            />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm }}>
            <T variant="caption" color={colors.onBrandSecondary}>
              {formatCC(d.ccBalance)} / {d.voucherCost} CC
            </T>
            <T variant="caption" color={colors.brandTertiary}>1 contremarque = {d.voucherCost} CC</T>
          </View>
        </View>

        <View
          style={{
            marginTop: spacing.md,
            backgroundColor: "rgba(253,248,240,0.14)",
            borderRadius: radius.md,
            paddingVertical: 12,
            paddingHorizontal: spacing.md,
          }}
        >
          <T variant="subtitle" color={colors.onBrandSecondary} style={{ fontSize: 18 }}>
            {d.ccNeeded === 0 ? "🥐 " : ""}{d.sentence}
          </T>
        </View>
      </View>

      {/* Today */}
      <View style={{ flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
        <Card style={{ flex: 1 }} testID="today-steps">
          <T variant="caption">Pas aujourd'hui</T>
          <T variant="number" style={{ fontSize: 28, marginTop: 4 }}>{formatSteps(d.stepsToday)}</T>
        </Card>
        <Card style={{ flex: 1 }} testID="today-cc">
          <T variant="caption">CC gagnés aujourd'hui</T>
          <T variant="number" style={{ fontSize: 28, marginTop: 4, color: colors.brandPrimary }}>
            +{formatCC(d.ccToday)}
          </T>
        </Card>
      </View>

      {/* Mini-map (visual marker only) */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
        <View style={{ borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
          <Image source={{ uri: MAP_URL }} style={{ width: "100%", height: 150 }} contentFit="cover" transition={200} />
          <LinearGradient
            colors={["transparent", "rgba(42,28,16,0.75)"]}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 0, justifyContent: "flex-end", padding: spacing.md }}
          >
            <T variant="subtitle" color="#FDF8F0">Boulangeries près de toi</T>
            <T variant="caption" color="#F2D9B0">Perpignan · triées par distance</T>
          </LinearGradient>
        </View>
      </View>

      {/* Partner list */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.md }}>
        {partners.isLoading ? (
          <Loading />
        ) : (
          (partners.data || []).map((p: any) => (
            <Pressable
              key={p.id}
              testID={`partner-row-${p.id}`}
              onPress={() => router.push(`/(walker)/partner/${p.id}` as any)}
            >
              <Card>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <T variant="subtitle" style={{ fontSize: 18 }}>{p.businessName}</T>
                    <T variant="caption" style={{ marginTop: 2 }}>
                      {p.walkMinutes} min à pied · {formatSteps(p.distanceM)} m
                    </T>
                  </View>
                  <Pill
                    label={p.availableNow ? "Disponible maintenant" : `Dès ${String(p.offPeakStart).replace(":", "h")}`}
                    tone={p.availableNow ? "success" : "muted"}
                  />
                </View>
                <T variant="body" color={colors.onSurfaceTertiary} style={{ marginTop: spacing.sm }}>
                  {p.reward}
                </T>
                <T variant="caption" style={{ marginTop: 4 }}>Créneau {p.windowText}</T>
              </Card>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}
