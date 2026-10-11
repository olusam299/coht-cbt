/**
 * A stable random id for this browser, sent with every database request so the
 * server can allow a student's registration number on one device at a time.
 */
const KEY = "coht.device.id";
let memoryId: string | null = null;

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
    return id;
  } catch {
    // Storage can be blocked (private mode); fall back to an id for this page load.
    memoryId ??= crypto.randomUUID();
    return memoryId;
  }
}

/** A short human label such as "Chrome on Android", shown to the SuperAdmin. */
export function getDeviceLabel(): string {
  if (typeof navigator === "undefined") return "Unknown device";
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "device";
  const screenSize = typeof screen !== "undefined" ? ` (${screen.width}×${screen.height})` : "";
  return `${browser} on ${os}${screenSize}`;
}

export class DeviceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeviceConflictError";
  }
}

export const isDeviceConflictMessage = (message: string) => /active on another device/i.test(message);
