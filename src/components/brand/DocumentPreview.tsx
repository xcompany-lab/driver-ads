import { useCallback, useEffect, useState } from "react";
import { Loader2, ExternalLink, FileText, ImageIcon, RotateCw, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getSignedDocUrl } from "@/lib/driver-documents";

export function isPdfPath(path: string | null | undefined): boolean {
  if (!path) return false;
  return /\.pdf($|\?)/i.test(path);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: string | null;
  label: string;
}

export function DocumentPreview({ open, onOpenChange, path, label }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    setUrl(null);
    try {
      const u = await getSignedDocUrl(path);
      if (!u) {
        setError("Não foi possível gerar a URL do arquivo. Verifique permissões ou tente novamente.");
      } else {
        setUrl(u);
      }
    } catch (e) {
      setError((e as Error).message || "Erro ao carregar documento.");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    if (open && path) {
      void load();
    }
    if (!open) {
      setUrl(null);
      setError(null);
    }
  }, [open, path, load]);

  const isPdf = isPdfPath(path);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPdf ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
            {label}
          </DialogTitle>
          <DialogDescription>
            {isPdf ? "Documento em PDF" : "Imagem enviada pelo motorista"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[60vh] flex items-center justify-center rounded-md border bg-muted/30 p-4">
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : error ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground max-w-md">{error}</p>
              <Button size="sm" variant="outline" onClick={() => void load()}>
                <RotateCw className="mr-2 h-4 w-4" />
                Tentar novamente
              </Button>
            </div>
          ) : url ? (
            isPdf ? (
              <iframe
                src={url}
                title={label}
                className="h-[75vh] w-full rounded-md bg-white"
              />
            ) : (
              <img
                src={url}
                alt={label}
                className="max-h-[75vh] w-auto rounded-md object-contain"
              />
            )
          ) : null}
        </div>

        <div className="flex justify-between items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading || !path}>
            <RotateCw className="mr-2 h-4 w-4" />
            Atualizar link
          </Button>
          {url && (
            <Button asChild variant="outline" size="sm">
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir em nova aba
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
