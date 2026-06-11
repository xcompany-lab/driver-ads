import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";

import {
  endTrackingSession,
  getTrackingStatus,
  listMyTrackableAssignments,
  signIn,
  signOut,
  startTrackingSession,
} from "./api";
import { requestLocationPermissions, startNativeLocationUpdates, stopNativeLocationUpdates } from "./location-service";
import { clearActiveTrackingSession, saveActiveTrackingSession } from "./tracking-storage";
import { supabase } from "./supabase";
import type { DriverAssignment, TrackingStatus } from "./types";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [assignments, setAssignments] = useState<DriverAssignment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<TrackingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () => assignments.find((item) => item.id === selectedId) ?? null,
    [assignments, selectedId],
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setAssignments([]);
      setSelectedId(null);
      setStatus(null);
      return;
    }
    refreshAssignments();
  }, [session]);

  useEffect(() => {
    if (selectedId) refreshStatus(selectedId);
  }, [selectedId]);

  async function refreshAssignments() {
    setLoading(true);
    try {
      const rows = await listMyTrackableAssignments();
      setAssignments(rows);
      setSelectedId((current) => current ?? rows[0]?.id ?? null);
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  async function refreshStatus(assignmentId = selectedId) {
    if (!assignmentId) return;
    try {
      setStatus(await getTrackingStatus(assignmentId));
    } catch (error) {
      showError(error);
    }
  }

  async function handleLogin() {
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    if (!selected) return;
    setBusy(true);
    try {
      await requestLocationPermissions();
      const sessionId = await startTrackingSession(selected.id);
      await saveActiveTrackingSession({
        sessionId,
        assignmentId: selected.id,
        startedAt: new Date().toISOString(),
      });
      await startNativeLocationUpdates();
      await refreshStatus(selected.id);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    const activeSession = status?.active_session_id;
    if (!activeSession) return;
    setBusy(true);
    try {
      await stopNativeLocationUpdates();
      await clearActiveTrackingSession();
      await endTrackingSession(activeSession);
      await refreshStatus();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await stopNativeLocationUpdates();
    await clearActiveTrackingSession();
    await signOut();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <View style={styles.card}>
          <Text style={styles.brand}>DRIVER ADS</Text>
          <Text style={styles.title}>Portal do motorista</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="E-mail"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />
          <TextInput
            placeholder="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />
          <PrimaryButton label="Entrar" onPress={handleLogin} disabled={busy || !email || !password} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>DRIVER ADS</Text>
            <Text style={styles.title}>Rastreamento operacional</Text>
          </View>
          <Pressable onPress={handleSignOut}>
            <Text style={styles.link}>Sair</Text>
          </Pressable>
        </View>

        {assignments.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.subtitle}>Nenhuma campanha elegivel</Text>
            <Text style={styles.muted}>Voce precisa ter um vinculo aceito ou ativo para iniciar o tracking.</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.subtitle}>Campanha vinculada</Text>
              {assignments.map((assignment) => (
                <Pressable
                  key={assignment.id}
                  onPress={() => setSelectedId(assignment.id)}
                  style={[styles.assignment, assignment.id === selectedId && styles.assignmentActive]}
                >
                  <Text style={styles.assignmentTitle}>{assignment.campaign?.name ?? "Campanha"}</Text>
                  <Text style={styles.muted}>
                    {assignment.vehicle?.plate ?? "-"} · {assignment.vehicle?.model ?? "veiculo"} · {assignment.status}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.subtitle}>Consentimento e sessao</Text>
              <Text style={styles.muted}>
                Ao iniciar, voce autoriza a Driver Ads a usar sua localizacao para analytics operacionais agregados da campanha.
              </Text>
              <View style={styles.metrics}>
                <Metric label="Km" value={formatKm(status?.total_distance_m ?? 0)} />
                <Metric label="Tempo" value={formatHours(status?.duration_seconds ?? 0)} />
                <Metric label="Pontos" value={String(status?.points_count ?? 0)} />
              </View>
              {status?.active_session_id ? (
                <PrimaryButton label="Encerrar rastreamento" onPress={handleStop} disabled={busy} danger />
              ) : (
                <PrimaryButton label="Iniciar rastreamento" onPress={handleStart} disabled={busy || !selected} />
              )}
              <Pressable onPress={() => refreshStatus()} style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>Atualizar status</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.primaryButton, danger && styles.dangerButton, disabled && styles.disabledButton]}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function showError(error: unknown) {
  const message = error instanceof Error ? error.message : "Falha inesperada.";
  Alert.alert("Driver Ads", message);
}

function formatKm(meters: number) {
  return `${(meters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}

function formatHours(seconds: number) {
  return `${(seconds / 3600).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#eef7ff",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef7ff",
  },
  content: {
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  brand: {
    color: "#0078ff",
    fontWeight: "800",
    letterSpacing: 0,
    marginBottom: 4,
  },
  title: {
    color: "#061a3a",
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: "#061a3a",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  muted: {
    color: "#52627a",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d5e1ee",
    padding: 16,
    gap: 12,
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c8d6e5",
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
  },
  assignment: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d5e1ee",
    padding: 12,
    gap: 4,
  },
  assignmentActive: {
    borderColor: "#0078ff",
    backgroundColor: "#eef7ff",
  },
  assignmentTitle: {
    color: "#061a3a",
    fontWeight: "700",
  },
  metrics: {
    flexDirection: "row",
    gap: 8,
  },
  metric: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#f3f8fd",
    padding: 10,
  },
  metricLabel: {
    color: "#52627a",
    fontSize: 11,
    fontWeight: "700",
  },
  metricValue: {
    color: "#061a3a",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#0078ff",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButton: {
    backgroundColor: "#ef4444",
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: "#0078ff",
    fontWeight: "700",
  },
  link: {
    color: "#061a3a",
    fontWeight: "700",
  },
});
