import { createFileRoute } from "@tanstack/react-router";

/**
 * One-shot seed endpoint. Idempotent. Creates the three operator accounts.
 * Protected by a simple shared token to avoid abuse. Remove after use.
 */
export const Route = createFileRoute("/api/public/seed-accounts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-seed-token");
        if (token !== "driver-ads-seed-2026") {
          return new Response("forbidden", { status: 403 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const PASSWORD = "DriverAds@2026";
        const seeds = [
          { email: "madaraxcompany@gmail.com", role: "advertiser" as const, full_name: "Madara Company" },
          { email: "madaraschumacher@gmail.com", role: "driver" as const, full_name: "Madara Schumacher" },
          { email: "lowjuliano@gmail.com", role: "admin" as const, full_name: "Juliano Low" },
        ];

        const results: Array<Record<string, unknown>> = [];

        for (const s of seeds) {
          // find existing
          const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
          if (list.error) throw new Error(list.error.message);
          const existing = list.data.users.find((u) => u.email?.toLowerCase() === s.email.toLowerCase());

          let userId: string;
          if (existing) {
            userId = existing.id;
            const upd = await supabaseAdmin.auth.admin.updateUserById(userId, {
              password: PASSWORD,
              email_confirm: true,
              user_metadata: { full_name: s.full_name },
            });
            if (upd.error) throw new Error(upd.error.message);
            results.push({ email: s.email, status: "updated", id: userId });
          } else {
            const created = await supabaseAdmin.auth.admin.createUser({
              email: s.email,
              password: PASSWORD,
              email_confirm: true,
              user_metadata: { full_name: s.full_name },
            });
            if (created.error) throw new Error(created.error.message);
            userId = created.data.user!.id;
            results.push({ email: s.email, status: "created", id: userId });
          }

          // ensure role
          const { data: roles } = await supabaseAdmin
            .from("user_roles")
            .select("id")
            .eq("user_id", userId)
            .eq("role", s.role);
          if (!roles?.length) {
            const { error: rerr } = await supabaseAdmin
              .from("user_roles")
              .insert({ user_id: userId, role: s.role });
            if (rerr) throw new Error(rerr.message);
          }
        }

        return new Response(JSON.stringify({ ok: true, password: PASSWORD, results }, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
