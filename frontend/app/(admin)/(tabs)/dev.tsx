import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { formatNumber } from "@/src/format";
import { radius, spacing, useTheme } from "@/src/theme";
import { Button, Card, Field, Loading, Pill, T } from "@/src/ui";
import { useToast } from "@/src/toast";

export default function Dev() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();

  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => apiFetch<any[]>("/admin/users") });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [steps, setSteps] = useState("8000");
  const [days, setDays] = useState("7");
  const [ageAmount, setAgeAmount] = useState("100");
  const [ageMonths, setAgeMonths] = useState("7");

  const selected = (users.data || []).find((u) => u.id === selectedId) || users.data?.[0];
  const uid = selected?.id;

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-metrics"] });
  };

  const call = (path: string, body: any, msg: (r: any) => string) =>
    apiFetch(path, { method: "POST", body }).then((r: any) => {
      refreshAll();
      toast.show(msg(r), "success");
    }).catch((e: any) => toast.show(e.message, "error"));

  const setSteps_ = useMutation({ mutationFn: () => call("/admin/dev/set-steps", { userId: uid, steps: parseInt(steps, 10) || 0 }, (r) => `Aujourd'hui : ${formatNumber(r.steps)} pas → +${r.ccEarned} CC`) });
  const backfill = useMutation({ mutationFn: () => call("/admin/dev/backfill", { userId: uid, days: parseInt(days, 10) || 7 }, (r) => `${r.days} jours remplis (+${r.ccAdded} CC)`) });
  const setPlan = useMutation({ mutationFn: () => call("/admin/dev/set-plan", { userId: uid, plan: selected?.plan === "PREMIUM" ? "FREE" : "PREMIUM" }, (r) => `Passé en ${r.plan}`) });
  const ageCC = useMutation({ mutationFn: () => call("/admin/dev/age-cc", { userId: uid, amount: parseInt(ageAmount, 10) || 0, monthsAgo: parseInt(ageMonths, 10) || 7 }, (r) => `CC injectés (${r.injectedMonthsAgo} mois). Solde utilisable : ${r.spendableBalance}`) });
  const notif = useMutation({ mutationFn: () => call("/admin/notifications/run-daily", {}, (r) => `${r.queued} notifications de fin de journée générées (envoi simulé)`) });

  if (users.isLoading) return <Loading testID="dev-loading" />;

  return (
    <KeyboardAwareScrollView
      testID="admin-dev"
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
      bottomOffset={20}
    >
      <View style={{ paddingHorizontal: spacing.lg }}>
        <T variant="title">Panneau dev</T>
        <T variant="caption">Source de pas simulée · réservé à l'admin</T>
      </View>

      {/* User picker (horizontal chip row) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }} style={{ maxHeight: 56 }}>
        {(users.data || []).map((u) => {
          const on = u.id === uid;
          return (
            <Pressable
              key={u.id}
              testID={`dev-user-${u.id}`}
              onPress={() => setSelectedId(u.id)}
              style={{ flexShrink: 0, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, justifyContent: "center", backgroundColor: on ? colors.brandPrimary : colors.surfaceTertiary }}
            >
              <T variant="label" color={on ? colors.onBrandPrimary : colors.onSurfaceTertiary}>{u.firstName}</T>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <T variant="subtitle">{selected?.firstName}</T>
            <Pill label={selected?.plan} tone={selected?.plan === "PREMIUM" ? "warning" : "muted"} />
          </View>
          <T variant="number" color={colors.brandPrimary} style={{ marginTop: 4 }}>{formatNumber(selected?.ccBalance ?? 0)} CC</T>
        </Card>

        <Card>
          <T variant="label">Pas d'aujourd'hui</T>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, alignItems: "flex-end" }}>
            <View style={{ flex: 1 }}><Field testID="dev-steps" value={steps} onChangeText={setSteps} keyboardType="number-pad" /></View>
            <Button testID="dev-set-steps" title="Appliquer" onPress={() => setSteps_.mutate()} loading={setSteps_.isPending} style={{ minHeight: 50, paddingHorizontal: spacing.md }} />
          </View>
        </Card>

        <Card>
          <T variant="label">Remplir l'historique (jours passés)</T>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, alignItems: "flex-end" }}>
            <View style={{ flex: 1 }}><Field testID="dev-days" value={days} onChangeText={setDays} keyboardType="number-pad" /></View>
            <Button testID="dev-backfill" title="Remplir" onPress={() => backfill.mutate()} loading={backfill.isPending} style={{ minHeight: 50, paddingHorizontal: spacing.md }} />
          </View>
        </Card>

        <Card>
          <T variant="label">Formule</T>
          <Button testID="dev-toggle-plan" title={`Basculer en ${selected?.plan === "PREMIUM" ? "FREE" : "PREMIUM"}`} onPress={() => setPlan.mutate()} loading={setPlan.isPending} variant="secondary" style={{ marginTop: spacing.sm }} />
        </Card>

        <Card>
          <T variant="label">Vieillir des CC (test expiration 6 mois)</T>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            <View style={{ flex: 1 }}><Field testID="dev-age-amount" label="Montant CC" value={ageAmount} onChangeText={setAgeAmount} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><Field testID="dev-age-months" label="Il y a (mois)" value={ageMonths} onChangeText={setAgeMonths} keyboardType="number-pad" /></View>
          </View>
          <Button testID="dev-age-cc" title="Injecter" onPress={() => ageCC.mutate()} loading={ageCC.isPending} variant="secondary" style={{ marginTop: spacing.sm }} />
        </Card>

        <Card>
          <T variant="label">Notification de fin de journée</T>
          <T variant="caption" style={{ marginTop: 2 }}>Un déclencheur par jour, toujours avec un chiffre. Envoi simulé (stub).</T>
          <Button testID="dev-run-notif" title="Générer les notifications" onPress={() => notif.mutate()} loading={notif.isPending} style={{ marginTop: spacing.sm }} />
        </Card>
      </View>
    </KeyboardAwareScrollView>
  );
}
