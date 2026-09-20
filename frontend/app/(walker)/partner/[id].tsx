import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { formatEuros, formatPhone, formatSteps } from "@/src/format";
import { radius, spacing, useTheme } from "@/src/theme";
import { Button, Card, ErrorState, Loading, Pill, T } from "@/src/ui";
import { useToast } from "@/src/toast";

const VOUCHER_COST = 60;

export default function PartnerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["partner", id], queryFn: () => apiFetch(`/walker/partners/${id}`) });
  const home = useQuery({ queryKey: ["walker-home"], queryFn: () => apiFetch("/walker/home") });

  const create = useMutation({
    mutationFn: () => apiFetch("/walker/voucher", { method: "POST", body: { partnerId: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["walker-voucher"] });
      qc.invalidateQueries({ queryKey: ["walker-home"] });
      toast.show("Contremarque créée ! Présente ton code au comptoir.", "success");
      router.replace("/(walker)/(tabs)/voucher" as any);
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  if (q.isLoading) return <Loading testID="partner-loading" />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  const p: any = q.data;
  const balance = (home.data as any)?.ccBalance ?? 0;
  const canAfford = balance >= VOUCHER_COST;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        testID="partner-detail"
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: 160, gap: spacing.md }}
      >
        <Pressable testID="partner-back" onPress={() => router.back()} style={{ paddingVertical: spacing.xs }}>
          <T variant="label" color={colors.brandSecondary}>‹ Retour</T>
        </Pressable>

        <T variant="title">{p.businessName}</T>
        <Pill
          label={p.availableNow ? "Disponible maintenant" : `Utilisable dès ${String(p.offPeakStart).replace(":", "h")}`}
          tone={p.availableNow ? "success" : "muted"}
        />

        <Card>
          <T variant="label">Récompense</T>
          <T variant="body" color={colors.onSurfaceTertiary} style={{ marginTop: 4 }}>{p.reward}</T>
          <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: spacing.md }} />
          <T variant="label">Créneau d'utilisation</T>
          <T variant="body" color={colors.onSurfaceTertiary} style={{ marginTop: 4 }}>Contremarques acceptées {p.windowText}</T>
          <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: spacing.md }} />
          <T variant="label">Adresse</T>
          <T variant="body" color={colors.onSurfaceTertiary} style={{ marginTop: 4 }}>{p.address}</T>
          {p.phone ? <T variant="caption" style={{ marginTop: 4 }}>{formatPhone(p.phone)}</T> : null}
        </Card>

        <Card style={{ backgroundColor: colors.surfaceTertiary, borderColor: colors.surfaceTertiary }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <T variant="label" color={colors.onSurfaceTertiary}>Coût de la contremarque</T>
            <T variant="number" color={colors.brandSecondary}>{VOUCHER_COST} CC</T>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm }}>
            <T variant="label" color={colors.onSurfaceTertiary}>Ton solde</T>
            <T variant="number" color={canAfford ? colors.success : colors.error}>{formatSteps(balance)} CC</T>
          </View>
        </Card>

        {!p.availableNow ? (
          <T variant="caption" color={colors.error}>
            Cette boulangerie n'accepte les contremarques que {p.windowText}. Reviens pendant ce créneau pour ne pas gaspiller tes CC.
          </T>
        ) : null}
        <T variant="caption">Une contremarque est valable 10 minutes. Minimum {formatEuros(250)} d'achat.</T>
      </ScrollView>

      <View
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          paddingHorizontal: spacing.lg, paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
          borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
        }}
      >
        <Button
          testID="create-voucher"
          title={`Créer ma contremarque · ${VOUCHER_COST} CC`}
          onPress={() => create.mutate()}
          loading={create.isPending}
          disabled={!p.availableNow || !canAfford}
        />
      </View>
    </View>
  );
}
