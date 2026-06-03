import { useEffect, useState } from "react";
import { Loader2, ExternalLink, FileText, ImageIcon } from "lucide-react";
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

  useEffect(() => {
    let active = true;
    if (open && path) {
      setLoading(true);
      setUrl(null);
      getSignedDocUrl(path).then((u) => {
        if (active) {
          setUrl(u);
          setLoading(false);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [open, path]);

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

        <div className="min-h-[60vh] flex items-center justify-center rounded-md border bg-muted/30">
          {loading || !url ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : isPdf ? (
            <iframe
              src={url}
              title={label}
              className="h-[75vh] w-full rounded-md"
            />
          ) : (
            <img
              src={url}
              alt={label}
              className="max-h-[75vh] w-auto rounded-md object-contain"
            />
          )}
        </div>

        {url && (
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm">
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir em nova aba
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
