import "server-only";

import { getHub, type RealtimeEvent } from "./hub";

const HEARTBEAT_MS = 20_000;
// Streams are recycled regularly; EventSource reconnects on its own. This
// keeps us well inside proxy request limits and sheds dead connections.
const MAX_STREAM_MS = 4 * 60_000;
const RETRY_MS = 2_000;

/**
 * A Server-Sent Events response that emits a `change` event whenever one of
 * the topics is published. The client reacts by refetching the resource, so
 * the stream itself never carries private data.
 */
export function eventStream(request: Request, topicList: readonly string[]): Response {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      const send = (event: string, data: unknown) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      const unsubscribe = getHub().subscribe(topicList, (event: RealtimeEvent) => send("change", { type: event.type }));
      const heartbeat = setInterval(() => write(": keep-alive\n\n"), HEARTBEAT_MS);
      const lifetime = setTimeout(() => close(), MAX_STREAM_MS);

      function close() {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearTimeout(lifetime);
        unsubscribe();
        request.signal.removeEventListener("abort", close);
        try {
          controller.close();
        } catch {
          // Already closed by the client.
        }
      }

      cleanup = close;
      request.signal.addEventListener("abort", close);
      write(`retry: ${RETRY_MS}\n\n`);
      send("ready", {});
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // `no-transform` also stops Next's compression from buffering the stream.
      "Cache-Control": "no-cache, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
