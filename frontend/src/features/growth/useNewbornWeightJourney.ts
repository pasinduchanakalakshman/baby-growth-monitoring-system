import { useQuery } from '@tanstack/react-query';
import { growthApi } from '@/api/growth';
import type { BabyProfile } from '@/types/baby';

export function useNewbornWeightJourney(baby?: BabyProfile, enabled = true) {
  return useQuery({
    queryKey: ['growth.newbornJourney', baby?.id, baby?.birth_weight_kg, baby?.sex, baby?.gestational_age_weeks],
    queryFn: growthApi.getNewbornWeightJourney,
    enabled: enabled && !!baby,
    retry: false,
  });
}
