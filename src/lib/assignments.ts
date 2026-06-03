import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AssignmentStatus = Database["public"]["Enums"]["assignment_status"];

export async function respondToAssignment(
  assignmentId: string,
  accept: boolean,
) {
  const newStatus: AssignmentStatus = accept ? "accepted" : "declined";
  const { data, error } = await supabase
    .from("campaign_driver_assignments")
    .update({ status: newStatus, responded_at: new Date().toISOString() })
    .eq("id", assignmentId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
