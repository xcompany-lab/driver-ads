// Pagou customer (advertiser) — get-or-create
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({ advertiser_id: z.string().uuid() });

export const getOrCreatePagouCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pagouRequest } = await import("./client.server");

    // Authz: caller must own advertiser OR be staff
    const { data: adv, error } = await context.supabase
      .from("advertisers")
      .select("id, user_id, company_name, cnpj, document_type, responsible, email, phone, address, city, segment, pagou_customer_id")
      .eq("id", data.advertiser_id)
      .single();
    if (error || !adv) throw new Error("Advertiser não encontrado");

    if (adv.pagou_customer_id) {
      return { pagou_customer_id: adv.pagou_customer_id, created: false };
    }

    const document_number = (adv.cnpj ?? "").replace(/\D/g, "");
    const document_type = adv.document_type ?? (document_number.length === 11 ? "CPF" : "CNPJ");

    const body = {
      name: adv.company_name,
      email: adv.email,
      phone: adv.phone,
      document: { type: document_type, number: document_number },
      externalRef: `advertiser_${adv.id}`,
      address: adv.address ?? { city: adv.city, country: "BR" },
    };

    const res = await pagouRequest<{ id: string }>("/v2/customers", {
      method: "POST",
      body: JSON.stringify(body),
    }, { entity_type: "advertiser", entity_id: adv.id });

    if (!res.ok || !res.data?.id) {
      throw new Error(`Pagou customer error: ${res.error ?? "unknown"}`);
    }

    await supabaseAdmin
      .from("advertisers")
      .update({ pagou_customer_id: res.data.id })
      .eq("id", adv.id);

    await supabaseAdmin.from("audit_logs").insert({
      action: "pagou.customer.created",
      entity_type: "advertiser",
      entity_id: adv.id,
      after_data: { pagou_customer_id: res.data.id },
      metadata: { request_id: res.requestId },
    });

    return { pagou_customer_id: res.data.id, created: true };
  });
