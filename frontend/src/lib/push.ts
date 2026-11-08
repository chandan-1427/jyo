import { apiFetch } from "@/lib/api/api";

// What this browser can do about notifications, from the person's side:
// - unsupported: no Web Push here at all.
// - needs-install: an iPhone or iPad, where it works only once Jyo is added
//   to the Home Screen.
// - blocked: they said no; only the browser's site settings can undo it.
// - off / on: whether this browser gets Jyo's notifications.
export type PushState = "unsupported" | "needs-install" | "blocked" | "off" | "on";

const isAppleMobile = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isInstalled = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const hasPush = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// The browser wants the key as raw bytes; the server hands it out base64url.
export function keyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function existingSubscription() {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export async function getPushState(): Promise<PushState> {
  if (!hasPush()) return isAppleMobile() && !isInstalled() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";
  return (await existingSubscription()) ? "on" : "off";
}

// null when the server has push turned off: the app then doesn't offer it.
export async function getServerKey(): Promise<string | null> {
  const { publicKey } = await apiFetch("/push/public-key");
  return publicKey ?? null;
}

async function subscribeAndSave(publicKey: string) {
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) }));
  await apiFetch("/push/subscriptions", { method: "POST", body: JSON.stringify(subscription.toJSON()) });
}

// Asks the browser for permission (only ever from a tap), then subscribes.
export async function enablePush() {
  const publicKey = await getServerKey();
  if (!publicKey) throw new Error("Notifications aren't available right now.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked for Jyo in this browser. Allow them in the site settings, then try again."
        : "Notifications weren't turned on."
    );
  }
  await subscribeAndSave(publicKey);
}

export async function disablePush() {
  if (!hasPush()) return;
  const subscription = await existingSubscription();
  if (!subscription) return;
  await apiFetch("/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint: subscription.endpoint }) });
  await subscription.unsubscribe();
}

// After signing in: a browser that already allowed notifications is
// subscribed again for whoever is signed in now, without asking. Logging out
// unsubscribes it, so it never keeps getting someone else's notifications.
export async function syncPush() {
  if (!hasPush() || Notification.permission !== "granted") return;
  const publicKey = await getServerKey();
  if (publicKey) await subscribeAndSave(publicKey);
}
