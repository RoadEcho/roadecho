import crypto from 'crypto';

export function getPlateHash(plate: string, state: string, country: string = 'USA'): string {
  const salt = process.env.PLATE_HASH_SALT || 'roadecho-default-secure-salt-change-in-production';
  return crypto
    .createHash('sha256')
    .update(`${country.trim().toUpperCase()}:${state.trim().toUpperCase()}:${plate.trim().toUpperCase()}:${salt}`)
    .digest('hex');
}
