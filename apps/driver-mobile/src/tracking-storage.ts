import AsyncStorage from "@react-native-async-storage/async-storage";

export const TRACKING_TASK_NAME = "driver-ads-location-tracking";
const ACTIVE_SESSION_KEY = "driver_ads_active_tracking_session";

export interface ActiveTrackingSession {
  sessionId: string;
  assignmentId: string;
  startedAt: string;
}

export async function saveActiveTrackingSession(value: ActiveTrackingSession) {
  await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(value));
}

export async function getActiveTrackingSession() {
  const raw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveTrackingSession;
  } catch {
    await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
    return null;
  }
}

export async function clearActiveTrackingSession() {
  await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
}
