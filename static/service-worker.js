// service-worker.js
// Este archivo manejará eventos en segundo plano para las notificaciones push.

self.addEventListener('install', (event) => {
    console.log('Service Worker instalado.');
    // Forzar que el service worker se active inmediatamente
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activado.');
    // Reclamar clientes para que el service worker tome el control de las páginas abiertas
    event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
    const data = event.data.json();
    console.log('Notificación push recibida:', data);

    const title = data.title || 'Notificación';
    const options = {
        body: data.body || 'Tienes un nuevo mensaje.',
        icon: data.icon || '/static/icons/notification-icon.png', // Asegúrate de que este icono existe en tu carpeta static/icons
        badge: '/static/icons/badge.png', // Un pequeño icono que se muestra en Android, si lo tienes
        data: {
            url: data.url || '/' // Si data.url no está definida, usa la raíz de la aplicación
        }
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    console.log('Clic en notificación:', event.notification);
    event.notification.close();

    const urlToOpen = event.notification.data.url;
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((windowClients) => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // Si no hay ventana abierta con esa URL, abre una nueva
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
