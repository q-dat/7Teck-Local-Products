import {
  normalizeApiGuardState,
  type ApiGuardState,
} from "@/lib/api-guard/contracts";

export type ApiGuardClientEvent =
  | { type: "state"; state: ApiGuardState }
  | { type: "connection"; connected: boolean };

type ApiGuardListener = (event: ApiGuardClientEvent) => void;

const API_GUARD_EVENTS_URL = "/api/guard-events";

const listeners = new Set<ApiGuardListener>();
const activeRequestControllers = new Set<AbortController>();

let eventSource: EventSource | null = null;
let latestState: ApiGuardState | null = null;
let isConnected = false;
let isClientLocked = true;

const publish = (event: ApiGuardClientEvent): void => {
  listeners.forEach((listener) => listener(event));
};

export const isApiGuardClientLocked = (): boolean => isClientLocked;

export const setApiGuardClientLocked = (locked: boolean): void => {
  isClientLocked = locked;

  if (!locked) return;

  activeRequestControllers.forEach((controller) => {
    if (!controller.signal.aborted) {
      controller.abort(
        new DOMException("API Guard đã khóa request", "AbortError"),
      );
    }
  });
};

export const registerApiGuardRequest = (
  controller: AbortController,
): (() => void) => {
  if (isClientLocked) {
    controller.abort(
      new DOMException("API Guard đang khóa request", "AbortError"),
    );
    return () => undefined;
  }

  activeRequestControllers.add(controller);
  return () => activeRequestControllers.delete(controller);
};

const closeEventSource = (): void => {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  isConnected = false;
  latestState = null;
  setApiGuardClientLocked(true);
};

const ensureEventSource = (): void => {
  if (typeof window === "undefined" || eventSource || listeners.size === 0) {
    return;
  }

  const source = new EventSource(API_GUARD_EVENTS_URL, {
    withCredentials: true,
  });
  eventSource = source;

  source.onopen = () => {
    isConnected = true;
    publish({ type: "connection", connected: true });
  };

  source.onerror = () => {
    isConnected = false;
    // Preserve the last server-confirmed Guard state. A transient SSE error
    // is not an ENABLE command; the HTTP middleware remains authoritative.
    publish({ type: "connection", connected: false });
  };

  source.addEventListener("api-guard", (event: Event) => {
    const message = event as MessageEvent<string>;

    try {
      const parsed: unknown = JSON.parse(message.data);
      const state = normalizeApiGuardState(parsed);
      if (!state) {
        // Ignore malformed snapshots without treating them as a lock command.
        publish({ type: "connection", connected: false });
        return;
      }

      if (latestState && state.revision < latestState.revision) return;

      latestState = state;
      setApiGuardClientLocked(state.enabled);
      publish({ type: "state", state });
    } catch {
      // A parsing failure is not an ENABLE command. Keep the last trusted state.
      publish({ type: "connection", connected: false });
    }
  });
};

/**
 * Shares one native EventSource connection across all guard consumers in this
 * browser tab. EventSource handles reconnects; there is no client polling loop.
 */
export const subscribeApiGuardEvents = (
  listener: ApiGuardListener,
): (() => void) => {
  const hasExistingSubscribers = listeners.size > 0;
  listeners.add(listener);

  if (hasExistingSubscribers) {
    if (isConnected) {
      listener({ type: "connection", connected: true });
      if (latestState) {
        listener({ type: "state", state: latestState });
      }
    } else {
      // A cached snapshot is not replayed while disconnected, but the last
      // confirmed client lock state is preserved. Connection loss alone must
      // never clear Local storage or be interpreted as ENABLE.
      listener({ type: "connection", connected: false });
    }
  } else {
    // A newly mounted page must receive a fresh server snapshot, never reuse a
    // stale DISABLED state from a previous connection lifetime.
    latestState = null;
    isConnected = false;
    setApiGuardClientLocked(true);
  }

  ensureEventSource();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) closeEventSource();
  };
};
