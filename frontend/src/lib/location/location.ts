export type Coords = {
  lat: number;
  lng: number;
};

// Tirupati center — only used in development
const DEV_FALLBACK_COORDS: Coords = { lat: 13.6288, lng: 79.4192 };

// Browsers report PERMISSION_DENIED both when this site is blocked and when
// the device isn't sharing location with the browser at all (Windows or
// macOS location turned off for Chrome/Edge), even while the site itself is
// set to Allow. The site's own permission state tells the cases apart, so
// the message can point at the setting that's actually off.
async function permissionDeniedMessage(): Promise<string> {
  let state: PermissionState | undefined;
  try {
    state = (await navigator.permissions?.query({ name: "geolocation" }))?.state;
  } catch {
    // Older browsers without the Permissions API fall through to the general message.
  }

  switch (state) {
    case "granted":
      return "Jyo is allowed to use your location, but your device isn't sharing it with your browser. Turn on location for your browser in your device settings, then try again.";
    case "denied":
      return "Location is blocked for Jyo in this browser. Open the site settings next to the address bar, allow Location, then try again.";
    case "prompt":
      return "The location request was closed before you answered. Try again and choose Allow.";
    default:
      return "We couldn't get your location. Check that location is allowed for Jyo in your browser and turned on in your device settings.";
  }
}

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
            permissionDeniedMessage().then((message) => reject(new Error(message)));
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