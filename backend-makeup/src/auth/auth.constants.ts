export const JWT_SECRET = process.env.JWT_SECRET ?? 'makeupapp-dev-secret';
export const ADMIN_KEY = process.env.ADMIN_KEY ?? 'makeupapp-admin-key';
export const ACCESS_EXPIRES = '15m';
export const REFRESH_EXPIRES_HOURS = 2.5;
export const BCRYPT_COST = 10;
export const LOGIN_WINDOW_MS = 60 * 1000;
export const LOGIN_MAX_TENTATIVAS = 5;
export const ROLES_KEY = 'roles';

export interface AuthUserPayload {
  id: string;
  username: string;
  role: 'admin';
}
