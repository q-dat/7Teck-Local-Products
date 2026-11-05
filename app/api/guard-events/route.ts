import { connectMongo } from "@/lib/mongodb";
import {
  API_GUARD_DOCUMENT_KEY,
  type ApiGuardState,
} from "@/lib/api-guard/contracts";
import { getApiGuardState } from "@/lib/api-guard/store";
import SystemControlModel from "@/models/SystemControl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SSE_HEADERS = {
  "Cache-Control": "no-cache, no-store, no-transform",
  Connection: "keep-alive",
  "Content-Type": "text/event-stream; charset=utf-8",
  "X-Accel-Buffering": "no",
};

const encoder = new TextEncoder();

const encodeGuardEvent = (state: ApiGuardState): Uint8Array =>
  encoder.encode(
    `id: ${state.revision}\nevent: api-guard\ndata: ${JSON.stringify(state)}\n\n`,
  );

export async function GET(request: Request): Promise<Response> {
  let changeStream: ReturnType<typeof SystemControlModel.watch> | null = null;
  let cleanupStream: (() => void) | null = null;

  try {
    await connectMongo();
    // Ensure both the collection and singleton document exist before opening
    // a collection-level Change Stream on a fresh deployment.
    await getApiGuardState();

    changeStream = SystemControlModel.watch(
      [{ $match: { "documentKey._id": API_GUARD_DOCUMENT_KEY } }],
      { fullDocument: "updateLookup" },
    );

    const activeChangeStream = changeStream;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

        const cleanup = (closeController: boolean): void => {
          if (closed) return;
          closed = true;

          if (heartbeatTimer !== null) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }

          request.signal.removeEventListener("abort", handleRequestAbort);
          activeChangeStream.removeListener("change", handleChange);
          activeChangeStream.removeListener("error", handleError);
          void activeChangeStream.close().catch(() => undefined);

          if (closeController) {
            try {
              controller.close();
            } catch {
              return;
            }
          }
        };

        function handleRequestAbort(): void {
          cleanup(true);
        }

        function sendState(state: ApiGuardState): void {
          if (closed) return;
          try {
            controller.enqueue(encodeGuardEvent(state));
          } catch {
            cleanup(false);
          }
        }

        function handleChange(): void {
          void getApiGuardState()
            .then(sendState)
            .catch((error: unknown) => {
              console.error(
                "[api-guard-events] Cannot read changed guard state:",
                error instanceof Error ? error.message : "Unknown error",
              );
              cleanup(true);
            });
        }

        function handleError(error: unknown): void {
          console.error(
            "[api-guard-events] MongoDB Change Stream error:",
            error instanceof Error ? error.message : "Unknown error",
          );
          cleanup(true);
        }

        cleanupStream = () => cleanup(false);
        activeChangeStream.on("change", handleChange);
        activeChangeStream.on("error", handleError);
        request.signal.addEventListener("abort", handleRequestAbort, {
          once: true,
        });

        controller.enqueue(
          encoder.encode(
            ": api-guard stream connected\nretry: 1000\n\n",
          ),
        );

        heartbeatTimer = setInterval(() => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(": keep-alive\n\n"));
          } catch {
            cleanup(false);
          }
        }, 20_000);

        // The change stream is attached before reading the snapshot. A revision
        // check in the browser rejects an older snapshot if a newer event wins
        // this small initialization race.
        void getApiGuardState()
          .then(sendState)
          .catch((error: unknown) => {
            console.error(
              "[api-guard-events] Cannot read initial guard state:",
              error instanceof Error ? error.message : "Unknown error",
            );
            cleanup(true);
          });
      },
      cancel() {
        cleanupStream?.();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: SSE_HEADERS,
    });
  } catch (error: unknown) {
    await changeStream?.close().catch(() => undefined);
    console.error(
      "[api-guard-events] Cannot open MongoDB Change Stream:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return Response.json(
      {
        ok: false,
        code: "API_GUARD_EVENTS_UNAVAILABLE",
        message:
          "Không thể mở kênh nhận lệnh realtime. Kiểm tra MongoDB Replica Set/Atlas và kết nối server.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    );
  }
}
