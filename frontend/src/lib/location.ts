export type Coords = {
  lat: number;
  lng: number;
};

// Tirupati center — only used in development
const DEV_FALLBACK_COORDS: Coords = { lat: 13.6288, lng: 79.4192 };

export function getCurrentLocation(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        // In development — fall back to Tirupati coords silently
        // if (import.meta.env.DEV) {
        //   console.warn("[DEV] Location failed, using Tirupati fallback:", err.message);
        //   resolve(DEV_FALLBACK_COORDS);
        //   return;
        // }

        // In production — surface the real error to the user
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