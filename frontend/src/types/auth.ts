export interface AuthenticatedUser {
  id: number;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface ApiError {
  detail: string | Array<{ loc: string[], msg: string, type: string }>;
}
