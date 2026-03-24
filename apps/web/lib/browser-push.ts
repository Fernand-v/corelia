import type { BrowserPushSubscriptionPayload } from "@corelia/types";

export const isBrowserPushSupported = () =>
  typeof window !== "undefined" &&
  "Notification" in window &&
  "serviceWorker" in navigator &&
  "PushManager" in window;

const isLoopbackHost = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

export const registerBrowserPushServiceWorker = async () => {
  try {
    // Registrar el SW (puede ya estar registrado)
    await navigator.serviceWorker.register("/notifications-sw.js", {
      scope: "/"
    });
    // Esperar a que haya un SW activo antes de llamar pushManager.subscribe()
    // navigator.serviceWorker.ready resuelve solo cuando el SW está en estado "activated"
    return await navigator.serviceWorker.ready;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (
      typeof window !== "undefined" &&
      window.location.protocol === "https:" &&
      isLoopbackHost(window.location.hostname) &&
      /ssl|certificate|certificado/i.test(message)
    ) {
      throw new Error(
        `El certificado HTTPS local no es válido para Service Worker. Abre Corelia en http://${window.location.host}${window.location.pathname} y vuelve a activar push.`
      );
    }

    throw error instanceof Error
      ? error
      : new Error("No se pudo registrar el Service Worker de notificaciones");
  }
};

export const urlBase64ToUint8Array = (value: string) => {
  const normalized = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output;
};

export const serializePushSubscription = (
  subscription: PushSubscription
): BrowserPushSubscriptionPayload => {
  const json = subscription.toJSON();
  const auth = json.keys?.auth;
  const p256dh = json.keys?.p256dh;

  if (!auth || !p256dh) {
    throw new Error("La suscripción push del navegador no incluye claves válidas");
  }

  return {
    endpoint: subscription.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: {
      auth,
      p256dh
    }
  };
};
