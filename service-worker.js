// service-worker.js
// Este archivo debe estar en el directorio raíz de tu aplicación para que el alcance funcione correctamente.

console.log('Service Worker: Registrado');

self.addEventListener('push', function(event) {
    const data = event.data.json();
    console.log('Notificación push recibida:', data);

    const title = data.title || 'Notificación';
    const options = {
        body: data.body || 'Contenido de la notificación.',
        icon: data.icon || '/static/icons/notification-icon.png', // Asegúrate de que esta ruta sea correcta
        badge: '/static/icons/badge-icon.png' // Opcional: un icono pequeño para la bandeja de notificaciones
        // Puedes añadir más opciones como image, vibrate, data, actions, etc.
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    console.log('Click en notificación recibido:', event.notification.tag);
    event.notification.close();

    // Puedes definir acciones aquí, por ejemplo, abrir una URL específica
    // event.waitUntil(clients.openWindow('https://tu-dominio-app.com/alguna-pagina'));
});
