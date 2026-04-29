/**
 * app/(tabs)/index.tsx
 * Home screen — data + state only.
 *
 * UI components live in src/components/home/:
 *   types.ts        → AlertCardData, DispensePatientCard, WardFilterOption
 *   ActionItem.tsx  → quick-action grid button
 *   StatCard.tsx    → gradient stat card
 *   AlertCard.tsx   → urgent alert row
 *   PatientCard.tsx → patient card with tags and status chip
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../src/stores/authStore";
import { usePatientStore } from "../../src/stores/patientStore";
import { useMedicationStore } from "../../src/stores/medicationStore";
import { useNotificationStore } from "../../src/stores/notificationStore";
import { useHandoverStore } from "../../src/stores/handoverStore";
import { USE_MOCK, MOCK_HANDOVER } from "../../src/mocks";
import type { ShiftHandoversRow } from "../../src/types/database";
import { supabase } from "../../src/lib/supabase";
import type { WardsRow } from "../../src/types/database";
import { BottomNav } from "../../src/components/shared/BottomNav";
import { colors, typo } from "@/theme/typo";
import SystemIcon from "icons/SystemIcon";
import DoubleCheckIcon from "../../icons/DoubleCheckIcon";
import ScanMedicationIcon from "../../icons/ScanMedicationIcon";
import LowStockIcon from "../../icons/LowStockIcon";
import OrderIcon from "../../icons/OrderIcon";
import PillIcon from "../../icons/PillIcon";
import HourglassIcon from "../../icons/HourglassIcon";
import AlarmClockIcon from "../../icons/AlarmClockIcon";

import { ActionItem } from "../../src/components/home/ActionItem";
import { StatCard } from "../../src/components/home/StatCard";
import { AlertCard } from "../../src/components/home/AlertCard";
import { PatientCard } from "../../src/components/home/PatientCard";
import {
  type AlertCardData,
  type DispensePatientCard,
  type WardFilterOption,
} from "../../src/components/home/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHeaderDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function getDoseLabel(date: Date): string {
  const hour = date.getHours();
  if (hour < 11) return "Morning dose";
  if (hour < 15) return "Noon dose";
  if (hour < 20) return "Evening dose";
  return "Bedtime dose";
}

function getAge(dateOfBirth: string | null): string {
  if (!dateOfBirth) return "-";
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const month = now.getMonth() - dob.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < dob.getDate())) age--;
  return String(age);
}

function getFirstName(name: string | null | undefined): string {
  if (!name?.trim()) return "User";
  return name.trim().split(/\s+/)[0];
}

function formatWardLabel(wardId: string | null | undefined): string {
  if (!wardId) return "Ward";
  const normalized = wardId.trim().toLowerCase();
  if (normalized === "ward-a" || normalized === "a") return "Ward A";
  if (normalized === "ward-b" || normalized === "b") return "Ward B";
  const digitMatch = normalized.match(/(\d+)/);
  if (digitMatch) {
    const index = Number(digitMatch[1]);
    if (index >= 1 && index <= 26)
      return `Ward ${String.fromCharCode(64 + index)}`;
  }
  if (normalized.startsWith("ward")) return wardId.replace(/-/g, " ");
  return `Ward ${wardId}`;
}

function formatWardOptionLabel(
  wardId: string,
  ward?: Pick<WardsRow, "name" | "floor"> | null,
): string {
  const name = ward?.name?.trim() || formatWardLabel(wardId);
  const floor = ward?.floor?.trim();
  if (!floor) return name;
  return name.toLowerCase().includes(floor.toLowerCase())
    ? name
    : `${name} (${floor})`;
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const demoPatientCards: DispensePatientCard[] = [
  {
    id: "p1",
    name: "Mr. Somchai Wongsri",
    room: "Room A-102",
    age: "78",
    wardId: "ward-a",
    ward: "Ward A",
    tablets: "12 tablets",
    statusLabel: "Urgent",
    statusTone: "urgent",
    tags: ["• Risperidone 2 mg", "• Take with food", "• Metoprolol"],
    moreCount: 3,
  },
  {
    id: "p2",
    name: "Mrs. Polo Suksan",
    room: "Room B-201",
    age: "81",
    wardId: "ward-b",
    ward: "Ward B",
    tablets: "9 tablets",
    statusLabel: "Pending",
    statusTone: "pending",
    tags: ["• Amlodipine 5 mg (new)", "• Losartan 50 mg"],
    note: "⚠ Medication has been changed - please check before dispensing",
    moreCount: 4,
  },
  {
    id: "p3",
    name: "Mr. Mana Jai",
    room: "Room B-203",
    age: "69",
    wardId: "ward-b",
    ward: "Ward B",
    tablets: "5 tablets",
    statusLabel: "Dispensed",
    statusTone: "done",
    tags: ["• Dementia medication", "• Aspirin 81 mg"],
  },
];

const demoWardOptions: WardFilterOption[] = [
  { id: "ward-a", label: "Ward A", patientCount: 1 },
  { id: "ward-b", label: "Ward B", patientCount: 2 },
];

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { patients, fetchPatients } = usePatientStore();
  const {
    scheduleGroups,
    pendingCount,
    completedCount,
    fetchSchedule,
    skipDose,
    subscribeToRealtime,
  } = useMedicationStore();
  const { activeAlerts, fetchNotifications } = useNotificationStore();
  const {
    pending: pendingHandover,
    fetchPending,

    setPending,
  } = useHandoverStore();

  const [refreshing, setRefreshing] = useState(false);
  const [alertsExpanded, setAlertsExpanded] = useState(true);
  const [selectedWardFilter, setSelectedWardFilter] = useState("all");
  const [wardOptions, setWardOptions] = useState<WardFilterOption[]>([]);
  const [wardLabelById, setWardLabelById] = useState<Record<string, string>>(
    {},
  );

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const wardScope = user?.ward_id ?? "";

  const allTodayItems = scheduleGroups.flatMap((g) => g.items);
  const visualFallback =
    patients.length === 0 &&
    allTodayItems.length === 0 &&
    activeAlerts.length === 0;

  const fetchWardOptions = useCallback(
    async (scopeWardId: string) => {
      try {
        let wardsQuery = supabase
          .from("wards")
          .select("id, name, floor")
          .order("name");
        if (scopeWardId) wardsQuery = wardsQuery.eq("id", scopeWardId);

        const { data: wards, error } = await wardsQuery;
        if (error) throw error;

        if (!wards || wards.length === 0) {
          setWardOptions([]);
          setWardLabelById({});
          return;
        }

        const wardIds = wards.map((w) => w.id);

        const { data: patientRows } = await supabase
          .from("patients")
          .select("ward_id")
          .eq("status", "active")
          .in("ward_id", wardIds)
          .not("ward_id", "is", null);

        const counts = new Map<string, number>();
        for (const row of patientRows ?? []) {
          if (!row.ward_id) continue;
          counts.set(row.ward_id, (counts.get(row.ward_id) ?? 0) + 1);
        }

        const wardsById = new Map(
          wards.map((w) => [w.id, w as Pick<WardsRow, "name" | "floor">]),
        );
        const labels = Object.fromEntries(
          wardIds.map((id) => [id, formatWardOptionLabel(id, wardsById.get(id))]),
        );

        setWardLabelById(labels);
        setWardOptions(
          wards.map((w) => ({
            id: w.id,
            label: labels[w.id],
            patientCount: counts.get(w.id) ?? 0,
          })),
        );
      } catch {
        if (scopeWardId) {
          setWardOptions([
            {
              id: scopeWardId,
              label: formatWardLabel(scopeWardId),
              patientCount: patients.length,
            },
          ]);
          setWardLabelById({ [scopeWardId]: formatWardLabel(scopeWardId) });
        } else {
          setWardOptions([]);
          setWardLabelById({});
        }
      }
    },
    [patients.length],
  );

  const loadData = useCallback(async () => {
    if (!user) return;
    if (USE_MOCK) {
      setPending(MOCK_HANDOVER as unknown as ShiftHandoversRow);
    } else if (wardScope) {
      fetchPending(wardScope);
    }
    await Promise.all([
      fetchPatients(wardScope),
      fetchSchedule(wardScope, todayStr),
      fetchWardOptions(wardScope),
      user ? fetchNotifications(user.id) : Promise.resolve(),
    ]);
  }, [
    fetchNotifications,
    fetchPatients,
    fetchPending,
    fetchSchedule,
    fetchWardOptions,
    setPending,
    todayStr,
    user,
    wardScope,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const realtimeUnsubRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    realtimeUnsubRef.current?.();
    if (!wardScope) {
      realtimeUnsubRef.current = null;
      return;
    }
    realtimeUnsubRef.current = subscribeToRealtime(wardScope, todayStr);
    return () => {
      realtimeUnsubRef.current?.();
      realtimeUnsubRef.current = null;
    };
  }, [subscribeToRealtime, todayStr, wardScope]);

  useEffect(() => {
    if (wardOptions.length === 1) {
      setSelectedWardFilter(wardOptions[0].id);
      return;
    }
    if (
      selectedWardFilter !== "all" &&
      !wardOptions.some((o) => o.id === selectedWardFilter)
    )
      setSelectedWardFilter("all");
  }, [selectedWardFilter, wardOptions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const liveAlertCards = useMemo<AlertCardData[]>(() => {
    const patientNameById = new Map(patients.map((p) => [p.id, p.name]));
    return activeAlerts.slice(0, 2).map((alert, i) => ({
      id: alert.id,
      patientName: alert.patient_id
        ? (patientNameById.get(alert.patient_id) ?? `Patient ${i + 1}`)
        : `Patient ${i + 1}`,
      title: alert.title_th,
      medication: alert.body_th || "Medication alert",
      detail: i === 0 ? "Needs attention today" : "Follow up required",
      footnote: alert.body_th,
      cta: i === 0 ? "Notify 3 days in advance" : "Check before next dose",
      ctaTone: (i === 0 ? "danger" : "warning") as AlertCardData["ctaTone"],
    }));
  }, [activeAlerts, patients]);

  const livePatientCards = useMemo<DispensePatientCard[]>(() => {
    return patients
      .map((patient) => {
        const patientItems = allTodayItems.filter(
          (item) => item.patient_id === patient.id,
        );
        const pendingItems = patientItems.filter(
          (item) => item.status === "pending",
        );
        const confirmedItems = patientItems.filter(
          (item) => item.status === "confirmed",
        );
        const primaryItems = (
          pendingItems.length > 0 ? pendingItems : confirmedItems
        ).slice(0, 3);
        const statusTone: DispensePatientCard["statusTone"] =
          pendingItems.length > 1
            ? "urgent"
            : pendingItems.length === 1
              ? "pending"
              : "done";
        return {
          id: patient.id,
          name: patient.name,
          room: patient.room_number ? `Room ${patient.room_number}` : "No room",
          age: getAge(patient.date_of_birth),
          wardId: patient.ward_id,
          ward:
            wardLabelById[patient.ward_id] ?? formatWardLabel(patient.ward_id),
          tablets: `${Math.max(patientItems.length, 1) * 4} tablets`,
          statusLabel:
            statusTone === "urgent"
              ? "Urgent"
              : statusTone === "pending"
                ? "Pending"
                : "Dispensed",
          statusTone,
          tags: primaryItems.map((item) => item.medicine_name),
          note:
            statusTone === "urgent"
              ? "Medication has been changed - please check before dispensing"
              : undefined,
          moreCount:
            patientItems.length > primaryItems.length
              ? patientItems.length - primaryItems.length
              : undefined,
        };
      })
      .filter((p) => p.tags.length > 0)
      .sort(
        (a, b) =>
          ({ urgent: 0, pending: 1, done: 2 })[a.statusTone] -
          { urgent: 0, pending: 1, done: 2 }[b.statusTone],
      )
      .slice(0, 3);
  }, [allTodayItems, patients, wardLabelById]);

  const alertCards = liveAlertCards;
  const patientCards = visualFallback ? demoPatientCards : livePatientCards;
  const filterOptions = wardOptions.length > 0 ? wardOptions : (visualFallback ? demoWardOptions : []);
  const filteredPatientCards = patientCards.filter(
    (p) => selectedWardFilter === "all" || p.wardId === selectedWardFilter,
  );
  const visibleAlertCards = alertsExpanded ? alertCards : [];
  const totalRecipients = visualFallback ? 154 : patients.length;
  const distributedToday = visualFallback ? 34 : completedCount;
  const needsAttention = visualFallback ? 154 : pendingCount;
  const firstName = visualFallback ? "Peeraya" : getFirstName(user?.name);
  const unreadCount = visualFallback ? 1 : Math.max(activeAlerts.length, 0);

  const openNotifications = (filter?: "all" | "stock") =>
    router.push({
      pathname: "/notifications",
      params: filter && filter !== "all" ? { filter } : undefined,
    });

  const openPatientDetail = (patientId: string) =>
    router.push(`/patient/${patientId}`);

  const showPatientActions = (patient: DispensePatientCard) => {
    const pendingItems = allTodayItems.filter(
      (item) =>
        item.patient_id === patient.id &&
        item.status === "pending" &&
        !item.conflict_flag,
    );
    Alert.alert(patient.name, "Choose the next workflow for this patient.", [
      { text: "View Profile", onPress: () => openPatientDetail(patient.id) },
      { text: "Confirm Dose", onPress: () => router.push("/(tabs)/schedule") },
      {
        text:
          pendingItems.length > 0
            ? `Skip ${pendingItems.length} pending`
            : "Skip (no pending)",
        style: "destructive",
        onPress: () => {
          if (!user || pendingItems.length === 0) return;
          Alert.alert(
            "Skip pending doses?",
            `Mark all ${pendingItems.length} of today's pending doses for ${patient.name} as skipped?`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Skip all",
                style: "destructive",
                onPress: async () => {
                  let skipped = 0;
                  let failed = 0;
                  for (const item of pendingItems) {
                    try {
                      await skipDose(item, user.id);
                      skipped++;
                    } catch {
                      failed++;
                    }
                  }
                  await loadData();
                  Alert.alert(
                    "Skipped",
                    failed > 0
                      ? `Skipped ${skipped}; ${failed} failed.`
                      : `Skipped ${skipped} dose${skipped === 1 ? "" : "s"}.`,
                  );
                },
              },
            ],
          );
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const showAlertActions = (alert: AlertCardData) => {
    Alert.alert(alert.patientName, alert.title, [
      { text: "Open Alerts", onPress: () => openNotifications("all") },
      { text: "Open Ward", onPress: () => router.push("/patients") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FBF0E3" }}>
      <Tabs.Screen options={{ tabBarStyle: { display: "none" } }} />
      <SafeAreaView className="flex-1" edges={["left", "right"]}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: "#FBF0E3" }}
          contentContainerStyle={{
            paddingBottom: Math.max(16, insets.bottom + 16),
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#E8721A"
            />
          }
        >
          {/* ── Header gradient ── */}
          <LinearGradient
            colors={["#FBF0E3", "#F2A65A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ paddingTop: insets.top + 16, paddingBottom: 48 }}
            className="px-5"
          >
            <View className="flex-row items-start justify-between pt-1 px-6 py-3">
              <View className="flex-1 pr-4">
                <Text className="text-[14px] text-[#38332E]">
                  {getGreeting(today)}
                </Text>
                <View className="flex-row items-center mt-1">
                  <Text style={[typo.headlineSmall, { color: colors.text }]}>
                    {firstName}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color="#2E2C2A"
                    style={{ marginLeft: 3 }}
                  />
                </View>
                <View className="flex-row items-center mt-2">
                  <SystemIcon />
                  <Text className="text-[12px] text-[#2E2C2A] ml-1.5">
                    {formatHeaderDate(today)}
                  </Text>
                  <Text className="text-[12px] text-[#2E2C2A] font-bold ml-1.5">
                    • {getDoseLabel(today)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => openNotifications("all")}
                className="w-11 h-11 rounded-full bg-white items-center justify-center mt-1"
              >
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color="#2E2C2A"
                />
                {unreadCount > 0 ? (
                  <View className="absolute top-2 right-2 min-w-[14px] h-[14px] rounded-full bg-[#FF4E4E] items-center justify-center px-0.5">
                    <Text className="text-[9px] font-bold text-white">
                      {unreadCount}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>

            {/* Stat cards */}
            <View className="mt-5 px-5 flex-row gap-3">
              <View
                style={{
                  flex: 1,
                  backgroundColor: "white",
                  borderRadius: 18,
                  padding: 6,
                  shadowColor: "#000",
                  shadowOpacity: 0.06,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 3,
                }}
              >
                <StatCard
                  label="Total Recipients"
                  value={totalRecipients}
                  SvgIcon={PillIcon}
                  iconBg="#FFFFFF"
                  iconColor="#2E2C2A"
                  gradient={{
                    colors: ["#FFFFFF", "#F1F1F1"],
                    start: { x: 0, y: 1 },
                    end: { x: 0, y: 0 },
                  }}
                  onPress={() => router.push("/patients")}
                />
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: "white",
                  borderRadius: 18,
                  padding: 6,
                  shadowColor: "#000",
                  shadowOpacity: 0.06,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 3,
                }}
              >
                <StatCard
                  label="Distributed Today"
                  value={distributedToday}
                  SvgIcon={HourglassIcon}
                  iconBg="#FFFFFF"
                  iconColor="#1B8C67"
                  gradient={{
                    colors: ["#E3FCEA", "#E3FCEA00"],
                    start: { x: 0, y: 0 },
                    end: { x: 0, y: 1 },
                  }}
                  onPress={() => router.push("/schedule")}
                />
              </View>
            </View>
          </LinearGradient>

          {/* Needs Attention card */}
          <View className="mx-5 -mt-8 -mb-3">
            <LinearGradient
              colors={["#FFFFFF", "#FFE6E6"]}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 0 }}
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#F1F1F1",
                shadowColor: "#000",
                shadowOpacity: 0.08,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 6 },
                elevation: 4,
              }}
            >
              <TouchableOpacity
                onPress={() => router.push("/schedule")}
                activeOpacity={0.88}
                style={{
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    flex: 1,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: "white",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <AlarmClockIcon width={24} height={24} color="#FF6B6B" />
                  </View>
                  <View>
                    <Text
                      style={{
                        fontSize: 14,
                        color: "#2E2C2A",
                        fontWeight: "500",
                      }}
                    >
                      Needs Attention
                    </Text>
                    <Text
                      style={{
                        fontSize: 26,
                        fontWeight: "700",
                        color: "#FF5A52",
                        lineHeight: 32,
                      }}
                    >
                      {needsAttention}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#3E3A37" />
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* Pending handover banner */}
          {pendingHandover ? (
            <View className="px-4 pt-4">
              <TouchableOpacity
                onPress={() => router.push("/handover")}
                activeOpacity={0.9}
                style={{
                  flexDirection: "row",
                  backgroundColor: "#FFFFFF",
                  borderRadius: 16,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: "#EADBCB",
                  shadowColor: "#000",
                  shadowOpacity: 0.06,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 2,
                }}
              >
                <View style={{ width: 6, backgroundColor: "#C96B1A" }} />
                <View
                  style={{
                    flex: 1,
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: "#FFE6CC",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Ionicons
                      name="swap-horizontal"
                      size={22}
                      color="#8E4B14"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: "#8E4B14",
                        letterSpacing: 1,
                        textTransform: "uppercase",
                      }}
                    >
                      {(() => {
                        const h = new Date(
                          pendingHandover.shift_start,
                        ).getHours();
                        return h >= 6 && h < 14
                          ? "เวรเช้า / Morning shift"
                          : h >= 14 && h < 22
                            ? "เวรบ่าย / Afternoon shift"
                            : "เวรดึก / Night shift";
                      })()}
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: "#2E241B",
                        marginTop: 2,
                      }}
                    >
                      ยืนยันการรับเวร / Acknowledge handover
                    </Text>
                    {(() => {
                      const summary = pendingHandover.summary_json as
                        | Record<string, unknown>
                        | undefined;
                      const pending =
                        (summary?.pending_medications as unknown[] | undefined)
                          ?.length ?? 0;
                      return pending === 0 ? null : (
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#A3322A",
                            marginTop: 4,
                          }}
                        >
                          🔴 {pending} ยาค้าง / pending dose
                          {pending > 1 ? "s" : ""}
                        </Text>
                      );
                    })()}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#8E4B14" />
                </View>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Quick actions */}
          <View className="px-6 pt-6">
            <View className="flex-row justify-between mb-6">
              <ActionItem
                SvgIcon={DoubleCheckIcon}
                label={"Double\nCheck"}
                onPress={() => router.push("/schedule")}
              />
              <ActionItem
                SvgIcon={ScanMedicationIcon}
                label={"Scan\nMedication"}
                onPress={() => router.push("/scanner")}
              />
              <ActionItem
                SvgIcon={LowStockIcon}
                label={"Low Stock"}
                onPress={() => openNotifications("stock")}
              />
              <ActionItem
                SvgIcon={OrderIcon}
                label={"Order"}
                onPress={() => router.push("/report")}
              />
            </View>

            {/* Urgent alerts card */}
            <View className="bg-[#FFFDF9] rounded-[18px] p-4 shadow-sm mb-6">
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                  <Text className="text-[20px] mr-2">⚠️</Text>
                  <Text className="text-[16px] font-semibold text-[#262321]">
                    Urgent Alerts
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setAlertsExpanded((c) => !c)}
                  className="w-8 h-8 rounded-full bg-white border border-[#EFE6DB] items-center justify-center"
                >
                  <Ionicons
                    name={alertsExpanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color="#484440"
                  />
                </TouchableOpacity>
              </View>
              {visibleAlertCards.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onPress={() => openNotifications("all")}
                  onMorePress={() => showAlertActions(alert)}
                />
              ))}
              <TouchableOpacity
                onPress={() => openNotifications("all")}
                className="rounded-[12px] border border-[#E5DDD3] bg-white py-3 items-center"
              >
                <Text className="text-[14px] font-semibold text-[#343230]">
                  View All
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Patients to dispense */}
          <View className="bg-white pt-6 pb-4">
            <View className="px-6">
              <View className="flex-row items-center mb-4">
                <Text className="text-[20px] mr-2">💊</Text>
                <Text className="text-[16px] font-bold text-[#1E1C1A]">
                  Patients to Dispense Medication
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-4"
              >
                <View className="flex-row">
                  <TouchableOpacity
                    onPress={() => setSelectedWardFilter("all")}
                    className={`rounded-[10px] px-4 py-2.5 mr-2 flex-row items-center ${selectedWardFilter === "all" ? "bg-[#F5A74F]" : "bg-white border border-[#ECE4D9]"}`}
                  >
                    <Ionicons name="layers-outline" size={15} color="#1F1D1B" />
                    <Text className="text-[13px] text-[#1F1D1B] ml-2">
                      All Wards
                    </Text>
                  </TouchableOpacity>
                  {filterOptions.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => setSelectedWardFilter(option.id)}
                      className={`rounded-[10px] px-4 py-2.5 mr-2 flex-row items-center ${selectedWardFilter === option.id ? "bg-[#F5A74F]" : "bg-white border border-[#ECE4D9]"}`}
                    >
                      <Ionicons
                        name="layers-outline"
                        size={15}
                        color="#1F1D1B"
                      />
                      <Text className="text-[13px] text-[#1F1D1B] ml-2">
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {filteredPatientCards.map((patient) => (
                <PatientCard
                  key={patient.id}
                  patient={patient}
                  onPress={() => openPatientDetail(patient.id)}
                  onMorePress={() => showPatientActions(patient)}
                />
              ))}

              <TouchableOpacity
                onPress={() => router.push("/patients")}
                className="rounded-[12px] bg-[#F5A74F] py-4 items-center mt-2"
              >
                <Text className="text-[15px] font-semibold text-[#22201E]">
                  View All
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Floating voice button */}
      <TouchableOpacity
        accessibilityLabel="Voice assistant"
        onPress={() => router.push("/voice")}
        activeOpacity={0.85}
        style={{
          position: "absolute",
          right: 16,
          bottom: Math.max(70, insets.bottom + 70),
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: "#E8721A",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
          elevation: 6,
        }}
      >
        <Ionicons name="mic" size={26} color="#fff" />
      </TouchableOpacity>

      <BottomNav
        activeTab="home"
        onHome={() => router.replace("/(tabs)")}
        onWard={() => router.replace("/(tabs)/patients")}
        onProfile={() => router.replace("/(tabs)/settings")}
      />
    </View>
  );
}
