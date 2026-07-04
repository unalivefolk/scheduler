// ========================================
// 📦 SERVICE WORKER - Schedule+
// ========================================

const CACHE_NAME = 'schedule-v2';
const OFFLINE_URL = '/';

const ASSETS = [
    '/',
    '/index.html',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
];

// INSTALL
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('✅ SW: Caching assets...');
                return cache.addAll(ASSETS);
            })
            .then(() => {
                console.log('✅ SW: Install complete!');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('❌ SW: Install failed:', error);
            })
    );
});

// ACTIVATE
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log(`🗑️ SW: Deleting old cache: ${name}`);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            console.log('✅ SW: Activate complete!');
            return self.clients.claim();
        })
    );
});

// FETCH
self.addEventListener('fetch', (event) => {
    if (!event.request.url.startsWith(self.location.origin) && 
        !event.request.url.includes('cdn.tailwindcss.com') &&
        !event.request.url.includes('fonts.googleapis.com') &&
        !event.request.url.includes('firebaseio.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Firebase API - Network First
                if (event.request.url.includes('firebaseio.com')) {
                    return fetch(event.request)
                        .then((response) => {
                            if (response && response.status === 200) {
                                const clonedResponse = response.clone();
                                caches.open(CACHE_NAME).then((cache) => {
                                    cache.put(event.request, clonedResponse);
                                });
                            }
                            return response;
                        })
                        .catch(() => {
                            return cachedResponse || new Response(
                                JSON.stringify({ error: 'Offline' }), 
                                { 
                                    status: 503, 
                                    headers: { 'Content-Type': 'application/json' } 
                                }
                            );
                        });
                }

                // Static Assets - Cache First
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Other requests - Network with cache fallback
                return fetch(event.request)
                    .then((response) => {
                        if (response && response.status === 200) {
                            const clonedResponse = response.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, clonedResponse);
                            });
                        }
                        return response;
                    })
                    .catch(() => {
                        if (event.request.mode === 'navigate') {
                            return caches.match(OFFLINE_URL);
                        }
                        return new Response('Offline - konten tidak tersedia', { 
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// PUSH NOTIFICATION (Optional)
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Schedule+';
    const options = {
        body: data.body || 'Ada update jadwal baru!',
        icon: data.icon || '/icon-192.png',
        badge: data.badge || '/icon-72.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/'
        }
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// NOTIFICATION CLICK
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const url = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if (client.url === url && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('✅ Service Worker loaded!');
