/**
 * Thin wrapper around the Web Notifications API that works inside the
 * Tauri webview and in the plain browser preview. Avoids the Tauri-only
 * `@tauri-apps/plugin-notification` so we don't need a Rust rebuild to
 * land this phase.
 */

let permissionPromise: Promise<NotificationPermission> | null = null;

export async function ensurePermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined") return "default";
  if (typeof Notification === "undefined") return "default";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  if (!permissionPromise) {
    permissionPromise = Notification.requestPermission().catch(() => "default");
  }
  return permissionPromise;
}

export interface NotifyOptions {
  body?: string;
  /** Tag is used for de-dup: re-issuing a notification with the same tag replaces the prior one. */
  tag?: string;
  silent?: boolean;
  onClick?: () => void;
}

export async function notify(title: string, options: NotifyOptions = {}): Promise<void> {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  const permission = await ensurePermission();
  if (permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body: options.body,
      tag: options.tag,
      silent: options.silent,
    });
    if (options.onClick) {
      n.addEventListener("click", () => {
        try {
          options.onClick?.();
          window.focus();
        } catch {
          /* swallow — notification handlers must never throw */
        }
      });
    }
  } catch {
    /* Permission may have been revoked between the check and the constructor; swallow. */
  }
}
