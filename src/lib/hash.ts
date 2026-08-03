import crypto from 'crypto';

export function getPlateHash(plate: string, state: string, country: string = 'USA'): string {
  const cleanPlate = plate ? plate.trim().toUpperCase() : '';
  const cleanState = state ? state.trim().toUpperCase() : '';
  const cleanCountry = country ? country.trim().toUpperCase() : 'USA';

  // Combine components into a standardized string
  const rawString = `${cleanPlate}:${cleanState}:${cleanCountry}`;

  // Use an optional environment salt or a default fallback for zero-knowledge hashing
  const salt = process.env.PLATE_HASH_SALT || 'roadecho-secure-salt';

  return crypto
    .createHmac('sha256', salt)
    .update(rawString)
    .digest('hex');
}
