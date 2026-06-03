import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { countUnread, listMyNotifications, markAllRead, markRead } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

function fmt(d: string) {
  const date = new Date(d);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return date.toLocaleDateString("pt-BR");
}

export function NotificationBell() {
  const qc = useQueryClient();
  const { user } = useSession();

  const { data: unread = 0 } = useQuery({
    queryKey: ["notifications", "unread", user?.id],
    queryFn: countUnread,
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const { data: list = [] } = useQuery({
    queryKey: ["notifications", "list", user?.id],
    queryFn: () => listMyNotifications(20),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("notifications:" + user.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const onOpen = (id: string, read_at: string | null) => {
    if (!read_at) {
      markRead(id)
        .then(() => qc.invalidateQueries({ queryKey: ["notifications"] }))
        .catch(() => {});
    }
  };

  const onMarkAll = async () => {
    await markAllRead();
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  if (!user) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-sm font-semibold">Notificações</div>
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={onMarkAll}>
              <CheckCheck className="mr-1 h-3 w-3" />Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {list.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Sem notificações.</div>
          ) : (
            <ul className="divide-y">
              {list.map((n) => {
                const Item = (
                  <div
                    className={cn(
                      "block px-3 py-2.5 transition hover:bg-muted/60",
                      !n.read_at && "bg-primary/5",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm leading-tight">{n.title}</div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{fmt(n.created_at)}</span>
                    </div>
                    {n.body && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                  </div>
                );
                return (
                  <li key={n.id} onClick={() => onOpen(n.id, n.read_at)}>
                    {n.link ? <Link to={n.link as string}>{Item}</Link> : Item}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t px-3 py-2 text-center">
          <Link to="/notificacoes" className="text-xs font-medium text-primary hover:underline">Ver todas</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
