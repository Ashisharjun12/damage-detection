export const PART_TAXONOMY = [
  "Front Bumper",
  "Hood / Bonnet",
  "Front Grille",
  "Headlamp (L)",
  "Headlamp (R)",
  "Fog Lamp (L)",
  "Fog Lamp (R)",
  "Front Windshield",
  "Front Fender (L)",
  "Front Fender (R)",
  "Rear Bumper",
  "Dicky / Boot Lid",
  "Tail Lamp (L)",
  "Tail Lamp (R)",
  "Rear Windshield",
  "Rear Fender (L)",
  "Rear Fender (R)",
  "Number Plate Panel",
  "Front Door (L)",
  "Front Door (R)",
  "Rear Door (L)",
  "Rear Door (R)",
  "Running Board",
  "Side Mirror (L)",
  "Side Mirror (R)",
  "B-Pillar / C-Pillar",
  "Rocker Panel (L)",
  "Rocker Panel (R)",
  "Roof Panel",
  "Sunroof Glass",
  "A-Pillar (L)",
  "A-Pillar (R)",
  "Wheels / Alloys",
  "Underbody / Frame",
  "Airbags / Interior",
] as const;

export const DAMAGE_TYPES = [
  "Dent",
  "Scratch",
  "Crack",
  "Shatter",
  "Deformation",
  "Paint Damage",
  "Missing Part",
] as const;

export const SEVERITIES = ["Minor", "Moderate", "Severe"] as const;

export const VIEW_ANGLES = [
  "Front",
  "Rear",
  "Left",
  "Right",
  "Roof",
  "Interior",
  "Unknown",
] as const;

export const MANDATORY_VIEWS = [
  "Front",
  "Rear",
  "Left",
  "Right",
  "Roof",
  "Interior",
] as const;

export const RECOMMENDATIONS = ["Repair", "Replace"] as const;

export type PartName = (typeof PART_TAXONOMY)[number];
export type DamageType = (typeof DAMAGE_TYPES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type ViewAngle = (typeof VIEW_ANGLES)[number];
export type Recommendation = (typeof RECOMMENDATIONS)[number];

export type NormalizedBBox = {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
};

export type SurveyStatus =
  | "COMPLETED"
  | "PARTIAL"
  | "REVIEW_REQUIRED"
  | "FAILED";

export type DamageAssessmentRequest = {
  request_id: string;
  survey_id: string;
  idempotency_key: string;
  images: {
    image_id: string;
    url: string;
    declared_view?: string;
  }[];
};

export type DamageInstance = {
  instance_id: string;
  image_id: string;
  part_name: string;
  damage_type: DamageType;
  severity: Severity;
  recommendation: Recommendation;
  bounding_box: NormalizedBBox;
  location_on_part?: string;
  side?: string;
  confidence: number;
  visibility: "FULL" | "PARTIAL" | "OCCLUDED";
  view_angle: ViewAngle;
  verification_status?: "confirmed" | "pending_review";
};

export type DamageEvidence = {
  image_id: string;
  instance_id: string;
};

export type ImageResult = {
  image_id: string;
  url: string;
  declared_view?: string;
  view_angle: ViewAngle;
  view_confidence?: number;
  view_conflict?: boolean;
  processing_status: string;
  image_quality?: { status: string; reason?: string };
  duplicate_kind?: "NONE" | "DUPLICATE_EXACT" | "DUPLICATE_NEAR";
  canonical_image_id?: string;
  damages: DamageInstance[];
  annotated_image_url?: string | null;
  error_code?: string;
};

export type DamageCluster = {
  cluster_id: string;
  part_name: string;
  damage_type: DamageType;
  severity: Severity;
  recommendation: Recommendation;
  location_on_part?: string;
  evidence_image_ids: string[];
  evidence?: DamageEvidence[];
  match_score?: number;
  review_candidate?: boolean;
};

export type M02Report = {
  schema_version: "m02.v1";
  request_id: string;
  survey_id: string;
  status: SurveyStatus;
  images: ImageResult[];
  damage_clusters: DamageCluster[];
  vehicle_damage_summary: {
    parts_affected: number;
    repair_count: number;
    replace_count: number;
    total_damages: number;
  };
  survey_coverage: {
    status: "COMPLETE" | "INCOMPLETE";
    detected_views: string[];
    missing_views: string[];
  };
  overall_damage_score: number;
  review: {
    flags: string[];
    requires_human_review: boolean;
  };
  processing: {
    model: string;
    prompt_version: string;
    latency_ms: number;
    latency_sec?: number;
    images_processed: number;
    images_skipped: number;
    idempotency_key?: string;
    spatial_model?: string | null;
    annotation_style?: string;
    gemini_image_max_edge?: number;
    verification_calls?: number;
    region_proposals?: number;
    gemini_region_calls?: number;
    gemini_input_tokens?: number;
    gemini_output_tokens?: number;
    estimated_cost_usd?: number;
    estimated_cost_inr?: number;
  };
  failed_images?: { image_id: string; error_code: string }[];
};
