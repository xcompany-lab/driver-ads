import { useQuery } from "@tanstack/react-query";
import { BarChart3, Clock, MapPin, MousePointerClick, Route, Smartphone, Users } from "lucide-react";

import {
  formatDistance,
  formatDuration,
  getCampaignQrAnalytics,
  getCampaignTrackingAnalytics,
  type DriverTrackingAnalytics,
  type QrAnalytics,
} from "@/lib/campaign-analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CampaignAnalyticsPanel({ campaignId }: { campaignId: string }) {
  const { data: qr, isLoading: loadingQr } = useQuery({
    queryKey: ["campaign-qr-analytics", campaignId],
    queryFn: () => getCampaignQrAnalytics(campaignId),
  });
  const { data: tracking, isLoading: loadingTracking } = useQuery({
    queryKey: ["campaign-tracking-analytics", campaignId],
    queryFn: () => getCampaignTrackingAnalytics(campaignId),
  });

  if (loadingQr || loadingTracking) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-primary" /> Analytics da campanha
        </CardTitle>
        <CardDescription>
          Scans do QR e circulacao operacional agregada. Localizacao exata do motorista nao aparece para o anunciante.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <QrBlock data={qr} />
        <TrackingBlock data={tracking} />
      </CardContent>
    </Card>
  );
}

function QrBlock({ data }: { data?: QrAnalytics }) {
  const total = data?.summary.total_scans ?? 0;
  return (
    <section className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={MousePointerClick} label="Scans totais" value={String(total)} />
        <Metric icon={Users} label="Unicos estimados" value={String(data?.summary.unique_scans ?? 0)} />
        <Metric
          icon={Clock}
          label="Ultimo scan"
          value={data?.summary.last_scan_at ? shortDate(data.summary.last_scan_at) : "-"}
        />
        <Metric icon={Smartphone} label="Dispositivos" value={`${data?.by_device.length ?? 0} tipos`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <MiniList title="Por cidade" rows={(data?.by_city ?? []).map((x) => ({
          label: x.city,
          value: x.scans,
          meta: [x.region, x.country].filter(Boolean).join(" - "),
        }))} total={total} />
        <MiniList title="Por dispositivo" rows={(data?.by_device ?? []).map((x) => ({
          label: x.device_type,
          value: x.scans,
        }))} total={total} />
        <MiniList title="Por horario" rows={(data?.by_hour ?? []).map((x) => ({
          label: `${String(x.hour).padStart(2, "0")}h`,
          value: x.scans,
        }))} total={total} />
      </div>

      <div className="rounded-md border p-3">
        <p className="mb-2 text-sm font-semibold">Ultimos scans</p>
        {(data?.latest_scans?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum scan registrado ainda.</p>
        ) : (
          <div className="space-y-2">
            {data!.latest_scans.slice(0, 6).map((scan, index) => (
              <div key={`${scan.scanned_at}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  {scan.city} · {scan.device_type} · {scan.browser_name}
                </span>
                <span className="shrink-0 text-muted-foreground">{shortDate(scan.scanned_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TrackingBlock({ data }: { data?: DriverTrackingAnalytics }) {
  const distance = data?.summary.distance_m ?? 0;
  return (
    <section className="space-y-3 border-t pt-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Route} label="Km agregados" value={formatDistance(distance)} />
        <Metric icon={Clock} label="Tempo rodando" value={formatDuration(data?.summary.driving_seconds ?? 0)} />
        <Metric icon={Users} label="Motoristas ativos" value={String(data?.summary.active_drivers ?? 0)} />
        <Metric icon={MapPin} label="Pontos aceitos" value={String(data?.summary.points_count ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <MiniList title="Km por dia" rows={(data?.by_day ?? []).map((x) => ({
          label: shortDay(x.day),
          value: Number(x.distance_m ?? 0),
          display: formatDistance(Number(x.distance_m ?? 0)),
        }))} total={Math.max(distance, 1)} />
        <MiniList title="Circulacao por horario" rows={(data?.by_hour ?? []).map((x) => ({
          label: `${String(x.hour).padStart(2, "0")}h`,
          value: Number(x.distance_m ?? 0),
          display: formatDistance(Number(x.distance_m ?? 0)),
        }))} total={Math.max(distance, 1)} />
        <MiniList title="Cidade/regiao" rows={(data?.by_city ?? []).map((x) => ({
          label: x.city,
          value: Number(x.distance_m ?? 0),
          display: formatDistance(Number(x.distance_m ?? 0)),
        }))} total={Math.max(distance, 1)} />
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function MiniList({
  title,
  rows,
  total,
}: {
  title: string;
  rows: Array<{ label: string; value: number; display?: string; meta?: string }>;
  total: number;
}) {
  const max = Math.max(...rows.map((r) => r.value), total, 1);
  return (
    <div className="rounded-md border p-3">
      <p className="mb-3 text-sm font-semibold">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
      ) : (
        <div className="space-y-3">
          {rows.slice(0, 8).map((row) => (
            <div key={row.label} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{row.label}</span>
                <span className="shrink-0 font-medium">{row.display ?? row.value}</span>
              </div>
              {row.meta && <p className="text-xs text-muted-foreground">{row.meta}</p>}
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max((row.value / max) * 100, 4)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
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

function shortDay(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
