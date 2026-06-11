import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Calendar, MapPin, FileText, Upload, Loader2, CreditCard, QrCode } from "lucide-react";
import {
  getMyCampaign,
  getCampaignArtUrl,
  uploadCampaignArt,
  updateMyCampaign,
} from "@/lib/campaigns";
import {
  getCampaignQrCode,
  getCampaignQrScanCount,
  getPublicQrUrl,
  upsertCampaignQrCode,
  type QrDestinationType,
} from "@/lib/trackable-qr";
import { QrArtExporter } from "@/components/campaigns/QrArtExporter";
import { CampaignAnalyticsPanel } from "@/components/campaigns/CampaignAnalyticsPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/anunciante/campanhas/$id/")({
  component: AdvertiserCampaignDetail,
});

function fmt(d: string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

function AdvertiserCampaignDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [art, setArt] = useState<File | null>(null);
  const [artPreview, setArtPreview] = useState<string | null>(null);
  const [qrForm, setQrForm] = useState<{
    destinationType: QrDestinationType;
    whatsappPhone: string;
    landingPageUrl: string;
  }>({
    destinationType: "whatsapp",
    whatsappPhone: "",
    landingPageUrl: "",
  });

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["my-campaign", id],
    queryFn: () => getMyCampaign(id),
  });

  const { data: qrCode } = useQuery({
    queryKey: ["campaign-qr", id],
    queryFn: () => getCampaignQrCode(id),
    enabled: !!campaign,
  });

  const { data: scanCount } = useQuery({
    queryKey: ["campaign-qr", id, "scan-count"],
    queryFn: () => getCampaignQrScanCount(id),
    enabled: !!qrCode,
  });

  useEffect(() => {
    let cancelled = false;
    if (campaign?.art_url) {
      getCampaignArtUrl(campaign.art_url).then((u) => {
        if (!cancelled) setArtPreview(u);
      });
    } else {
      setArtPreview(null);
    }
    return () => {
      cancelled = true;
    };
  }, [campaign?.art_url]);

  useEffect(() => {
    if (!qrCode) return;
    setQrForm({
      destinationType: qrCode.destination_type,
      whatsappPhone: qrCode.whatsapp_phone ?? "",
      landingPageUrl: qrCode.landing_page_url ?? "",
    });
  }, [qrCode]);

  const upload = useMutation({
    mutationFn: async () => {
      if (!campaign || !art) throw new Error("Selecione uma arte");
      const path = await uploadCampaignArt(campaign.advertiser_id, art);
      await updateMyCampaign(campaign.id, { art_url: path });
    },
    onSuccess: () => {
      toast.success("Arte atualizada");
      setArt(null);
      qc.invalidateQueries({ queryKey: ["my-campaign", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: () => updateMyCampaign(id, { status: "cancelled" }),
    onSuccess: () => {
      toast.success("Campanha cancelada");
      qc.invalidateQueries({ queryKey: ["my-campaign", id] });
      qc.invalidateQueries({ queryKey: ["my-campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveQr = useMutation({
    mutationFn: async () => {
      if (!campaign) throw new Error("Campanha nao encontrada");
      return upsertCampaignQrCode({
        campaignId: campaign.id,
        advertiserId: campaign.advertiser_id,
        destinationType: qrForm.destinationType,
        whatsappPhone: qrForm.whatsappPhone,
        landingPageUrl: qrForm.landingPageUrl,
      });
    },
    onSuccess: () => {
      toast.success("QR Code atualizado");
      qc.invalidateQueries({ queryKey: ["campaign-qr", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !campaign) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const canCancel = !["cancelled", "completed", "rejected"].includes(campaign.status);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <Link
          to="/anunciante/campanhas"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para campanhas
        </Link>
        <StatusBadge status={campaign.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{campaign.name}</CardTitle>
          {campaign.description && <CardDescription>{campaign.description}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Info icon={<MapPin className="h-3.5 w-3.5" />} label="Cidade" value={campaign.city} />
            <Info
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="Regiões"
              value={campaign.regions?.length ? campaign.regions.join(", ") : "—"}
            />
            <Info
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Período"
              value={`${fmt(campaign.period_start)} → ${fmt(campaign.period_end)}`}
            />
            <Info label="Veículos" value={String(campaign.vehicles_qty)} />
            <Info
              label="Valor do plano"
              value={`R$ ${Number(campaign.plan_value).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}`}
            />
            <Info label="Criada em" value={fmt(campaign.created_at)} />
          </div>

          {campaign.observations && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Observações
              </p>
              <p className="text-sm mt-1">{campaign.observations}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
            <Button
              type="button"
              onClick={() =>
                navigate({ to: "/anunciante/campanhas/$id/checkout", params: { id: campaign.id } })
              }
            >
              <CreditCard className="mr-2 h-4 w-4" /> Contratar / Pagar assinatura
            </Button>
            {canCancel && (
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
              >
                Cancelar campanha
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Arte da campanha</CardTitle>
          <CardDescription>
            Envie ou atualize a peça publicitária que será aplicada nos veículos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {artPreview ? (
            artPreview.match(/\.pdf($|\?)/i) ? (
              <a
                href={artPreview}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <FileText className="h-4 w-4" /> Abrir arte atual (PDF)
              </a>
            ) : (
              <img
                src={artPreview}
                alt="Arte da campanha"
                className="max-h-64 rounded-md border"
              />
            )
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma arte enviada ainda.</p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setArt(e.target.files?.[0] ?? null)}
            />
            <Button onClick={() => upload.mutate()} disabled={!art || upload.isPending}>
              {upload.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Enviar arte
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <QrCode className="h-4 w-4 text-primary" /> QR Code rastreavel
          </CardTitle>
          <CardDescription>
            Configure o destino do QR e exporte a arte final com rastreamento de scans.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Destino</Label>
              <Select
                value={qrForm.destinationType}
                onValueChange={(value) =>
                  setQrForm({ ...qrForm, destinationType: value as QrDestinationType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="landing_page">Landing page</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {qrForm.destinationType === "whatsapp" ? (
              <div className="space-y-2">
                <Label htmlFor="qr_whatsapp_phone">WhatsApp</Label>
                <Input
                  id="qr_whatsapp_phone"
                  value={qrForm.whatsappPhone}
                  onChange={(e) => setQrForm({ ...qrForm, whatsappPhone: e.target.value })}
                  placeholder="Ex.: 48999999999"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="qr_landing_page_url">URL da landing page</Label>
                <Input
                  id="qr_landing_page_url"
                  value={qrForm.landingPageUrl}
                  onChange={(e) => setQrForm({ ...qrForm, landingPageUrl: e.target.value })}
                  placeholder="https://suaempresa.com/promocao"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => saveQr.mutate()} disabled={saveQr.isPending}>
              {saveQr.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar destino do QR
            </Button>
            {qrCode && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{scanCount ?? 0}</span> scans registrados
              </div>
            )}
          </div>

          {qrCode ? (
            <>
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                Link publico impresso no QR:{" "}
                <span className="break-all font-medium text-foreground">
                  {getPublicQrUrl(qrCode.short_code)}
                </span>
              </div>
              <QrArtExporter
                campaign={campaign}
                qrCode={qrCode}
                artUrl={artPreview}
                onGenerated={() => qc.invalidateQueries({ queryKey: ["campaign-qr", id] })}
              />
            </>
          ) : (
            <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              Salve o destino para criar o QR rastreavel desta campanha.
            </p>
          )}
        </CardContent>
      </Card>

      <CampaignAnalyticsPanel campaignId={campaign.id} />
    </div>
  );
}

function Info({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 inline-flex items-center gap-1.5">
        {icon}
        {value}
      </p>
    </div>
  );
}
