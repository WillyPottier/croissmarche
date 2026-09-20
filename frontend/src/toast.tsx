import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, radius, spacing } from "@/src/theme";

type Tone = "success" | "error" | "info";
type ToastState = { message: string; tone: Tone } | null;

const ToastContext = createContext<{ show: (m: string, t?: Tone) => void } | undefined>(undefined);

const BG: Record<Tone, string> = {
  success: "#4A7C3F",
  error: "#D9534F",
  info: "#2A1C10",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const timer = useRef<any>(null);

  const show = useCallback(
    (message: string, tone: Tone = "info") => {
      setToast({ message, tone });
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() =>
          setToast(null),
        );
      }, 3200);
    },
    [opacity],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: insets.top + spacing.sm,
            left: spacing.md,
            right: spacing.md,
            opacity,
            zIndex: 9999,
          }}
        >
          <View
            style={{
              backgroundColor: BG[toast.tone],
              borderRadius: radius.md,
              paddingVertical: 14,
              paddingHorizontal: spacing.md,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontFamily: fonts.text, fontWeight: "600", fontSize: 15 }}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
