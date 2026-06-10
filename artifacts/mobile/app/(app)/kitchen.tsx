import { Feather } from "@expo/vector-icons";
import {
  KitchenTicket,
  useListKitchenTickets,
} from "@workspace/api-client-react";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { timeAgo } from "@/lib/format";

const STATUS_META: Record<
  string,
  { label: string; tint: (c: ReturnType<typeof useColors>) => string }
> = {
  pending: { label: "Pending", tint: (c) => c.warning },
  preparing: { label: "Preparing", tint: (c) => c.primary },
  ready: { label: "Ready", tint: (c) => c.success },
  delivered: { label: "Delivered", tint: (c) => c.mutedForeground },
};

export default function KitchenScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const {
    data: tickets = [],
    isLoading,
    isRefetching,
    refetch,
  } = useListKitchenTickets({
    query: { refetchInterval: 8000 },
  });

  const active = tickets.filter((t) => t.status !== "delivered");
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
            Live
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Kitchen
          </Text>
        </View>
        <View style={styles.liveBadge}>
          <View
            style={[styles.liveDot, { backgroundColor: colors.success }]}
          />
          <Text
            style={[styles.liveLabel, { color: colors.mutedForeground }]}
          >
            Auto-updating
          </Text>
        </View>
      </View>

      <FlatList
        data={active}
        keyExtractor={(t) => String(t.id)}
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
              name="check-circle"
              size={42}
              color={colors.mutedForeground}
            />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              All clear
            </Text>
            <Text
              style={[styles.emptyText, { color: colors.mutedForeground }]}
            >
              No active tickets right now
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TicketCard ticket={item} colors={colors} />
        )}
      />
    </View>
  );
}

function TicketCard({
  ticket,
  colors,
}: {
  ticket: KitchenTicket;
  colors: ReturnType<typeof useColors>;
}) {
  const meta = STATUS_META[ticket.status] ?? STATUS_META.pending;
  const tint = meta.tint(colors);

  return (
    <View
      style={[
        cardStyles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[cardStyles.statusBar, { backgroundColor: tint }]} />
      <View style={cardStyles.body}>
        <View style={cardStyles.row}>
          <View>
            <Text
              style={[cardStyles.tableNumber, { color: colors.foreground }]}
            >
              Table #{ticket.tableNumber}
            </Text>
            <Text
              style={[cardStyles.waiter, { color: colors.mutedForeground }]}
            >
              {ticket.waiterName}
            </Text>
          </View>
          <View style={[cardStyles.pill, { backgroundColor: tint + "22" }]}>
            <Text style={[cardStyles.pillText, { color: tint }]}>
              {meta.label}
            </Text>
          </View>
        </View>

        <View style={cardStyles.itemsList}>
          {ticket.items?.map((it) => (
            <View key={it.id} style={cardStyles.itemRow}>
              <Text
                style={[cardStyles.qty, { color: colors.primary }]}
              >
                {it.quantity}×
              </Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    cardStyles.itemName,
                    { color: colors.foreground },
                  ]}
                >
                  {it.productName}
                </Text>
                {it.notes ? (
                  <Text
                    style={[
                      cardStyles.notes,
                      {
                        color: colors.foreground,
                        backgroundColor: colors.accent,
                      },
                    ]}
                  >
                    {it.notes}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        <View style={cardStyles.footer}>
          <Feather name="clock" size={12} color={colors.mutedForeground} />
          <Text
            style={[
              cardStyles.footerText,
              { color: colors.mutedForeground },
            ]}
          >
            {timeAgo(ticket.createdAt)}
          </Text>
        </View>
      </View>
    </View>
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
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveLabel: { fontFamily: "Inter_500Medium", fontSize: 12 },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
    gap: 8,
  },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  emptyText: { fontFamily: "Inter_500Medium", fontSize: 14 },
});

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  statusBar: { height: 4, width: "100%" },
  body: { padding: 16, gap: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tableNumber: { fontFamily: "Inter_700Bold", fontSize: 18 },
  waiter: { fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 2 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  itemsList: { gap: 8 },
  itemRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  qty: { fontFamily: "Inter_700Bold", fontSize: 16, minWidth: 28 },
  itemName: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  notes: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  footer: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerText: { fontFamily: "Inter_500Medium", fontSize: 12 },
});
