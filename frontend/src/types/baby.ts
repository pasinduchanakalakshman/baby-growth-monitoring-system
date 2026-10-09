export interface BabyProfile {
  id: number;
  owner_id: number;
  name: string;
  sex: 'Male' | 'Female';
  date_of_birth: string; // ISO date string
  birth_weight_kg: number;
  birth_length_cm?: number | null;
  gestational_age_weeks?: number | null;
  birth_order?: number | null;
  delivery_type?: string | null;
  apgar_score_5min?: number | null;
}

export interface BabyRegistrationRequest {
  name: string;
  sex: 'Male' | 'Female';
  date_of_birth: string;
  birth_weight_kg: number;
  birth_length_cm?: number;
  gestational_age_weeks?: number;
  birth_order?: number;
  delivery_type?: string;
  apgar_score_5min?: number;
}

export interface BabyUpdateRequest {
  name?: string;
  birth_length_cm?: number;
  gestational_age_weeks?: number;
  birth_order?: number;
  delivery_type?: string;
  apgar_score_5min?: number;
}
