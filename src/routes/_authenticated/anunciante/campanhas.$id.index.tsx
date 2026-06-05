import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Calendar, MapPin, FileText, Upload, Loader2, CreditCard } from "lucide-react";
import {
  getMyCampaign,
  getCampaignArtUrl,
  uploadCampaignArt,
  updateMyCampaign,
} from "@/lib/campaigns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/brand/StatusBadge";

export const Route = createFileRoute("/_authenticated/anunciante/campanhas/$id/")({
  component: AdvertiserCampaignDetail,
});

function fmt(d: string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

function AdvertiserCampaignDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [art, setArt] = useState<File | null>(null);
  const [artPreview, setArtPreview] = useState<string | null>(null);

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["my-campaign", id],
    queryFn: () => getMyCampaign(id),
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
            <Button asChild>
              <Link to="/anunciante/campanhas/$id/checkout" params={{ id: campaign.id }}>
                <CreditCard className="mr-2 h-4 w-4" /> Contratar / Pagar assinatura
              </Link>
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
