self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  let payload = null;

  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "Corelia",
      body: event.data.text(),
      path: "/notifications"
    };
  }

  const title = typeof payload?.title === "string" && payload.title.length > 0
    ? payload.title
    : "Corelia";
  const body = typeof payload?.body === "string" && payload.body.length > 0
    ? payload.body
    : "Tienes una nueva notificación.";
  const path = typeof payload?.path === "string" && payload.path.startsWith("/")
    ? payload.path
    : "/notifications";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: typeof payload?.notificationId === "string" ? `corelia:${payload.notificationId}` : "corelia:notification",
      data: {
        path
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const path = typeof event.notification.data?.path === "string"
    ? event.notification.data.path
    : "/notifications";
  const targetUrl = new URL(path, self.location.origin).toString();

  event.waitUntil(
    self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});
