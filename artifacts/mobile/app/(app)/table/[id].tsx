import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetTableQueryKey,
  getListKitchenTicketsQueryKey,
  getListTablesQueryKey,
  NewOrderItem,
  Product,
  useCreateOrder,
  useGetTable,
  useListCategories,
  useListProducts,
  usePatchOrderItems,
  useUpdateTableStatus,
} from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { formatCurrency } from "@/lib/format";

interface CartItem {
  cartId: string;
  product: Product;
  quantity: number;
  notes: string;
}

const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export default function TableOrderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id: string }>();
  const tableId = Number(params.id);

  const { data: table, isLoading: tableLoading } = useGetTable(tableId, {
    query: {
      enabled: Number.isFinite(tableId),
      refetchInterval: 12000,
    },
  });
  const { data: products = [] } = useListProducts();
  const { data: categories = [] } = useListCategories();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCat, setActiveCat] = useState<string>("all");
  const [editing, setEditing] = useState<CartItem | null>(null);
  const [editNotes, setEditNotes] = useState("");

  const filteredProducts = useMemo(
    () =>
      products.filter((p) => {
        if (!p.active) return false;
        if (activeCat === "all") return true;
        return String(p.categoryId) === activeCat;
      }),
    [products, activeCat],
  );

  const cartTotal = cart.reduce(
    (s, c) => s + c.product.price * c.quantity,
    0,
  );

  const existingOrder = table?.order;
  const isWaitingPayment = table?.status === "waiting_payment";

  const createOrder = useCreateOrder();
  const patchOrder = usePatchOrderItems();
  const updateStatus = useUpdateTableStatus();
  const sending = createOrder.isPending || patchOrder.isPending;

  const invalidateAll = () => {
    queryClient.invalidateQueries({
      queryKey: getGetTableQueryKey(tableId),
    });
    queryClient.invalidateQueries({ queryKey: getListTablesQueryKey() });
    queryClient.invalidateQueries({
      queryKey: getListKitchenTicketsQueryKey(),
    });
  };

  const addToCart = (product: Product) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setCart((prev) => {
      const found = prev.find(
        (c) => c.product.id === product.id && !c.notes,
      );
      if (found) {
        return prev.map((c) =>
          c.cartId === found.cartId
            ? { ...c, quantity: c.quantity + 1 }
            : c,
        );
      }
      return [
        ...prev,
        { cartId: newId(), product, quantity: 1, notes: "" },
      ];
    });
  };

  const updateQty = (cartId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.cartId === cartId
            ? { ...c, quantity: Math.max(0, c.quantity + delta) }
            : c,
        )
        .filter((c) => c.quantity > 0),
    );
  };

  const sendToKitchen = () => {
    if (cart.length === 0) return;
    const items: NewOrderItem[] = cart.map((c) => ({
      productId: c.product.id,
      quantity: c.quantity,
      notes: c.notes || undefined,
    }));

    const onDone = () => {
      setCart([]);
      invalidateAll();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    };
    const onErr = (err: Error) =>
      Alert.alert("Could not send order", err.message);

    if (existingOrder) {
      patchOrder.mutate(
        { id: existingOrder.id, data: { add: items } },
        { onSuccess: onDone, onError: onErr },
      );
    } else {
      createOrder.mutate(
        { data: { tableId, items } },
        { onSuccess: onDone, onError: onErr },
      );
    }
  };

  const requestPayment = () => {
    if (!existingOrder) {
      Alert.alert("Nothing to bill", "Send items to the kitchen first.");
      return;
    }
    Alert.alert(
      "Call cashier?",
      "Mark this table as waiting for payment.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call cashier",
          onPress: () => {
            updateStatus.mutate(
              { id: tableId, data: { status: "waiting_payment" } },
              {
                onSuccess: () => {
                  invalidateAll();
                  if (Platform.OS !== "web") {
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success,
                    );
                  }
                  Alert.alert("Cashier notified");
                },
                onError: (err: Error) =>
                  Alert.alert("Could not request payment", err.message),
              },
            );
          },
        },
      ],
    );
  };

  if (tableLoading || !table) {
    return (
      <View
        style={[styles.center, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const openNotesEditor = (item: CartItem) => {
    setEditing(item);
    setEditNotes(item.notes);
  };
  const saveNotes = () => {
    if (!editing) return;
    setCart((prev) =>
      prev.map((c) =>
        c.cartId === editing.cartId ? { ...c, notes: editNotes } : c,
      ),
    );
    setEditing(null);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior="padding"
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 10 + webTopInset,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
          testID="back"
        >
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.smallLabel, { color: colors.mutedForeground }]}
          >
            {table.areaName}
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Table #{table.number}
          </Text>
        </View>
        {isWaitingPayment ? (
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: colors.warning + "22" },
            ]}
          >
            <Text style={[styles.statusBadgeText, { color: colors.warning }]}>
              Waiting payment
            </Text>
          </View>
        ) : null}
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catRow}
      >
        <CatChip
          label="All"
          active={activeCat === "all"}
          onPress={() => setActiveCat("all")}
          colors={colors}
        />
        {categories.map((c) => (
          <CatChip
            key={c.id}
            label={c.name}
            active={activeCat === String(c.id)}
            onPress={() => setActiveCat(String(c.id))}
            colors={colors}
          />
        ))}
      </ScrollView>

      <FlatList
        data={filteredProducts}
        keyExtractor={(p) => String(p.id)}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{
          padding: 16,
          gap: 10,
          paddingBottom: 280,
        }}
        renderItem={({ item }) => (
          <Pressable
            disabled={isWaitingPayment}
            onPress={() => addToCart(item)}
            style={({ pressed }) => [
              styles.productCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: isWaitingPayment ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
            testID={`product-${item.id}`}
          >
            <Text
              style={[styles.productName, { color: colors.foreground }]}
              numberOfLines={2}
            >
              {item.name}
            </Text>
            <Text
              style={[styles.productPrice, { color: colors.primary }]}
            >
              {formatCurrency(item.price)}
            </Text>
          </Pressable>
        )}
        ListHeaderComponent={
          existingOrder && existingOrder.items.length > 0 ? (
            <View
              style={[
                styles.existingOrder,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.existingHeader}>
                <Feather name="check" size={14} color={colors.success} />
                <Text
                  style={[
                    styles.existingTitle,
                    { color: colors.foreground },
                  ]}
                >
                  Sent to kitchen
                </Text>
                <Text
                  style={[
                    styles.existingTotal,
                    { color: colors.foreground },
                  ]}
                >
                  {formatCurrency(existingOrder.total)}
                </Text>
              </View>
              {existingOrder.items.slice(0, 6).map((it) => (
                <View key={it.id} style={styles.existingRow}>
                  <Text
                    style={[
                      styles.existingQty,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {it.quantity}×
                  </Text>
                  <Text
                    style={[
                      styles.existingName,
                      { color: colors.foreground },
                    ]}
                    numberOfLines={1}
                  >
                    {it.productName}
                  </Text>
                  <Text
                    style={[
                      styles.existingPrice,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {formatCurrency(it.lineTotal)}
                  </Text>
                </View>
              ))}
              {existingOrder.items.length > 6 ? (
                <Text
                  style={[
                    styles.existingMore,
                    { color: colors.mutedForeground },
                  ]}
                >
                  +{existingOrder.items.length - 6} more
                </Text>
              ) : null}
            </View>
          ) : null
        }
      />

      {/* Bottom cart panel */}
      <View
        style={[
          styles.cartPanel,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        {cart.length > 0 ? (
          <ScrollView
            style={{ maxHeight: 160 }}
            contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
          >
            {cart.map((c) => (
              <View key={c.cartId} style={styles.cartRow}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.cartName,
                      { color: colors.foreground },
                    ]}
                    numberOfLines={1}
                  >
                    {c.product.name}
                  </Text>
                  <Pressable
                    onPress={() => openNotesEditor(c)}
                    hitSlop={6}
                  >
                    <Text
                      style={[
                        styles.cartNotes,
                        {
                          color: c.notes
                            ? colors.foreground
                            : colors.mutedForeground,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {c.notes || "+ Add note"}
                    </Text>
                  </Pressable>
                </View>
                <View
                  style={[
                    styles.qtyControl,
                    { backgroundColor: colors.background },
                  ]}
                >
                  <Pressable
                    hitSlop={8}
                    onPress={() => updateQty(c.cartId, -1)}
                    style={styles.qtyBtn}
                  >
                    <Feather
                      name="minus"
                      size={14}
                      color={colors.foreground}
                    />
                  </Pressable>
                  <Text
                    style={[styles.qtyText, { color: colors.foreground }]}
                  >
                    {c.quantity}
                  </Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() => updateQty(c.cartId, 1)}
                    style={styles.qtyBtn}
                  >
                    <Feather
                      name="plus"
                      size={14}
                      color={colors.foreground}
                    />
                  </Pressable>
                </View>
                <Text
                  style={[styles.cartLine, { color: colors.foreground }]}
                >
                  {formatCurrency(c.product.price * c.quantity)}
                </Text>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyCart}>
            <Text
              style={[
                styles.emptyCartText,
                { color: colors.mutedForeground },
              ]}
            >
              {isWaitingPayment
                ? "This table is waiting for payment"
                : "Tap a product to add it"}
            </Text>
          </View>
        )}

        <View style={styles.actionRow}>
          <Pressable
            onPress={sendToKitchen}
            disabled={cart.length === 0 || sending || isWaitingPayment}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: colors.primary,
                opacity:
                  cart.length === 0 || sending || isWaitingPayment
                    ? 0.4
                    : pressed
                      ? 0.85
                      : 1,
              },
            ]}
            testID="send-to-kitchen"
          >
            {sending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Feather
                  name="send"
                  size={16}
                  color={colors.primaryForeground}
                />
                <Text
                  style={[
                    styles.sendBtnText,
                    { color: colors.primaryForeground },
                  ]}
                >
                  Send {cart.length > 0 ? `· ${formatCurrency(cartTotal)}` : ""}
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={requestPayment}
            disabled={!existingOrder || isWaitingPayment || updateStatus.isPending}
            style={({ pressed }) => [
              styles.payBtn,
              {
                borderColor: colors.warning,
                opacity:
                  !existingOrder || isWaitingPayment
                    ? 0.4
                    : pressed
                      ? 0.85
                      : 1,
              },
            ]}
            testID="call-cashier"
          >
            <Feather
              name="dollar-sign"
              size={16}
              color={colors.warning}
            />
            <Text style={[styles.payBtnText, { color: colors.warning }]}>
              Cashier
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Notes modal */}
      <Modal
        visible={!!editing}
        animationType="fade"
        transparent
        onRequestClose={() => setEditing(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setEditing(null)}
        >
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text
              style={[styles.modalTitle, { color: colors.foreground }]}
            >
              Note for {editing?.product.name}
            </Text>
            <TextInput
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder="e.g. no onions, well done"
              placeholderTextColor={colors.mutedForeground}
              multiline
              autoFocus
              style={[
                styles.modalInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  borderColor: colors.input,
                },
              ]}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setEditing(null)}
                style={[styles.modalBtn, { borderColor: colors.border }]}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={saveNotes}
                style={[
                  styles.modalBtn,
                  { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                <Text
                  style={{
                    color: colors.primaryForeground,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  Save
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function CatChip({
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
        styles.catChip,
        {
          backgroundColor: active ? colors.primary : colors.card,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.catChipText,
          { color: active ? colors.primaryForeground : colors.foreground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 6,
  },
  backBtn: { padding: 6 },
  smallLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 22 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  catRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  catChipText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  productCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    minHeight: 84,
    justifyContent: "space-between",
    gap: 6,
  },
  productName: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  productPrice: { fontFamily: "Inter_700Bold", fontSize: 15 },
  existingOrder: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 6,
  },
  existingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  existingTitle: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  existingTotal: { fontFamily: "Inter_700Bold", fontSize: 14 },
  existingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  existingQty: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    minWidth: 26,
  },
  existingName: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13 },
  existingPrice: { fontFamily: "Inter_500Medium", fontSize: 13 },
  existingMore: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    marginTop: 4,
  },
  cartPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  cartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cartName: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  cartNotes: { fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 2 },
  qtyControl: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
  },
  qtyBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  qtyText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    minWidth: 18,
    textAlign: "center",
  },
  cartLine: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    minWidth: 56,
    textAlign: "right",
  },
  emptyCart: { paddingVertical: 8 },
  emptyCartText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    textAlign: "center",
  },
  actionRow: { flexDirection: "row", gap: 10 },
  sendBtn: {
    flex: 2,
    height: 50,
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnText: { fontFamily: "Inter_700Bold", fontSize: 15 },
  payBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  payBtnText: { fontFamily: "Inter_700Bold", fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  modalInput: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    textAlignVertical: "top",
  },
  modalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  modalBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
});
