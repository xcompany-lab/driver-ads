import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { Download, FileImage, FileText, Loader2, QrCode, SlidersHorizontal, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { Campaign } from "@/lib/campaigns";
import {
  getPublicQrUrl,
  type CampaignQrCode,
  updateCampaignQrGeneratedAssets,
  updateCampaignQrPosition,
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

// Default alinhado ao template "kit-traseiro-sua-marca": o QR encaixa no quadro
// branco do painel azul à direita. x/y = canto superior-esquerdo (fração de
// largura/altura); size = lado do QR sobre a menor dimensão da arte.
const DEFAULT_QR_POSITION: QrPosition = { x: 0.71, y: 0.39, size: 0.33 };

function asPosition(value: unknown): QrPosition {
  const fallback = DEFAULT_QR_POSITION;
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

  // Ajuste manual da posição/tamanho do QR sobre a arte.
  const [position, setPosition] = useState<QrPosition>(() => asPosition(qrCode.qr_position));
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const artRef = useRef<HTMLImageElement>(null);

  // Sincroniza com a posição salva se o QR mudar.
  useEffect(() => {
    setPosition(asPosition(qrCode.qr_position));
  }, [qrCode.qr_position]);

  // QR leve para o preview ao vivo.
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(qrUrl, { errorCorrectionLevel: "H", margin: 1, width: 320 })
      .then((url) => active && setQrPreview(url))
      .catch(() => active && setQrPreview(null));
    return () => {
      active = false;
    };
  }, [qrUrl]);

  // Mede o tamanho renderizado da arte para posicionar o overlay.
  useEffect(() => {
    if (!adjustOpen) return;
    const el = artRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [adjustOpen, artUrl]);

  const overlay = useMemo(() => {
    if (!box.w || !box.h) return null;
    const qr = Math.min(box.w, box.h) * position.size;
    const pad = Math.max(4, qr * 0.06);
    const left = Math.min(Math.max(box.w * position.x, pad), box.w - qr - pad * 2);
    const top = Math.min(Math.max(box.h * position.y, pad), box.h - qr - pad * 2);
    return { qr, pad, left, top };
  }, [box, position]);

  async function savePosition() {
    setSaving(true);
    try {
      await updateCampaignQrPosition(qrCode.id, position);
      toast.success("Posição do QR salva");
      onGenerated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar posição do QR");
    } finally {
      setSaving(false);
    }
  }
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
        position,
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
        position,
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
          <Button
            type="button"
            variant="ghost"
            onClick={() => setAdjustOpen((v) => !v)}
            disabled={!artUrl || isPdfSource}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" /> Ajustar QR
          </Button>
        </div>
      </div>

      {adjustOpen && artUrl && !isPdfSource && (
        <div className="mt-4 grid gap-4 rounded-lg border bg-background p-4 lg:grid-cols-[1fr_240px]">
          <div className="relative overflow-hidden rounded-md border">
            <img ref={artRef} src={artUrl} alt="Arte da campanha" className="block w-full" />
            {qrPreview && overlay && (
              <>
                <div
                  className="absolute rounded-[2px] bg-white shadow-md"
                  style={{
                    left: overlay.left - overlay.pad,
                    top: overlay.top - overlay.pad,
                    width: overlay.qr + overlay.pad * 2,
                    height: overlay.qr + overlay.pad * 2,
                  }}
                />
                <img
                  src={qrPreview}
                  alt="Prévia do QR"
                  className="absolute"
                  style={{ left: overlay.left, top: overlay.top, width: overlay.qr, height: overlay.qr }}
                />
              </>
            )}
          </div>

          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Arraste para posicionar e redimensionar o QR sobre a arte. O automático já vem bom; use isto para refinar.
            </p>
            <AdjustSlider
              label="Horizontal"
              value={position.x}
              min={0}
              max={0.92}
              step={0.005}
              onChange={(x) => setPosition((p) => ({ ...p, x }))}
            />
            <AdjustSlider
              label="Vertical"
              value={position.y}
              min={0}
              max={0.92}
              step={0.005}
              onChange={(y) => setPosition((p) => ({ ...p, y }))}
            />
            <AdjustSlider
              label="Tamanho"
              value={position.size}
              min={0.08}
              max={0.45}
              step={0.005}
              onChange={(size) => setPosition((p) => ({ ...p, size }))}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" size="sm" onClick={savePosition} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar posição
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPosition(DEFAULT_QR_POSITION)}
                disabled={saving}
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Padrão
              </Button>
            </div>
          </div>
        </div>
      )}
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

function AdjustSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{Math.round(value * 100)}%</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}
