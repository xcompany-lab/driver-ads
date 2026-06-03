import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Proof = Database["public"]["Tables"]["installation_proofs"]["Row"];
export type ProofStatus = Database["public"]["Enums"]["proof_status"];

export interface ProofWithRelations extends Proof {
  assignment: {
    id: string;
    monthly_payout: number;
    driver: { id: string; full_name: string; city: string; phone: string } | null;
    vehicle: { id: string; plate: string; model: string; brand: string | null } | null;
    campaign: { id: string; name: string; city: string } | null;
  } | null;
}

export async function listProofsAdmin(status: ProofStatus | "all" = "pending_review"): Promise<ProofWithRelations[]> {
  let q = supabase
    .from("installation_proofs")
    .select(`
      *,
      assignment:campaign_driver_assignments(
        id, monthly_payout,
        driver:drivers(id, full_name, city, phone),
        vehicle:vehicles(id, plate, model, brand),
        campaign:campaigns(id, name, city)
      )
    `)
    .order("submitted_at", { ascending: false });
  if (status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ProofWithRelations[];
}

export interface ReviewProofInput {
  id: string;
  status: Extract<ProofStatus, "approved" | "rejected" | "resubmission_requested">;
  rejectionReason?: string;
  /** If approving, optionally advance the linked assignment from awaiting_installation → active */
  assignmentId?: string;
  activateAssignment?: boolean;
}

export async function reviewProof(input: ReviewProofInput) {
  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("installation_proofs")
    .update({
      status: input.status,
      rejection_reason: input.status === "approved" ? null : input.rejectionReason ?? null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: userData.user?.id ?? null,
    })
    .eq("id", input.id);
  if (error) throw error;

  if (input.status === "approved" && input.activateAssignment && input.assignmentId) {
    const { error: aErr } = await supabase
      .from("campaign_driver_assignments")
      .update({ status: "active" })
      .eq("id", input.assignmentId);
    if (aErr) throw aErr;
  }
}

export async function getProofSignedUrlAdmin(path: string, expiresIn = 60 * 10): Promise<string> {
  const { data, error } = await supabase.storage
    .from("installation-proofs")
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
