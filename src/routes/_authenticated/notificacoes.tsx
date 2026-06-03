import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, CheckCheck, Trash2 } from "lucide-react";
import { listMyNotifications, markRead, markAllRead, deleteNotification } from "@/lib/notifications";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: () => listMyNotifications(200),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["notifications"] });

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
      <Button asChild variant="ghost" size="sm">
        <Link to="/">
          <ArrowLeft className="mr-2 h-4 w-4" />Voltar
        </Link>
      </Button>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
          <p className="text-sm text-muted-foreground">Tudo o que aconteceu na sua conta.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => markAllRead().then(refresh)}>
          <CheckCheck className="mr-2 h-4 w-4" />Marcar todas
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !data?.length ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Bell className="mx-auto mb-2 h-8 w-8 opacity-40" />
            Nenhuma notificação ainda.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y">
            {data.map((n) => (
              <li key={n.id} className={cn("flex items-start gap-3 px-4 py-3", !n.read_at && "bg-primary/5")}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{n.title}</div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(n.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                  {n.link && (
                    <Link to={n.link as string} className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                      Abrir
                    </Link>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  {!n.read_at && (
                    <Button size="sm" variant="ghost" onClick={() => markRead(n.id).then(refresh)}>
                      Marcar lida
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => deleteNotification(n.id).then(refresh)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
