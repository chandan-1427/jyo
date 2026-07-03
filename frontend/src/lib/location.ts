export type Coords = {
  lat: number;
  lng: number;
};

// Tirupati center — only used in development
const DEV_FALLBACK_COORDS: Coords = { lat: 14.3667, lng: 78.4667 };

export function getCurrentLocation(): Promise<Coords> {
  return new Promise((resolve, reject) => {

    // In local env — always use Tirupati fallback, skip GPS entirely
    if (import.meta.env.VITE_APP_ENV !== "production") {
      console.warn("[DEV] Using Tirupati fallback coordinates");
      resolve(DEV_FALLBACK_COORDS);
      return;
    }

    // Production — use real GPS
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(new Error("Location permission denied. Please allow location access to see nearby food."));
            break;
          case err.POSITION_UNAVAILABLE:
            reject(new Error("Location information is unavailable. Please try again."));
            break;
          case err.TIMEOUT:
            reject(new Error("Location request timed out. Please try again."));
            break;
          default:
            reject(new Error(`Location error: ${err.message}`));
        }
      },
      {
        timeout: 10000,
        maximumAge: 60000,
        enableHighAccuracy: false,
      }
    );
  });
}