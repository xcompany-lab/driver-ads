export type AssignmentStatus =
  | "invited"
  | "accepted"
  | "declined"
  | "awaiting_installation"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

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
  } | null;
  vehicle: {
    id: string;
    plate: string;
    model: string;
  } | null;
}

export interface TrackingStatus {
  has_consent: boolean;
  active_session_id: string | null;
  total_distance_m: number;
  duration_seconds: number;
  points_count: number;
}
