// Service worker for Energy Wise push notifications
self.addEventListener("push", (event) => {
	let message = { title: "Energy Wise", body: "" };
	try {
		message = { ...message, ...event.data.json() };
	} catch {
		message.body = event.data ? event.data.text() : "";
	}

	event.waitUntil(
		self.registration.showNotification(message.title, {
			body: message.body,
			tag: message.tag,
			icon: "/android-chrome-192x192.png",
			badge: "/favicon-32x32.png",
			data: { url: message.url || "/" },
		}),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
			const open = clients.find((client) => client.url.startsWith(self.location.origin));
			return open ? open.focus() : self.clients.openWindow(url);
		}),
	);
});
