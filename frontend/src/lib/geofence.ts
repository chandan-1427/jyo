// Mirrors backend/src/lib/haversine.ts exactly — used client-side only to
// decide whether to show the out-of-region demo gate on the Feed page. The
// backend independently re-checks distance on every geofenced route, so
// this copy never needs to be trusted as a security boundary.
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const TIRUPATI_CENTER = { lat: 13.6288, lng: 79.4192 };
const TIRUPATI_RADIUS_KM = 20;

export function isWithinTirupati(lat: number, lng: number): boolean {
  return haversineDistance(lat, lng, TIRUPATI_CENTER.lat, TIRUPATI_CENTER.lng) <= TIRUPATI_RADIUS_KM;
}
