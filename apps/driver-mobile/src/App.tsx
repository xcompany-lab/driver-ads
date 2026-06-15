import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";

import {
  applyToCampaign,
  endTrackingSession,
  getCurrentUserId,
  getMyDriver,
  getMyPayoutMethod,
  getTrackingStatus,
  listAvailableCampaigns,
  listMyAssignments,
  listMyDriverPayouts,
  listMyVehicles,
  listProofsForAssignment,
  respondToAssignment,
  resolveVehicleTiers,
  saveVehicle,
  signIn,
  signOut,
  signUpDriver,
  startTrackingSession,
  updateMyDriver,
  uploadAvatar,
  uploadDriverDoc,
  uploadInstallationProof,
  uploadVehicleCrlv,
  upsertPayoutMethod,
  validatePixKey,
  type LocalUploadFile,
} from "./api";
import { requestLocationPermissions, startNativeLocationUpdates, stopNativeLocationUpdates } from "./location-service";
import { clearActiveTrackingSession, saveActiveTrackingSession } from "./tracking-storage";
import { supabase } from "./supabase";
import type {
  AvailableCampaign,
  Driver,
  DriverAssignment,
  DriverPayout,
  DriverPayoutMethod,
  PixKeyType,
  TrackingStatus,
  Vehicle,
} from "./types";

type Tab = "home" | "campaigns" | "tracking" | "earnings" | "profile";
type AuthMode = "login" | "signup";

const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "Inicio" },
  { id: "campaigns", label: "Campanhas" },
  { id: "tracking", label: "Tracking" },
  { id: "earnings", label: "Ganhos" },
  { id: "profile", label: "Perfil" },
];

const PIX_OPTIONS: { value: PixKeyType; label: string }[] = [
  { value: "cpf", label: "CPF" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "cnpj", label: "CNPJ" },
  { value: "random", label: "Aleatoria" },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [loading, setLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleTiers, setVehicleTiers] = useState<Record<string, string>>({});
  const [assignments, setAssignments] = useState<DriverAssignment[]>([]);
  const [availableCampaigns, setAvailableCampaigns] = useState<AvailableCampaign[]>([]);
  const [payoutMethod, setPayoutMethod] = useState<DriverPayoutMethod | null>(null);
  const [payouts, setPayouts] = useState<DriverPayout[]>([]);
  const [trackingAssignmentId, setTrackingAssignmentId] = useState<string | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus | null>(null);

  const trackableAssignments = useMemo(
    () => assignments.filter((item) => ["accepted", "awaiting_installation", "active"].includes(item.status)),
    [assignments],
  );
  const activeTrackingAssignment = useMemo(
    () => trackableAssignments.find((item) => item.id === trackingAssignmentId) ?? trackableAssignments[0] ?? null,
    [trackableAssignments, trackingAssignmentId],
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
      setDataReady(false);
      setLoadError(null);
      setDriver(null);
      setVehicles([]);
      setVehicleTiers({});
      setAssignments([]);
      setAvailableCampaigns([]);
      setPayoutMethod(null);
      setPayouts([]);
      setTrackingAssignmentId(null);
      setTrackingStatus(null);
      return;
    }
    refreshAll();
  }, [session]);

  useEffect(() => {
    const selectedId = activeTrackingAssignment?.id ?? null;
    if (!selectedId) {
      setTrackingStatus(null);
      return;
    }
    setTrackingAssignmentId(selectedId);
    refreshTrackingStatus(selectedId);
  }, [activeTrackingAssignment?.id]);

  async function refreshAll() {
    setRefreshing(true);
    setLoadError(null);
    try {
      const nextDriver = await getMyDriver();
      setDriver(nextDriver);
      if (!nextDriver?.id) {
        setVehicles([]);
        setVehicleTiers({});
        setAssignments([]);
        setAvailableCampaigns([]);
        setPayoutMethod(null);
        setPayouts([]);
        return;
      }

      const [vehiclesResult, assignmentsResult, availableResult, methodResult, payoutsResult] = await Promise.allSettled([
        listMyVehicles(nextDriver.id),
        listMyAssignments(nextDriver.id),
        listAvailableCampaigns(nextDriver.id),
        getMyPayoutMethod(nextDriver.id),
        listMyDriverPayouts(nextDriver.id),
      ]);

      const nextVehicles = resultValue(vehiclesResult, [] as Vehicle[]);
      setVehicles(nextVehicles);
      setAssignments(resultValue(assignmentsResult, [] as DriverAssignment[]));
      setAvailableCampaigns(resultValue(availableResult, [] as AvailableCampaign[]));
      setPayoutMethod(resultValue(methodResult, null as DriverPayoutMethod | null));
      setPayouts(resultValue(payoutsResult, [] as DriverPayout[]));

      try {
        setVehicleTiers(await resolveVehicleTiers(nextVehicles));
      } catch {
        setVehicleTiers({});
      }

      const failed = [vehiclesResult, assignmentsResult, availableResult, methodResult, payoutsResult].find(
        (item) => item.status === "rejected",
      );
      if (failed?.status === "rejected") {
        setLoadError(errorMessage(failed.reason));
      }
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setDataReady(true);
      setRefreshing(false);
      setLoading(false);
    }
  }

  async function refreshTrackingStatus(assignmentId = trackingAssignmentId) {
    if (!assignmentId) return;
    try {
      setTrackingStatus(await getTrackingStatus(assignmentId));
    } catch (error) {
      showError(error);
    }
  }

  async function handleStartTracking() {
    if (!activeTrackingAssignment) return;
    setBusy(true);
    try {
      await requestLocationPermissions();
      const sessionId = await startTrackingSession(activeTrackingAssignment.id);
      await saveActiveTrackingSession({
        sessionId,
        assignmentId: activeTrackingAssignment.id,
        startedAt: new Date().toISOString(),
      });
      await startNativeLocationUpdates();
      await refreshTrackingStatus(activeTrackingAssignment.id);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleStopTracking() {
    const activeSession = trackingStatus?.active_session_id;
    if (!activeSession) return;
    setBusy(true);
    try {
      await stopNativeLocationUpdates();
      await clearActiveTrackingSession();
      await endTrackingSession(activeSession);
      await refreshTrackingStatus();
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
    return <AuthScreen busy={busy} setBusy={setBusy} />;
  }

  if (!dataReady) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Carregando seus dados...</Text>
      </SafeAreaView>
    );
  }

  if (!driver) {
    return <DriverNotFoundScreen email={session.user.email ?? "conta atual"} onRefresh={refreshAll} onSignOut={handleSignOut} />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.topbar}>
        <View>
          <Text style={styles.brand}>DRIVER ADS</Text>
          <Text style={styles.topbarSubtitle}>Portal do motorista</Text>
        </View>
        <Pressable onPress={handleSignOut} style={styles.logoutButton}>
          <Text style={styles.link}>Sair</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
      >
        {loadError && (
          <View style={styles.noticeWarning}>
            <Text style={styles.noticeTitle}>Alguns dados nao carregaram</Text>
            <Text style={styles.muted}>{loadError}</Text>
          </View>
        )}
        {tab === "home" && (
          <HomeScreen
            driver={driver}
            vehicles={vehicles}
            assignments={assignments}
            availableCampaigns={availableCampaigns}
            payouts={payouts}
            setTab={setTab}
          />
        )}
        {tab === "campaigns" && (
          <CampaignsScreen
            driver={driver}
            vehicles={vehicles}
            vehicleTiers={vehicleTiers}
            assignments={assignments}
            availableCampaigns={availableCampaigns}
            busy={busy}
            setBusy={setBusy}
            onChanged={refreshAll}
          />
        )}
        {tab === "tracking" && (
          <TrackingScreen
            assignments={trackableAssignments}
            selected={activeTrackingAssignment}
            selectedId={trackingAssignmentId}
            setSelectedId={setTrackingAssignmentId}
            status={trackingStatus}
            busy={busy}
            onStart={handleStartTracking}
            onStop={handleStopTracking}
            onRefresh={() => refreshTrackingStatus()}
            onChanged={refreshAll}
          />
        )}
        {tab === "earnings" && (
          <EarningsScreen
            driver={driver}
            payoutMethod={payoutMethod}
            payouts={payouts}
            busy={busy}
            setBusy={setBusy}
            onChanged={refreshAll}
          />
        )}
        {tab === "profile" && (
          <ProfileScreen
            driver={driver}
            vehicles={vehicles}
            busy={busy}
            setBusy={setBusy}
            onChanged={refreshAll}
          />
        )}
      </ScrollView>

      <View style={styles.navbar}>
        {TABS.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setTab(item.id)}
            style={[styles.navItem, tab === item.id && styles.navItemActive]}
          >
            <Text style={[styles.navText, tab === item.id && styles.navTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function DriverNotFoundScreen({
  email,
  onRefresh,
  onSignOut,
}: {
  email: string;
  onRefresh: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.topbar}>
        <View>
          <Text style={styles.brand}>DRIVER ADS</Text>
          <Text style={styles.topbarSubtitle}>Portal do motorista</Text>
        </View>
        <Pressable onPress={onSignOut} style={styles.logoutButton}>
          <Text style={styles.link}>Sair</Text>
        </Pressable>
      </View>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.subtitle}>Perfil de motorista nao encontrado</Text>
          <Text style={styles.muted}>
            Voce esta logado como {email}, mas o app nao encontrou um registro de motorista vinculado a esta conta.
          </Text>
          <Text style={styles.muted}>
            Se voce acabou de trocar de conta no navegador, saia e entre novamente com o e-mail do motorista.
          </Text>
          <View style={styles.buttonRow}>
            <PrimaryButton label="Tentar novamente" onPress={onRefresh} compact />
            <SecondaryAction label="Sair" onPress={onSignOut} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function AuthScreen({ busy, setBusy }: { busy: boolean; setBusy: (value: boolean) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [form, setForm] = useState({
    fullName: "",
    cpf: "",
    city: "",
    phone: "",
    email: "",
    password: "",
  });

  async function submit() {
    setBusy(true);
    try {
      if (mode === "login") {
        await signIn(form.email.trim(), form.password);
      } else {
        await signUpDriver(form);
      }
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.authWrap}>
        <ScrollView contentContainerStyle={styles.authContent}>
          <Text style={styles.authBrand}>DRIVER ADS</Text>
          <View style={styles.authCard}>
            <Text style={styles.authTitle}>{mode === "login" ? "Entrar" : "Criar conta de motorista"}</Text>
            <Text style={styles.authSubtitle}>
              {mode === "login"
                ? "Acesse suas campanhas, ganhos e rastreamento."
                : "Cadastre-se para monetizar seu veiculo com campanhas Driver Ads."}
            </Text>

            {mode === "signup" && (
              <>
                <Field label="Nome completo" value={form.fullName} onChangeText={(v) => setForm({ ...form, fullName: v })} />
                <View style={styles.row}>
                  <Field label="CPF" value={form.cpf} onChangeText={(v) => setForm({ ...form, cpf: v })} keyboardType="number-pad" />
                  <Field label="Cidade" value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} />
                </View>
                <Field label="Telefone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
              </>
            )}

            <Field
              label="E-mail"
              value={form.email}
              onChangeText={(v) => setForm({ ...form, email: v })}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              label="Senha"
              value={form.password}
              onChangeText={(v) => setForm({ ...form, password: v })}
              secureTextEntry
            />
            <PrimaryButton
              label={mode === "login" ? "Entrar" : "Criar conta"}
              onPress={submit}
              disabled={busy || !form.email || !form.password}
            />
            <Pressable onPress={() => setMode(mode === "login" ? "signup" : "login")} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>
                {mode === "login" ? "Criar conta de motorista" : "Ja tenho conta"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function HomeScreen({
  driver,
  vehicles,
  assignments,
  availableCampaigns,
  payouts,
  setTab,
}: {
  driver: Driver | null;
  vehicles: Vehicle[];
  assignments: DriverAssignment[];
  availableCampaigns: AvailableCampaign[];
  payouts: DriverPayout[];
  setTab: (tab: Tab) => void;
}) {
  const activeAssignments = assignments.filter((item) => item.status === "active").length;
  const pendingDocs = driver
    ? ["cnh_front_status", "selfie_doc_status", "address_proof_status"].filter((key) => (driver as any)[key] !== "approved")
        .length
    : 0;

  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <Text style={styles.title}>Ola, {firstName(driver?.full_name)}</Text>
        <Text style={styles.muted}>Gerencie campanhas, auditoria, ganhos e rastreamento em um unico app.</Text>
      </View>

      {driver?.status !== "approved" && (
        <View style={styles.noticeWarning}>
          <Text style={styles.noticeTitle}>Cadastro em analise</Text>
          <Text style={styles.muted}>Complete documentos e veiculo. As campanhas liberam apos aprovacao.</Text>
        </View>
      )}

      <View style={styles.grid}>
        <DashboardCard label="Campanhas ativas" value={String(activeAssignments)} onPress={() => setTab("campaigns")} />
        <DashboardCard label="Disponiveis" value={String(availableCampaigns.length)} onPress={() => setTab("campaigns")} />
        <DashboardCard label="Veiculos" value={String(vehicles.length)} onPress={() => setTab("profile")} />
        <DashboardCard label="Docs pendentes" value={String(pendingDocs)} onPress={() => setTab("profile")} />
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>Resumo financeiro</Text>
        <Text style={styles.bigNumber}>{formatCurrency(payouts.reduce((sum, payout) => sum + Number(payout.amount || 0), 0))}</Text>
        <Text style={styles.muted}>Total registrado em repasses no painel.</Text>
      </View>
    </View>
  );
}

function CampaignsScreen({
  driver,
  vehicles,
  vehicleTiers,
  assignments,
  availableCampaigns,
  busy,
  setBusy,
  onChanged,
}: {
  driver: Driver | null;
  vehicles: Vehicle[];
  vehicleTiers: Record<string, string>;
  assignments: DriverAssignment[];
  availableCampaigns: AvailableCampaign[];
  busy: boolean;
  setBusy: (value: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  const [vehicleId, setVehicleId] = useState<string | null>(vehicles[0]?.id ?? null);
  const approvedVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.status === "approved" || vehicle.crlv_status === "approved"),
    [vehicles],
  );
  const blackVehicle = useMemo(
    () => approvedVehicles.find((vehicle) => vehicleTiers[vehicle.id] === "black") ?? null,
    [approvedVehicles, vehicleTiers],
  );

  useEffect(() => {
    if (!vehicleId && approvedVehicles[0]?.id) setVehicleId(approvedVehicles[0].id);
    if (vehicleId && !approvedVehicles.some((vehicle) => vehicle.id === vehicleId)) {
      setVehicleId(approvedVehicles[0]?.id ?? null);
    }
  }, [approvedVehicles, vehicleId]);

  function vehicleForCampaign(campaign: AvailableCampaign) {
    return campaign.vehicle_tier === "black" ? blackVehicle?.id ?? null : vehicleId ?? approvedVehicles[0]?.id ?? null;
  }

  async function handleApply(campaign: AvailableCampaign) {
    const selectedVehicleId = vehicleForCampaign(campaign);
    if (!driver?.id || !selectedVehicleId) {
      const message =
        campaign.vehicle_tier === "black"
          ? "Esta campanha Black exige um veiculo Black aprovado no seu cadastro."
          : "Cadastre e aprove um veiculo antes de se candidatar.";
      Alert.alert("Driver Ads", message);
      return;
    }
    setBusy(true);
    try {
      await applyToCampaign(campaign.id, driver.id, selectedVehicleId);
      await onChanged();
      Alert.alert("Driver Ads", "Candidatura enviada.");
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleRespond(assignmentId: string, accept: boolean) {
    setBusy(true);
    try {
      await respondToAssignment(assignmentId, accept);
      await onChanged();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.stack}>
      <HeaderBlock title="Campanhas" subtitle="Marketplace, convites e historico de vinculos." />

      <View style={styles.card}>
        <Text style={styles.subtitle}>Veiculo para candidatura</Text>
        <Segmented
          options={approvedVehicles.map((vehicle) => ({
            value: vehicle.id,
            label: `${vehicle.plate} - ${vehicle.model}${vehicleTiers[vehicle.id] === "black" ? " Black" : ""}`,
          }))}
          value={vehicleId}
          onChange={setVehicleId}
          emptyLabel="Nenhum veiculo aprovado"
        />
        <Text style={styles.muted}>
          Campanhas Black usam automaticamente um veiculo Black aprovado, quando houver.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>Campanhas disponiveis</Text>
        {availableCampaigns.length === 0 ? (
          <EmptyState text="Nenhuma campanha disponivel para sua cidade/perfil agora." />
        ) : (
          availableCampaigns.map((campaign) => (
            <AvailableCampaignItem
              key={campaign.id}
              campaign={campaign}
              busy={busy}
              approvedVehicles={approvedVehicles}
              selectedVehicleId={vehicleForCampaign(campaign)}
              onApply={handleApply}
            />
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>Minhas campanhas</Text>
        {assignments.length === 0 ? (
          <EmptyState text="Voce ainda nao possui convites ou campanhas vinculadas." />
        ) : (
          assignments.map((assignment) => (
            <View key={assignment.id} style={styles.listItem}>
              <StatusPill status={assignment.status} />
              <Text style={styles.itemTitle}>{assignment.campaign?.name ?? "Campanha"}</Text>
              <Text style={styles.muted}>
                {assignment.vehicle?.plate ?? "-"} - {assignment.vehicle?.model ?? "veiculo"} -{" "}
                {formatCurrency(Number(assignment.monthly_payout || 0))}
              </Text>
              {assignment.status === "invited" && (
                <View style={styles.buttonRow}>
                  <PrimaryButton label="Aceitar" onPress={() => handleRespond(assignment.id, true)} disabled={busy} compact />
                  <SecondaryAction label="Recusar" onPress={() => handleRespond(assignment.id, false)} disabled={busy} />
                </View>
              )}
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function AvailableCampaignItem({
  campaign,
  busy,
  approvedVehicles,
  selectedVehicleId,
  onApply,
}: {
  campaign: AvailableCampaign;
  busy: boolean;
  approvedVehicles: Vehicle[];
  selectedVehicleId: string | null;
  onApply: (campaign: AvailableCampaign) => Promise<void>;
}) {
  const requiresBlack = campaign.vehicle_tier === "black";
  const selectedVehicle = approvedVehicles.find((vehicle) => vehicle.id === selectedVehicleId);

  return (
    <View style={styles.listItem}>
      {campaign.art_url ? <CampaignImage path={campaign.art_url} /> : null}
      <View style={styles.itemTitleRow}>
        <Text style={styles.itemTitle}>{campaign.name}</Text>
        {requiresBlack ? <Text style={styles.blackBadge}>Black</Text> : null}
      </View>
      <Text style={styles.muted}>
        {campaign.city} - {formatDate(campaign.period_start)} a {formatDate(campaign.period_end)}
      </Text>
      <Text style={styles.muted}>Repasse mensal: {formatCurrency(Number(campaign.monthly_payout || 0))}</Text>
      {selectedVehicle ? (
        <Text style={styles.muted}>
          Veiculo: {selectedVehicle.plate} - {selectedVehicle.model}
        </Text>
      ) : requiresBlack ? (
        <Text style={styles.warningText}>Requer veiculo Black aprovado no seu cadastro.</Text>
      ) : null}
      <PrimaryButton
        label="Quero me candidatar"
        onPress={() => onApply(campaign)}
        disabled={busy || !selectedVehicleId}
      />
    </View>
  );
}

function TrackingScreen({
  assignments,
  selected,
  selectedId,
  setSelectedId,
  status,
  busy,
  onStart,
  onStop,
  onRefresh,
  onChanged,
}: {
  assignments: DriverAssignment[];
  selected: DriverAssignment | null;
  selectedId: string | null;
  setSelectedId: (value: string) => void;
  status: TrackingStatus | null;
  busy: boolean;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onChanged: () => Promise<void>;
}) {
  const [proofObservation, setProofObservation] = useState("");

  async function handleProofUpload() {
    if (!selected) return;
    const userId = await getCurrentUserId();
    if (!userId) return;
    try {
      const file = await pickImage("Selecione a foto da instalacao");
      if (!file) return;
      const geo = await getCurrentGeo();
      await uploadInstallationProof({
        userId,
        assignmentId: selected.id,
        file,
        observation: proofObservation,
        geo,
      });
      setProofObservation("");
      await onChanged();
      Alert.alert("Driver Ads", "Foto enviada para revisao.");
    } catch (error) {
      showError(error);
    }
  }

  return (
    <View style={styles.stack}>
      <HeaderBlock title="Tracking" subtitle="Sessao manual com coleta nativa em background quando permitida." />

      <View style={styles.card}>
        <Text style={styles.subtitle}>Campanha rastreavel</Text>
        <Segmented
          options={assignments.map((assignment) => ({
            value: assignment.id,
            label: `${assignment.campaign?.name ?? "Campanha"} - ${assignment.vehicle?.plate ?? "-"}`,
          }))}
          value={selectedId}
          onChange={setSelectedId}
          emptyLabel="Nenhuma campanha elegivel"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>Consentimento e sessao</Text>
        <Text style={styles.muted}>
          Ao iniciar, voce autoriza a Driver Ads a usar sua localizacao para auditoria e analytics agregados da campanha.
        </Text>
        <View style={styles.metrics}>
          <Metric label="Km" value={formatKm(status?.total_distance_m ?? 0)} />
          <Metric label="Tempo" value={formatHours(status?.duration_seconds ?? 0)} />
          <Metric label="Pontos" value={String(status?.points_count ?? 0)} />
        </View>
        {status?.active_session_id ? (
          <PrimaryButton label="Encerrar rastreamento" onPress={onStop} disabled={busy} danger />
        ) : (
          <PrimaryButton label="Iniciar rastreamento" onPress={onStart} disabled={busy || !selected} />
        )}
        <SecondaryAction label="Atualizar status" onPress={onRefresh} disabled={busy || !selected} />
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>Foto da instalacao</Text>
        <Text style={styles.muted}>Envie a foto do adesivo instalado para aprovacao da campanha.</Text>
        <Field
          label="Observacao opcional"
          value={proofObservation}
          onChangeText={setProofObservation}
          multiline
        />
        <PrimaryButton label="Enviar foto" onPress={handleProofUpload} disabled={!selected} />
        {selected ? <ProofHistory assignmentId={selected.id} /> : null}
      </View>
    </View>
  );
}

function ProofHistory({ assignmentId }: { assignmentId: string }) {
  const [proofs, setProofs] = useState<any[]>([]);

  useEffect(() => {
    listProofsForAssignment(assignmentId)
      .then(setProofs)
      .catch(() => setProofs([]));
  }, [assignmentId]);

  if (!proofs.length) return <EmptyState text="Nenhuma foto enviada ainda." />;

  return (
    <View style={styles.stackSmall}>
      {proofs.map((proof) => (
        <View key={proof.id} style={styles.compactItem}>
          <Text style={styles.itemTitle}>{formatDateTime(proof.submitted_at)}</Text>
          <StatusPill status={proof.status} />
        </View>
      ))}
    </View>
  );
}

function EarningsScreen({
  driver,
  payoutMethod,
  payouts,
  busy,
  setBusy,
  onChanged,
}: {
  driver: Driver | null;
  payoutMethod: DriverPayoutMethod | null;
  payouts: DriverPayout[];
  busy: boolean;
  setBusy: (value: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  const [pixType, setPixType] = useState<PixKeyType>("cpf");
  const [pixKey, setPixKey] = useState("");
  const [legalName, setLegalName] = useState(driver?.full_name ?? "");
  const [documentNumber, setDocumentNumber] = useState(driver?.cpf ?? "");

  useEffect(() => {
    if (driver?.full_name) setLegalName(driver.full_name);
    if (driver?.cpf) setDocumentNumber(driver.cpf);
  }, [driver?.full_name, driver?.cpf]);

  async function savePix() {
    if (!driver?.id) return;
    const validation = validatePixKey(pixType, pixKey);
    if (validation) {
      Alert.alert("Driver Ads", validation);
      return;
    }
    setBusy(true);
    try {
      await upsertPayoutMethod({
        driverId: driver.id,
        pixKeyType: pixType,
        pixKeyValue: pixKey,
        legalName,
        documentType: pixType === "cnpj" ? "cnpj" : "cpf",
        documentNumber,
      });
      await onChanged();
      Alert.alert("Driver Ads", "Chave Pix enviada para revisao.");
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.stack}>
      <HeaderBlock title="Ganhos" subtitle="Repasse mensal, chave Pix e historico financeiro." />

      <View style={styles.card}>
        <Text style={styles.subtitle}>Chave Pix para recebimento</Text>
        {payoutMethod ? (
          <View style={styles.noticeInfo}>
            <Text style={styles.noticeTitle}>{payoutMethod.pix_key_value_masked ?? "Pix cadastrado"}</Text>
            <Text style={styles.muted}>Status: {statusLabel(payoutMethod.status)}</Text>
          </View>
        ) : null}
        <Segmented
          options={PIX_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
          value={pixType}
          onChange={(value) => setPixType(value as PixKeyType)}
        />
        <Field label="Chave Pix" value={pixKey} onChangeText={setPixKey} />
        <Field label="Nome do titular" value={legalName} onChangeText={setLegalName} />
        <Field label="CPF/CNPJ do titular" value={documentNumber} onChangeText={setDocumentNumber} keyboardType="number-pad" />
        <PrimaryButton label="Salvar chave Pix" onPress={savePix} disabled={busy || !driver?.id} />
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>Repasses</Text>
        {payouts.length === 0 ? (
          <EmptyState text="Nenhum repasse registrado ainda." />
        ) : (
          payouts.map((payout) => (
            <View key={payout.id} style={styles.compactItem}>
              <View>
                <Text style={styles.itemTitle}>{formatCurrency(Number(payout.amount || 0))}</Text>
                <Text style={styles.muted}>
                  {payout.assignment?.campaign?.name ?? "Campanha"} - {formatDate(payout.reference_month)}
                </Text>
              </View>
              <StatusPill status={payout.status} />
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function ProfileScreen({
  driver,
  vehicles,
  busy,
  setBusy,
  onChanged,
}: {
  driver: Driver | null;
  vehicles: Vehicle[];
  busy: boolean;
  setBusy: (value: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  const [profile, setProfile] = useState({
    full_name: driver?.full_name ?? "",
    phone: driver?.phone ?? "",
    city: driver?.city ?? "",
    birth_date: driver?.birth_date ?? "",
  });
  const [vehicle, setVehicle] = useState({
    plate: "",
    model: "",
    brand: "",
    year: "",
    color: "",
    vehicle_type: "",
  });

  useEffect(() => {
    setProfile({
      full_name: driver?.full_name ?? "",
      phone: driver?.phone ?? "",
      city: driver?.city ?? "",
      birth_date: driver?.birth_date ?? "",
    });
  }, [driver?.id, driver?.full_name, driver?.phone, driver?.city, driver?.birth_date]);

  async function saveProfile() {
    if (!driver?.id) return;
    setBusy(true);
    try {
      await updateMyDriver(driver.id, profile as Partial<Driver>);
      await onChanged();
      Alert.alert("Driver Ads", "Perfil atualizado.");
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function saveAvatar() {
    if (!driver?.id) return;
    const userId = await getCurrentUserId();
    if (!userId) return;
    try {
      const file = await pickImage("Selecione sua foto");
      if (!file) return;
      const publicUrl = await uploadAvatar(userId, file);
      await updateMyDriver(driver.id, { photo_url: publicUrl });
      await onChanged();
    } catch (error) {
      showError(error);
    }
  }

  async function uploadDoc(key: "cnh_front_url" | "selfie_doc_url" | "address_proof_url") {
    if (!driver?.id) return;
    const userId = await getCurrentUserId();
    if (!userId) return;
    try {
      const file = await pickImage("Selecione o documento");
      if (!file) return;
      await uploadDriverDoc({ userId, driverId: driver.id, key, file });
      await onChanged();
    } catch (error) {
      showError(error);
    }
  }

  async function handleSaveVehicle() {
    if (!driver?.id) return;
    if (!vehicle.plate || !vehicle.model) {
      Alert.alert("Driver Ads", "Informe placa e modelo.");
      return;
    }
    setBusy(true);
    try {
      await saveVehicle({
        driver_id: driver.id,
        plate: vehicle.plate,
        model: vehicle.model,
        brand: vehicle.brand,
        year: vehicle.year ? Number(vehicle.year) : null,
        color: vehicle.color,
        vehicle_type: vehicle.vehicle_type,
      });
      setVehicle({ plate: "", model: "", brand: "", year: "", color: "", vehicle_type: "" });
      await onChanged();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleCrlv(vehicleId: string) {
    const userId = await getCurrentUserId();
    if (!userId) return;
    try {
      const file = await pickImage("Selecione o CRLV");
      if (!file) return;
      await uploadVehicleCrlv({ userId, vehicleId, file });
      await onChanged();
    } catch (error) {
      showError(error);
    }
  }

  return (
    <View style={styles.stack}>
      <HeaderBlock title="Meu perfil" subtitle="Dados pessoais, documentos, avatar e veiculos." />

      <View style={styles.card}>
        <View style={styles.profileHeader}>
          {driver?.photo_url ? <Image source={{ uri: driver.photo_url }} style={styles.avatar} /> : <View style={styles.avatarFallback} />}
          <View style={styles.flex}>
            <Text style={styles.subtitle}>{driver?.full_name ?? "Motorista"}</Text>
            <StatusPill status={driver?.status ?? "pending_review"} />
          </View>
        </View>
        <SecondaryAction label="Atualizar foto" onPress={saveAvatar} />
        <Field label="Nome completo" value={profile.full_name} onChangeText={(v) => setProfile({ ...profile, full_name: v })} />
        <Field label="Telefone" value={profile.phone} onChangeText={(v) => setProfile({ ...profile, phone: v })} keyboardType="phone-pad" />
        <Field label="Cidade de atuacao" value={profile.city} onChangeText={(v) => setProfile({ ...profile, city: v })} />
        <Field label="Data de nascimento (AAAA-MM-DD)" value={profile.birth_date ?? ""} onChangeText={(v) => setProfile({ ...profile, birth_date: v })} />
        <PrimaryButton label="Salvar alteracoes" onPress={saveProfile} disabled={busy || !driver?.id} />
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>Documentos para auditoria</Text>
        <DocRow label="CNH" status={driver?.cnh_front_status} onPress={() => uploadDoc("cnh_front_url")} />
        <DocRow label="Selfie com documento" status={driver?.selfie_doc_status} onPress={() => uploadDoc("selfie_doc_url")} />
        <DocRow label="Comprovante de residencia" status={driver?.address_proof_status} onPress={() => uploadDoc("address_proof_url")} />
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>Cadastrar veiculo</Text>
        <Field label="Placa" value={vehicle.plate} onChangeText={(v) => setVehicle({ ...vehicle, plate: v })} autoCapitalize="characters" />
        <Field label="Modelo" value={vehicle.model} onChangeText={(v) => setVehicle({ ...vehicle, model: v })} />
        <View style={styles.row}>
          <Field label="Marca" value={vehicle.brand} onChangeText={(v) => setVehicle({ ...vehicle, brand: v })} />
          <Field label="Ano" value={vehicle.year} onChangeText={(v) => setVehicle({ ...vehicle, year: v })} keyboardType="number-pad" />
        </View>
        <View style={styles.row}>
          <Field label="Cor" value={vehicle.color} onChangeText={(v) => setVehicle({ ...vehicle, color: v })} />
          <Field label="Tipo" value={vehicle.vehicle_type} onChangeText={(v) => setVehicle({ ...vehicle, vehicle_type: v })} />
        </View>
        <PrimaryButton label="Salvar veiculo" onPress={handleSaveVehicle} disabled={busy || !driver?.id} />
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>Meus veiculos</Text>
        {vehicles.length === 0 ? (
          <EmptyState text="Nenhum veiculo cadastrado." />
        ) : (
          vehicles.map((item) => (
            <View key={item.id} style={styles.listItem}>
              <Text style={styles.itemTitle}>{item.plate} - {item.model}</Text>
              <Text style={styles.muted}>{[item.brand, item.year, item.color].filter(Boolean).join(" - ") || "Dados basicos"}</Text>
              <StatusPill status={item.status} />
              <DocRow label="CRLV" status={item.crlv_status} onPress={() => handleCrlv(item.id)} />
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "email-address" | "number-pad" | "phone-pad";
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType}
        secureTextEntry={props.secureTextEntry}
        autoCapitalize={props.autoCapitalize}
        multiline={props.multiline}
        style={[styles.input, props.multiline && styles.textarea]}
      />
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  danger,
  compact,
}: {
  label: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  danger?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.primaryButton,
        compact && styles.compactButton,
        danger && styles.dangerButton,
        disabled && styles.disabledButton,
      ]}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryAction({ label, onPress, disabled }: { label: string; onPress: () => void | Promise<void>; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.outlineButton, disabled && styles.disabledButton]}>
      <Text style={styles.outlineText}>{label}</Text>
    </Pressable>
  );
}

function HeaderBlock({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.hero}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.muted}>{subtitle}</Text>
    </View>
  );
}

function DashboardCard({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.dashboardCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
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

function Segmented({
  options,
  value,
  onChange,
  emptyLabel,
}: {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string) => void;
  emptyLabel?: string;
}) {
  if (!options.length) return <Text style={styles.muted}>{emptyLabel ?? "Nenhuma opcao disponivel"}</Text>;
  return (
    <View style={styles.segmentWrap}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          style={[styles.segment, value === option.value && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, value === option.value && styles.segmentTextActive]} numberOfLines={1}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function DocRow({ label, status, onPress }: { label: string; status?: string | null; onPress: () => void | Promise<void> }) {
  const approved = status === "approved";
  return (
    <View style={styles.docRow}>
      <View style={styles.flex}>
        <Text style={styles.itemTitle}>{label}</Text>
        <StatusPill status={status ?? "pending"} />
      </View>
      {!approved ? <SecondaryAction label="Enviar" onPress={onPress} /> : null}
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const approved = ["approved", "active", "paid", "accepted"].includes(status);
  const waiting = ["pending", "pending_review", "invited", "awaiting_installation"].includes(status);
  return (
    <View style={[styles.pill, approved ? styles.pillOk : waiting ? styles.pillWarn : styles.pillNeutral]}>
      <Text style={[styles.pillText, approved ? styles.pillTextOk : waiting ? styles.pillTextWarn : styles.pillTextNeutral]}>
        {statusLabel(status)}
      </Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

function CampaignImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    if (path.startsWith("http")) {
      setUrl(path);
      return;
    }
    supabase.storage
      .from("campaign-arts")
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => setUrl(data?.signedUrl ?? null))
      .catch(() => setUrl(null));
  }, [path]);

  if (!url) return null;
  return <Image source={{ uri: url }} style={styles.campaignImage} />;
}

async function pickImage(_title: string): Promise<LocalUploadFile | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Driver Ads", "Permita acesso as fotos para enviar arquivos.");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.85,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const ext = extensionFromUri(asset.uri);
  return {
    uri: asset.uri,
    name: asset.fileName ?? `driver-ads-${Date.now()}.${ext}`,
    type: asset.mimeType ?? mimeFromExt(ext),
    ext,
  };
}

async function getCurrentGeo() {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

function resultValue<T>(result: PromiseSettledResult<T>, fallback: T) {
  return result.status === "fulfilled" ? result.value : fallback;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Falha inesperada.";
}

function showError(error: unknown) {
  Alert.alert("Driver Ads", errorMessage(error));
}

function firstName(name = "Motorista") {
  return name.trim().split(/\s+/)[0] || "Motorista";
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatKm(meters: number) {
  return `${(meters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}

function formatHours(seconds: number) {
  return `${(seconds / 3600).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    approved: "Aprovado",
    rejected: "Reprovado",
    pending: "Em analise",
    pending_review: "Em analise",
    invited: "Convite",
    accepted: "Aceito",
    declined: "Recusado",
    awaiting_installation: "Aguardando instalacao",
    active: "Ativo",
    paused: "Pausado",
    completed: "Concluido",
    cancelled: "Cancelado",
    paid: "Pago",
    draft: "Rascunho",
    processing: "Processando",
  };
  return labels[status] ?? status;
}

function extensionFromUri(uri: string) {
  const clean = uri.split("?")[0] ?? uri;
  const ext = clean.split(".").pop()?.toLowerCase();
  return ext && ext.length <= 5 ? ext : "jpg";
}

function mimeFromExt(ext: string) {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
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
  authWrap: {
    flex: 1,
    backgroundColor: "#06142d",
  },
  authContent: {
    minHeight: "100%",
    justifyContent: "center",
    padding: 20,
    gap: 18,
  },
  authBrand: {
    color: "#ffffff",
    textAlign: "center",
    fontSize: 18,
    fontWeight: "900",
  },
  authCard: {
    backgroundColor: "#0a1733",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#24c8ff",
    padding: 18,
    gap: 12,
  },
  authTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  authSubtitle: {
    color: "#a8b5c9",
    textAlign: "center",
    lineHeight: 20,
  },
  topbar: {
    minHeight: 70,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#b5ddff",
    paddingHorizontal: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    color: "#0078ff",
    fontWeight: "900",
    letterSpacing: 0,
  },
  topbarSubtitle: {
    color: "#52627a",
    fontWeight: "700",
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    padding: 18,
    paddingBottom: 100,
  },
  stack: {
    gap: 16,
  },
  stackSmall: {
    gap: 8,
  },
  hero: {
    gap: 6,
  },
  title: {
    color: "#061a3a",
    fontSize: 28,
    fontWeight: "900",
  },
  subtitle: {
    color: "#061a3a",
    fontSize: 17,
    fontWeight: "800",
  },
  muted: {
    color: "#52627a",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d5e1ee",
    padding: 16,
    gap: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  dashboardCard: {
    width: "48%",
    minHeight: 94,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d5e1ee",
    padding: 14,
    justifyContent: "space-between",
  },
  bigNumber: {
    color: "#061a3a",
    fontSize: 28,
    fontWeight: "900",
  },
  field: {
    flex: 1,
    gap: 6,
  },
  label: {
    color: "#061a3a",
    fontWeight: "800",
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c8d6e5",
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    color: "#061a3a",
  },
  textarea: {
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 10,
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
    fontWeight: "800",
    textTransform: "uppercase",
  },
  metricValue: {
    color: "#061a3a",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4,
  },
  listItem: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d5e1ee",
    padding: 12,
    gap: 8,
  },
  compactItem: {
    minHeight: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d5e1ee",
    padding: 12,
    gap: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemTitle: {
    color: "#061a3a",
    fontSize: 16,
    fontWeight: "800",
  },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  blackBadge: {
    borderRadius: 999,
    backgroundColor: "#06142d",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  warningText: {
    borderRadius: 8,
    backgroundColor: "#fff7ed",
    color: "#9a3412",
    fontSize: 12,
    fontWeight: "700",
    padding: 10,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#0078ff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  compactButton: {
    flex: 1,
  },
  dangerButton: {
    backgroundColor: "#ef4444",
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryText: {
    color: "#ffffff",
    fontWeight: "900",
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: "#24c8ff",
    fontWeight: "800",
  },
  outlineButton: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c8d6e5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
  },
  outlineText: {
    color: "#061a3a",
    fontWeight: "800",
  },
  link: {
    color: "#061a3a",
    fontWeight: "800",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  segmentWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  segment: {
    maxWidth: "100%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d5e1ee",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
  },
  segmentActive: {
    borderColor: "#0078ff",
    backgroundColor: "#eef7ff",
  },
  segmentText: {
    color: "#52627a",
    fontWeight: "800",
  },
  segmentTextActive: {
    color: "#061a3a",
  },
  noticeWarning: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f59e0b",
    backgroundColor: "#fff7ed",
    padding: 14,
    gap: 4,
  },
  noticeInfo: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#b5ddff",
    backgroundColor: "#eef7ff",
    padding: 14,
    gap: 4,
  },
  noticeTitle: {
    color: "#061a3a",
    fontWeight: "900",
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillOk: {
    backgroundColor: "#e7f8ef",
    borderColor: "#8ee0b3",
  },
  pillWarn: {
    backgroundColor: "#fff7ed",
    borderColor: "#f6c66f",
  },
  pillNeutral: {
    backgroundColor: "#eef2f7",
    borderColor: "#d5e1ee",
  },
  pillText: {
    fontSize: 12,
    fontWeight: "900",
  },
  pillTextOk: {
    color: "#00935e",
  },
  pillTextWarn: {
    color: "#b45309",
  },
  pillTextNeutral: {
    color: "#52627a",
  },
  empty: {
    color: "#52627a",
    textAlign: "center",
    paddingVertical: 18,
  },
  docRow: {
    minHeight: 66,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d5e1ee",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#d5e1ee",
  },
  avatarFallback: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#dcecff",
    borderWidth: 1,
    borderColor: "#b5ddff",
  },
  campaignImage: {
    width: "100%",
    height: 140,
    borderRadius: 8,
    backgroundColor: "#eef2f7",
  },
  flex: {
    flex: 1,
  },
  navbar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    minHeight: 64,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d5e1ee",
    flexDirection: "row",
    padding: 6,
    gap: 4,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 2,
  },
  navItemActive: {
    backgroundColor: "#eef7ff",
  },
  navText: {
    color: "#52627a",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  navTextActive: {
    color: "#0078ff",
  },
});
