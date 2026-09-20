import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth, roleHome } from "@/src/auth";
import { spacing, radius, useTheme } from "@/src/theme";
import { Button, Field, T } from "@/src/ui";
import { useToast } from "@/src/toast";

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!email || !password) {
      toast.show("Renseigne ton email et ton mot de passe.", "error");
      return;
    }
    setLoading(true);
    try {
      const u = await login(email.trim(), password);
      router.replace(roleHome[u.role] as any);
    } catch (e: any) {
      toast.show(e.message || "Connexion impossible.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      bottomOffset={20}
    >
      <View
        style={{
          backgroundColor: colors.brandSecondary,
          paddingTop: insets.top + spacing.xl,
          paddingBottom: spacing.xxl,
          paddingHorizontal: spacing.lg,
          borderBottomLeftRadius: radius.lg,
          borderBottomRightRadius: radius.lg,
        }}
      >
        <T variant="caption" color={colors.brandTertiary}>BOULANGERIES PARTENAIRES · PERPIGNAN</T>
        <T variant="display" color={colors.onBrandSecondary} style={{ marginTop: spacing.sm }}>
          Croiss'Marche
        </T>
        <T variant="body" color={colors.brandTertiary} style={{ marginTop: spacing.sm }}>
          Marche, gagne des Croissants Coins, savoure une viennoiserie.
        </T>
      </View>

      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <T variant="title">Connexion</T>
        <Field
          testID="login-email"
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="marie@croissmarche.fr"
        />
        <Field
          testID="login-password"
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />
        <Button testID="login-submit" title="Se connecter" onPress={onLogin} loading={loading} />

        <Pressable testID="go-signup" onPress={() => router.push("/(auth)/signup")} style={{ paddingVertical: spacing.sm }}>
          <T variant="body" color={colors.brandSecondary} style={{ textAlign: "center" }}>
            Pas encore de compte ? <T variant="label" color={colors.brandPrimary}>Créer un compte</T>
          </T>
        </Pressable>

        <View
          style={{
            marginTop: spacing.sm,
            backgroundColor: colors.surfaceTertiary,
            borderRadius: radius.md,
            padding: spacing.md,
            gap: 4,
          }}
        >
          <T variant="label" color={colors.onSurfaceTertiary}>Comptes de démonstration</T>
          <T variant="caption">Marcheuse · marie@croissmarche.fr</T>
          <T variant="caption">Boulanger · contact@castillet.fr</T>
          <T variant="caption">Admin · admin@croissmarche.fr</T>
          <T variant="caption">Mot de passe commun · croissant123</T>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
