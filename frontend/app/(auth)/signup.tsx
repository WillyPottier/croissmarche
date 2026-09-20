import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth, roleHome } from "@/src/auth";
import { radius, spacing, useTheme } from "@/src/theme";
import { Button, Field, T } from "@/src/ui";
import { useToast } from "@/src/toast";

export default function Signup() {
  const { signup } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSignup = async () => {
    if (!firstName || !email || password.length < 6) {
      toast.show("Prénom, email et mot de passe (6+ caractères) requis.", "error");
      return;
    }
    if (!consent) {
      toast.show("Le consentement RGPD est obligatoire.", "error");
      return;
    }
    setLoading(true);
    try {
      const u = await signup(email.trim(), password, firstName.trim(), consent);
      router.replace(roleHome[u.role] as any);
    } catch (e: any) {
      toast.show(e.message || "Inscription impossible.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
      bottomOffset={20}
    >
      <Pressable testID="back-to-login" onPress={() => router.back()} style={{ paddingVertical: spacing.xs }}>
        <T variant="label" color={colors.brandSecondary}>‹ Retour</T>
      </Pressable>

      <T variant="title">Créer un compte</T>
      <T variant="body" color={colors.muted}>
        On importe tes 7 derniers jours de marche pour démarrer avec un solde.
      </T>

      <Field testID="signup-firstname" label="Prénom" value={firstName} onChangeText={setFirstName} placeholder="Marie" />
      <Field
        testID="signup-email"
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="marie@exemple.fr"
      />
      <Field
        testID="signup-password"
        label="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="6 caractères minimum"
      />

      <Pressable
        testID="signup-consent"
        onPress={() => setConsent((v) => !v)}
        style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", paddingVertical: spacing.xs }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: radius.sm,
            borderWidth: 2,
            borderColor: consent ? colors.brandPrimary : colors.border,
            backgroundColor: consent ? colors.brandPrimary : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {consent ? <T variant="label" color={colors.onBrandPrimary}>✓</T> : null}
        </View>
        <T variant="caption" style={{ flex: 1, lineHeight: 18 }}>
          J'accepte que Croiss'Marche stocke mon total quotidien de pas (jamais ma localisation)
          pour calculer mes Croissants Coins. Je peux exporter ou supprimer mes données à tout moment.
        </T>
      </Pressable>

      <Button testID="signup-submit" title="Créer mon compte" onPress={onSignup} loading={loading} />
    </KeyboardAwareScrollView>
  );
}
