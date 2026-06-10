import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListTablesQueryKey,
  RestaurantTable,
  useListTables,
  useOpenTable,
} from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";
import { formatCurrency, timeAgo } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  free: "Free",
  occupied: "Occupied",
  waiting_payment: "Pay",
  closed: "Closed",
};

function statusStyle(status: string, colors: ReturnType<typeof useColors>) {
  switch (status) {
    case "free":
      return { bg: colors.card, accent: colors.success, fg: colors.foreground };
    case "occupied":
      return {
        bg: colors.card,
        accent: colors.destructive,
        fg: colors.foreground,
      };
    case "waiting_payment":
      return {
        bg: colors.card,
        accent: colors.warning,
        fg: colors.foreground,
      };
    default:
      return {
        bg: colors.card,
        accent: colors.mutedForeground,
        fg: colors.foreground,
      };
  }
}

export default function TablesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const {
    data: tables = [],
    isLoading,
    isRefetching,
    refetch,
  } = useListTables({ query: { refetchInterval: 15000 } });

  const openTable = useOpenTable();

  const areas = useMemo(() => {
    const set = new Set<string>();
    tables.forEach((t) => t.areaName && set.add(t.areaName));
    return Array.from(set);
  }, [tables]);

  const [activeArea, setActiveArea] = useState<string | "all">("all");

  const filtered = useMemo(() => {
    if (activeArea === "all") return tables;
    return tables.filter((t) => t.areaName === activeArea);
  }, [tables, activeArea]);

  const goTo = (table: RestaurantTable) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    if (table.status === "free") {
      openTable.mutate(
        { id: table.id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getListTablesQueryKey(),
            });
            router.push(`/(app)/table/${table.id}`);
          },
          onError: (err: Error) => {
            Alert.alert("Could not open table", err.message);
          },
        },
      );
    } else {
      router.push(`/(app)/table/${table.id}`);
    }
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  if (isLoading) {
    return (
      <View
        style={[styles.center, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12 + webTopInset,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View>
          <Text
            style={[styles.greeting, { color: colors.mutedForeground }]}
          >
            {user?.role === "WAITER" ? "Floor" : user?.role}
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Tables
          </Text>
        </View>
        <View style={styles.legend}>
          <LegendDot color={colors.success} label="Free" colors={colors} />
          <LegendDot
            color={colors.destructive}
            label="Busy"
            colors={colors}
          />
          <LegendDot color={colors.warning} label="Pay" colors={colors} />
        </View>
      </View>

      {areas.length > 1 && (
        <View
          style={[
            styles.tabs,
            { backgroundColor: colors.background },
          ]}
        >
          <AreaChip
            label="All"
            active={activeArea === "all"}
            onPress={() => setActiveArea("all")}
            colors={colors}
          />
          {areas.map((a) => (
            <AreaChip
              key={a}
              label={a}
              active={activeArea === a}
              onPress={() => setActiveArea(a)}
              colors={colors}
            />
          ))}
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(t) => String(t.id)}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{
          padding: 16,
          gap: 12,
          paddingBottom: insets.bottom + 100,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather
              name="grid"
              size={36}
              color={colors.mutedForeground}
            />
            <Text
              style={[
                styles.emptyText,
                { color: colors.mutedForeground },
              ]}
            >
              No tables in this area
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const s = statusStyle(item.status, colors);
          return (
            <Pressable
              onPress={() => goTo(item)}
              testID={`table-${item.id}`}
              style={({ pressed }) => [
                styles.tile,
                {
                  backgroundColor: s.bg,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View
                style={[styles.statusBar, { backgroundColor: s.accent }]}
              />
              <View style={styles.tileBody}>
                <View style={styles.tileTopRow}>
                  <Text
                    style={[styles.tileNumber, { color: s.fg }]}
                  >
                    #{item.number}
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: s.accent + "22" },
                    ]}
                  >
                    <Text
                      style={[styles.statusPillText, { color: s.accent }]}
                    >
                      {STATUS_LABEL[item.status] ?? item.status}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.areaText,
                    { color: colors.mutedForeground },
                  ]}
                  numberOfLines={1}
                >
                  {item.areaName}
                </Text>

                {item.status !== "free" ? (
                  <View style={{ gap: 4, marginTop: 8 }}>
                    {item.openedByName ? (
                      <View style={styles.metaRow}>
                        <Feather
                          name="user"
                          size={12}
                          color={colors.mutedForeground}
                        />
                        <Text
                          style={[
                            styles.metaText,
                            { color: colors.mutedForeground },
                          ]}
                          numberOfLines={1}
                        >
                          {item.openedByName}
                        </Text>
                      </View>
                    ) : null}
                    {item.openedAt ? (
                      <View style={styles.metaRow}>
                        <Feather
                          name="clock"
                          size={12}
                          color={colors.mutedForeground}
                        />
                        <Text
                          style={[
                            styles.metaText,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          {timeAgo(item.openedAt)}
                        </Text>
                      </View>
                    ) : null}
                    {typeof item.currentTotal === "number" ? (
                      <Text
                        style={[styles.total, { color: colors.foreground }]}
                      >
                        {formatCurrency(item.currentTotal)}
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <Text
                    style={[
                      styles.availLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Tap to open
                  </Text>
                )}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function LegendDot({
  color,
  label,
  colors,
}: {
  color: string;
  label: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

function AreaChip({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors.card,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? colors.primaryForeground : colors.foreground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  greeting: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    letterSpacing: -0.5,
  },
  legend: { flexDirection: "row", gap: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontFamily: "Inter_500Medium", fontSize: 11 },
  tabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  tile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  statusBar: { height: 4, width: "100%" },
  tileBody: { padding: 14, minHeight: 130 },
  tileTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tileNumber: { fontFamily: "Inter_700Bold", fontSize: 24 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusPillText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  areaText: { fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 2 },
  metaRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  metaText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  total: { fontFamily: "Inter_700Bold", fontSize: 16, marginTop: 4 },
  availLabel: { fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 8 },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: { fontFamily: "Inter_500Medium", fontSize: 14 },
});
