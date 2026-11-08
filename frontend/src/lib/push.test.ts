import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { disablePush, enablePush, getPushState, keyToBytes, syncPush } from "./push";

const PUBLIC_KEY = "BGgz9OjYewYVHeI23gxKkPHStLGquj_m236E9EMzR8FkBi9SSOiaGgoB_haBGwM3CIIuavn0utvm9_svGOJAgCw";
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc";

type Fake = {
  permission: NotificationPermission;
  answer: NotificationPermission;
  subscription: { endpoint: string; toJSON: () => unknown; unsubscribe: ReturnType<typeof vi.fn> } | null;
};

let fake: Fake;
let fetchMock: ReturnType<typeof vi.fn>;
const subscribe = vi.fn();

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function installBrowser() {
  const pushManager = {
    getSubscription: async () => fake.subscription,
    subscribe: async (options: unknown) => {
      subscribe(options);
      fake.subscription = {
        endpoint: ENDPOINT,
        toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: "p", auth: "a" } }),
        unsubscribe: vi.fn().mockResolvedValue(true),
      };
      return fake.subscription;
    },
  };
  const registration = { pushManager };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: vi.fn().mockResolvedValue(registration),
      getRegistration: vi.fn().mockResolvedValue(registration),
      ready: Promise.resolve(registration),
    },
  });
  vi.stubGlobal("PushManager", function PushManager() {});
  vi.stubGlobal("Notification", {
    get permission() {
      return fake.permission;
    },
    requestPermission: vi.fn(async () => (fake.permission = fake.answer)),
  });
}

beforeEach(() => {
  fake = { permission: "default", answer: "granted", subscription: null };
  subscribe.mockClear();
  fetchMock = vi.fn(async (url: string) => (url.endsWith("/push/public-key") ? json({ publicKey: PUBLIC_KEY }) : json({ ok: true })));
  vi.stubGlobal("fetch", fetchMock);
  installBrowser();
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

const calls = (path: string) => fetchMock.mock.calls.filter(([url]) => url === `https://api.test${path}`);

describe("keyToBytes", () => {
  it("turns the server's base64url key into the 65 raw bytes browsers expect", () => {
    const bytes = keyToBytes(PUBLIC_KEY);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4);
  });
});

describe("getPushState", () => {
  it("is off until allowed and subscribed, then on", async () => {
    expect(await getPushState()).toBe("off");
    await enablePush();
    expect(await getPushState()).toBe("on");
  });

  it("is blocked once the person said no", async () => {
    fake.permission = "denied";
    expect(await getPushState()).toBe("blocked");
  });

  it("tells an iPhone user to add Jyo to the Home Screen first", async () => {
    Reflect.deleteProperty(navigator, "serviceWorker");
    vi.stubGlobal("PushManager", undefined);
    Reflect.deleteProperty(window, "PushManager");
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    expect(await getPushState()).toBe("needs-install");
  });
});

describe("enablePush", () => {
  it("asks permission, subscribes with the server's key and saves the subscription", async () => {
    await enablePush();

    const options = subscribe.mock.calls[0][0];
    expect(options.userVisibleOnly).toBe(true);
    expect(options.applicationServerKey).toEqual(keyToBytes(PUBLIC_KEY));
    const [saved] = calls("/push/subscriptions");
    expect(JSON.parse(saved[1].body)).toEqual({ endpoint: ENDPOINT, keys: { p256dh: "p", auth: "a" } });
  });

  it("explains a refusal and saves nothing", async () => {
    fake.answer = "denied";
    await expect(enablePush()).rejects.toThrow(/blocked for Jyo/);
    expect(subscribe).not.toHaveBeenCalled();
    expect(calls("/push/subscriptions")).toHaveLength(0);
  });

  it("isn't offered when the server has push turned off", async () => {
    fetchMock.mockImplementation(async () => json({ publicKey: null }));
    await expect(enablePush()).rejects.toThrow(/aren't available/);
    expect(Notification.requestPermission).not.toHaveBeenCalled();
  });
});

describe("disablePush", () => {
  it("tells the server, then unsubscribes the browser", async () => {
    await enablePush();
    const subscription = fake.subscription!;

    await disablePush();

    const [removed] = calls("/push/unsubscribe");
    expect(JSON.parse(removed[1].body)).toEqual({ endpoint: ENDPOINT });
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });
});

describe("syncPush", () => {
  it("never asks for permission by itself", async () => {
    await syncPush();
    expect(Notification.requestPermission).not.toHaveBeenCalled();
    expect(calls("/push/subscriptions")).toHaveLength(0);
  });

  it("re-saves the subscription for whoever is signed in, once allowed", async () => {
    fake.permission = "granted";
    await syncPush();
    expect(calls("/push/subscriptions")).toHaveLength(1);
  });
});
