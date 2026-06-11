import * as Location from "expo-location";

import { TRACKING_TASK_NAME } from "./tracking-storage";

export async function requestLocationPermissions() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    throw new Error("Permissao de localizacao durante o uso foi negada.");
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== "granted") {
    throw new Error("Permissao de localizacao em segundo plano foi negada.");
  }
}

export async function startNativeLocationUpdates() {
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK_NAME);
  if (alreadyStarted) return;

  await Location.startLocationUpdatesAsync(TRACKING_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 300000,
    distanceInterval: 150,
    deferredUpdatesInterval: 300000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Driver Ads em rastreamento",
      notificationBody: "Sua localizacao esta sendo usada para analytics operacionais da campanha ativa.",
    },
  });
}

export async function stopNativeLocationUpdates() {
  const started = await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK_NAME);
  if (started) {
    await Location.stopLocationUpdatesAsync(TRACKING_TASK_NAME);
  }
}
