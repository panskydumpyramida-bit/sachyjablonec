// Service worker pro upozornění na nový los
self.addEventListener('push', (event) => {
    let d = {};
    try { d = event.data ? event.data.json() : {}; } catch (e) { d = { title: 'Šachy Jablonec', body: event.data?.text() || '' }; }
    event.waitUntil(self.registration.showNotification(d.title || 'Los je venku', {
        body: d.body || '',
        icon: '/images/favicon.png',
        badge: '/images/favicon.png',
        tag: 'pardubice-los',
        renotify: true,
        data: { url: d.url || '/pardubice' },
    }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/pardubice';
    event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
        for (const c of list) if (c.url.includes('/pardubice') && 'focus' in c) return c.focus();
        return clients.openWindow(url);
    }));
});
