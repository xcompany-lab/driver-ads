import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { ingestLocationPoint } from "./api";
import { getActiveTrackingSession, TRACKING_TASK_NAME } from "./tracking-storage";

TaskManager.defineTask(TRACKING_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("[driver-location-task]", error);
    return;
  }

  const session = await getActiveTrackingSession();
  if (!session) return;

  const payload = data as { locations?: Location.LocationObject[] };
  const locations = payload.locations ?? [];

  for (const location of locations) {
    try {
      await ingestLocationPoint({
        sessionId: session.sessionId,
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracyM: location.coords.accuracy,
        speedMps: location.coords.speed,
        heading: location.coords.heading,
        recordedAt: new Date(location.timestamp).toISOString(),
      });
    } catch (taskError) {
      console.error("[driver-location-task] failed to ingest point", taskError);
    }
  }
});
