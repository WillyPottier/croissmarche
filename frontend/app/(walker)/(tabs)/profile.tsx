import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { radius, spacing, useTheme } from "@/src/theme";
import { Button, Card, Pill, T } from "@/src/ui";
import { useToast } from "@/src/toast";

export default function Profile() {
  const { colors } = useTheme();
  const { user, logout, refresh } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    try {
      const data = await apiFetch<any>("/walker/export");
      toast.show(`Données exportées : ${data.dailyStepTotals.length} jours, ${data.vouchers.length} contremarques.`, "success");
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };

  const onDelete = async () => {
    setBusy(true);
    try {
      await apiFetch("/walker/account", { method: "DELETE" });
      toast.show("Compte supprimé.", "success");
      await logout();
      router.replace("/(auth)/login");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const cancelPremium = async () => {
    setBusy(true);
    try {
      await apiFetch("/walker/premium/cancel", { method: "POST" });
      await refresh();
      qc.invalidateQueries();
      toast.show("Tu es repassé en formule gratuite.", "info");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      testID="walker-profile"
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}
    >
      <T variant="title">Profil</T>

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View
            style={{
              width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandTertiary,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <T variant="title" color={colors.brandSecondary}>{(user?.firstName || "?").slice(0, 1)}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T variant="subtitle">{user?.firstName}</T>
            <T variant="caption">{user?.email}</T>
          </View>
          <Pill label={user?.plan === "PREMIUM" ? "PREMIUM" : "GRATUIT"} tone={user?.plan === "PREMIUM" ? "warning" : "muted"} />
        </View>
      </Card>

      {user?.plan === "PREMIUM" ? (
        <Card>
          <T variant="subtitle">Formule Premium active</T>
          <T variant="body" color={colors.muted} style={{ marginTop: 4 }}>
            Tu gagnes tes Croissants Coins deux fois plus vite.
          </T>
          <Button title="Revenir à la formule gratuite" onPress={cancelPremium} variant="ghost" loading={busy} style={{ marginTop: spacing.sm }} />
        </Card>
      ) : (
        <Button testID="open-premium" title="Découvrir Premium" onPress={() => router.push("/(walker)/premium" as any)} />
      )}

      <T variant="subtitle" style={{ marginTop: spacing.sm }}>Mes données (RGPD)</T>
      <Card>
        <T variant="body" color={colors.onSurfaceTertiary}>
          Seul ton total quotidien de pas est stocké, jamais ta localisation.
        </T>
        <Button testID="export-data" title="Exporter mes données" onPress={onExport} variant="secondary" style={{ marginTop: spacing.md }} />
        {!confirmDelete ? (
          <Button testID="delete-account" title="Supprimer mon compte" onPress={() => setConfirmDelete(true)} variant="ghost" style={{ marginTop: spacing.sm }} />
        ) : (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md }}>
            <T variant="label" color={colors.error}>Cette action est définitive.</T>
            <Button testID="confirm-delete" title="Oui, supprimer définitivement" onPress={onDelete} variant="danger" loading={busy} />
            <Button title="Annuler" onPress={() => setConfirmDelete(false)} variant="ghost" />
          </View>
        )}
      </Card>

      <Button testID="logout" title="Se déconnecter" onPress={async () => { await logout(); router.replace("/(auth)/login"); }} variant="ghost" />
    </ScrollView>
  );
}
