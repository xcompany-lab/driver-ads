import { useMemo, useState } from "react";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { Download, FileImage, FileText, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Campaign } from "@/lib/campaigns";
import {
  getPublicQrUrl,
  type CampaignQrCode,
  updateCampaignQrGeneratedAssets,
  uploadGeneratedQrAsset,
} from "@/lib/trackable-qr";

interface Props {
  campaign: Campaign;
  qrCode: CampaignQrCode;
  artUrl: string | null;
  onGenerated?: () => void;
}

interface QrPosition {
  x: number;
  y: number;
  size: number;
}

function asPosition(value: unknown): QrPosition {
  const fallback = { x: 0.76, y: 0.68, size: 0.18 };
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Record<string, unknown>;
  const x = Number(raw.x);
  const y = Number(raw.y);
  const size = Number(raw.size);
  return {
    x: Number.isFinite(x) ? Math.min(Math.max(x, 0), 0.92) : fallback.x,
    y: Number.isFinite(y) ? Math.min(Math.max(y, 0), 0.92) : fallback.y,
    size: Number.isFinite(size) ? Math.min(Math.max(size, 0.08), 0.35) : fallback.size,
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function dataUrlToBlob(dataUrl: string) {
  const res = await fetch(dataUrl);
  return res.blob();
}

async function loadImageFromUrl(url: string) {
  const blob = await fetch(url).then((res) => {
    if (!res.ok) throw new Error("Nao foi possivel carregar a arte original.");
    return res.blob();
  });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Nao foi possivel ler a arte como imagem."));
      img.src = objectUrl;
    });
    return image;
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

async function renderQrArt(input: {
  artUrl: string;
  qrUrl: string;
  position: QrPosition;
}) {
  const [artImage, qrDataUrl] = await Promise.all([
    loadImageFromUrl(input.artUrl),
    QRCode.toDataURL(input.qrUrl, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 900,
      color: { dark: "#000000", light: "#ffffff" },
    }),
  ]);

  const qrImage = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Nao foi possivel gerar o QR Code."));
    img.src = qrDataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = artImage.naturalWidth || artImage.width;
  canvas.height = artImage.naturalHeight || artImage.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nao disponivel neste navegador.");

  ctx.drawImage(artImage, 0, 0, canvas.width, canvas.height);

  const qrSize = Math.round(Math.min(canvas.width, canvas.height) * input.position.size);
  const pad = Math.max(12, Math.round(qrSize * 0.06));
  const x = Math.round(canvas.width * input.position.x);
  const y = Math.round(canvas.height * input.position.y);
  const boxX = Math.min(Math.max(x, pad), canvas.width - qrSize - pad * 2);
  const boxY = Math.min(Math.max(y, pad), canvas.height - qrSize - pad * 2);

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = Math.round(qrSize * 0.06);
  ctx.fillRect(boxX - pad, boxY - pad, qrSize + pad * 2, qrSize + pad * 2);
  ctx.restore();
  ctx.drawImage(qrImage, boxX, boxY, qrSize, qrSize);

  return {
    canvas,
    dataUrl: canvas.toDataURL("image/png"),
  };
}

export function QrArtExporter({ campaign, qrCode, artUrl, onGenerated }: Props) {
  const [busy, setBusy] = useState<"png" | "pdf" | null>(null);
  const qrUrl = useMemo(() => getPublicQrUrl(qrCode.short_code), [qrCode.short_code]);
  const isPdfSource = Boolean(artUrl?.match(/\.pdf($|\?)/i));
  const assignmentId = (qrCode as CampaignQrCode & { assignment_id?: string | null }).assignment_id ?? null;
  const kitLabel = (qrCode as CampaignQrCode & { kit_label?: string | null }).kit_label;
  const filenameBase = `${campaign.name}${kitLabel ? `-${kitLabel}` : ""}`.replace(/[^\w.-]+/g, "-");

  async function exportPng() {
    if (!artUrl || isPdfSource) return;
    setBusy("png");
    try {
      const rendered = await renderQrArt({
        artUrl,
        qrUrl,
        position: asPosition(qrCode.qr_position),
      });
      const blob = await dataUrlToBlob(rendered.dataUrl);
      const path = await uploadGeneratedQrAsset({
        advertiserId: campaign.advertiser_id,
        campaignId: campaign.id,
        assignmentId,
        blob,
        contentType: "image/png",
      });
      await updateCampaignQrGeneratedAssets(qrCode.id, {
        final_image_url: path,
        generated_at: new Date().toISOString(),
      });
      downloadBlob(blob, `${filenameBase}-qr.png`);
      toast.success("Arte com QR gerada em PNG");
      onGenerated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar PNG com QR");
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf() {
    if (!artUrl || isPdfSource) return;
    setBusy("pdf");
    try {
      const rendered = await renderQrArt({
        artUrl,
        qrUrl,
        position: asPosition(qrCode.qr_position),
      });
      const width = rendered.canvas.width;
      const height = rendered.canvas.height;
      const pdf = new jsPDF({
        orientation: width >= height ? "landscape" : "portrait",
        unit: "pt",
        format: [width, height],
        compress: true,
      });
      pdf.addImage(rendered.dataUrl, "PNG", 0, 0, width, height);
      const blob = pdf.output("blob");
      const path = await uploadGeneratedQrAsset({
        advertiserId: campaign.advertiser_id,
        campaignId: campaign.id,
        assignmentId,
        blob,
        contentType: "application/pdf",
      });
      await updateCampaignQrGeneratedAssets(qrCode.id, {
        final_pdf_url: path,
        generated_at: new Date().toISOString(),
      });
      downloadBlob(blob, `${filenameBase}-qr.pdf`);
      toast.success("PDF com QR gerado");
      onGenerated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar PDF com QR");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="inline-flex items-center gap-2 text-sm font-semibold">
            <QrCode className="h-4 w-4 text-primary" /> Arte final com QR rastreavel
          </p>
          {kitLabel && <p className="text-xs font-medium text-muted-foreground">{kitLabel}</p>}
          <p className="break-all text-xs text-muted-foreground">{qrUrl}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={exportPng}
            disabled={!artUrl || isPdfSource || busy !== null}
          >
            {busy === "png" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileImage className="mr-2 h-4 w-4" />}
            PNG
          </Button>
          <Button
            type="button"
            onClick={exportPdf}
            disabled={!artUrl || isPdfSource || busy !== null}
          >
            {busy === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Exportar PDF
          </Button>
        </div>
      </div>
      {!artUrl && (
        <p className="mt-3 text-xs text-muted-foreground">
          Envie uma arte da campanha para gerar a versao final com QR.
        </p>
      )}
      {isPdfSource && (
        <p className="mt-3 text-xs text-destructive">
          A exportacao com QR funciona para artes em imagem. Envie PNG, JPG ou WebP como arte original.
        </p>
      )}
      {(qrCode.final_image_url || qrCode.final_pdf_url) && (
        <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Download className="h-3.5 w-3.5" /> Ultima versao gerada salva no armazenamento da campanha.
        </p>
      )}
    </div>
  );
}
