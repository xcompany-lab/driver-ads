export type AssignmentStatus =
  | "invited"
  | "accepted"
  | "declined"
  | "awaiting_installation"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export type ReviewStatus = "pending" | "approved" | "rejected";
export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";

export interface Driver {
  id: string;
  user_id: string;
  full_name: string;
  cpf: string;
  birth_date: string | null;
  phone: string;
  email: string;
  city: string;
  regions: string[];
  pix_key: string | null;
  pix_key_type: string | null;
  photo_url: string | null;
  status: string;
  cnh_front_url?: string | null;
  selfie_doc_url?: string | null;
  address_proof_url?: string | null;
  cnh_front_status?: ReviewStatus | null;
  selfie_doc_status?: ReviewStatus | null;
  address_proof_status?: ReviewStatus | null;
}

export interface Vehicle {
  id: string;
  driver_id: string;
  plate: string;
  model: string;
  brand: string | null;
  year: number | null;
  color: string | null;
  vehicle_type: string | null;
  photo_url: string | null;
  status: string;
  crlv_url?: string | null;
  crlv_status?: ReviewStatus | null;
}

export interface DriverAssignment {
  id: string;
  status: AssignmentStatus;
  monthly_payout: number;
  campaign: {
    id: string;
    name: string;
    city: string;
    period_start: string;
    period_end: string;
    art_url?: string | null;
  } | null;
  vehicle: {
    id: string;
    plate: string;
    model: string;
  } | null;
}

export interface AvailableCampaign {
  id: string;
  name: string;
  city: string;
  period_start: string;
  period_end: string;
  description: string | null;
  art_url: string | null;
  plan_value: number;
  monthly_payout: number;
  available_slots: number;
}

export interface TrackingStatus {
  has_consent: boolean;
  active_session_id: string | null;
  total_distance_m: number;
  duration_seconds: number;
  points_count: number;
}

export interface InstallationProof {
  id: string;
  assignment_id: string;
  photo_url: string;
  observation: string | null;
  status: string;
  submitted_at: string;
}

export interface DriverPayoutMethod {
  id: string;
  driver_id: string;
  pix_key_type: string;
  pix_key_value_masked: string | null;
  legal_name: string | null;
  document_type: string | null;
  document_number: string | null;
  status: string;
  is_default: boolean;
}

export interface DriverPayout {
  id: string;
  reference_month: string;
  amount: number;
  status: string;
  paid_at: string | null;
  assignment: {
    id: string;
    campaign: { id: string; name: string } | null;
    vehicle: { id: string; plate: string; model: string } | null;
  } | null;
}

export interface SignupInput {
  fullName: string;
  cpf: string;
  city: string;
  phone: string;
  email: string;
  password: string;
}
