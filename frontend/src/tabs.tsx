import { Tabs } from "expo-router";
import { Platform, View } from "react-native";

import { fonts, useTheme } from "@/src/theme";

export type TabItem = { name: string; label: string };

export function RoleTabs({ items }: { items: TabItem[] }) {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          ...(Platform.OS === "web" ? { height: 66 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center", paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: fonts.text, fontWeight: "700", fontSize: 11.5 },
      }}
    >
      {items.map((it) => (
        <Tabs.Screen
          key={it.name}
          name={it.name}
          options={{
            title: it.label,
            tabBarIcon: ({ color, focused }) => (
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: focused ? color : "transparent",
                  borderWidth: 2,
                  borderColor: color,
                }}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
