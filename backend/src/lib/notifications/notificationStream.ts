import type { SSEStreamingApi } from "hono/streaming";

// In-memory per-user registry of open SSE connections. Safe because the
// backend runs as a single Node process (see index.ts) — no cross-instance
// fan-out to worry about.
const streamsByUserId = new Map<string, Set<SSEStreamingApi>>();

export function subscribe(userId: string, stream: SSEStreamingApi) {
  let streams = streamsByUserId.get(userId);
  if (!streams) {
    streams = new Set();
    streamsByUserId.set(userId, streams);
  }
  streams.add(stream);
}

export function unsubscribe(userId: string, stream: SSEStreamingApi) {
  const streams = streamsByUserId.get(userId);
  if (!streams) return;
  streams.delete(stream);
  if (streams.size === 0) streamsByUserId.delete(userId);
}

export async function publish(userId: string, payload: unknown) {
  const streams = streamsByUserId.get(userId);
  if (!streams || streams.size === 0) return;

  await Promise.all(
    Array.from(streams).map((stream) =>
      stream.writeSSE({ event: "notification", data: JSON.stringify(payload) })
    )
  );
}

// Called during graceful shutdown so open SSE connections don't block
// server.close() from resolving (Node waits for in-flight connections to
// end, and a long-lived stream never ends on its own).
export function closeAllStreams() {
  for (const streams of streamsByUserId.values()) {
    for (const stream of streams) {
      stream.close();
    }
  }
  streamsByUserId.clear();
}
