import { useEffect, useMemo, useRef } from "react";
import "leaflet/dist/leaflet.css";

import type { QrApproxLocation } from "@/lib/campaign-analytics";

export function ApproxLocationMap({ locations }: { locations: QrApproxLocation[] }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);
  const stableLocations = useMemo(
    () => locations.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)),
    [locations],
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!rootRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !rootRef.current) return;

      mapRef.current?.remove();
      rootRef.current.innerHTML = "";

      const map = L.map(rootRef.current, {
        attributionControl: true,
        scrollWheelZoom: false,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      if (stableLocations.length === 0) {
        map.setView([-27.5949, -48.5482], 11);
        return;
      }

      const bounds = L.latLngBounds([]);
      stableLocations.forEach((location) => {
        const color = location.source === "driver_track_crossref" ? "#0ea5e9" : "#f59e0b";
        const label = [
          location.vehicle_label || "Veiculo nao identificado",
          shortDate(location.scanned_at),
          `${Math.max(location.radius_m, 0).toLocaleString("pt-BR")} m`,
          confidenceLabel(location.confidence),
        ].filter(Boolean).join(" · ");

        L.circle([location.lat, location.lng], {
          radius: Math.max(location.radius_m, 250),
          color,
          fillColor: color,
          fillOpacity: 0.18,
          opacity: 0.85,
          weight: 2,
        }).bindPopup(label).addTo(map);
        bounds.extend([location.lat, location.lng]);
      });

      if (stableLocations.length === 1) {
        const only = stableLocations[0];
        map.setView([only.lat, only.lng], only.radius_m > 5000 ? 10 : 13);
      } else {
        map.fitBounds(bounds.pad(0.25), { maxZoom: 14 });
      }
    }

    init();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [stableLocations]);

  return (
    <div className="overflow-hidden rounded-md border">
      <div ref={rootRef} className="h-[320px] w-full bg-muted" />
    </div>
  );
}

function shortDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function confidenceLabel(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "";
  if (value >= 0.8) return "alta confianca";
  if (value >= 0.5) return "media confianca";
  return "baixa confianca";
}
