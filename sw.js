// ========================================
// 📦 SERVICE WORKER - Schedule+
// ========================================

const CACHE_NAME = 'schedule-v2';
const OFFLINE_URL = '/';

// Daftar asset yang akan di-cache
const ASSETS = [
    '/',
    '/index.html',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
];

// ========================================
// 📥 INSTALL - Cache asset
// ========================================
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('✅ Service Worker: Caching assets...');
                return cache.addAll(ASSETS);
            })
            .then(() => {
                console.log('✅ Service Worker: Install complete!');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('❌ Service Worker: Install failed:', error);
            })
    );
});

// ========================================
// 🔄 ACTIVATE - Clean old caches
// ========================================
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log(`🗑️ Service Worker: Deleting old cache: ${name}`);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            console.log('✅ Service Worker: Activate complete!');
            return self.clients.claim();
        })
    );
});

// ========================================
// 🌐 FETCH - Serve from cache or network
// ========================================
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests (kecuali yang sudah di-cache)
    if (!event.request.url.startsWith(self.location.origin) && 
        !event.request.url.includes('cdn.tailwindcss.com') &&
        !event.request.url.includes('fonts.googleapis.com') &&
        !event.request.url.includes('firebaseio.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // 🔥 Firebase API - Network First
                if (event.request.url.includes('firebaseio.com')) {
                    return fetch(event.request)
                        .then((response) => {
                            // Cache response untuk offline
                            if (response && response.status === 200) {
                                const clonedResponse = response.clone();
                                caches.open(CACHE_NAME).then((cache) => {
                                    cache.put(event.request, clonedResponse);
                                });
                            }
                            return response;
                        })
                        .catch(() => {
                            // Offline: return cached or 503
                            return cachedResponse || new Response(
                                JSON.stringify({ error: 'Offline' }), 
                                { 
                                    status: 503, 
                                    headers: { 'Content-Type': 'application/json' } 
                                }
                            );
                        });
                }

                // 📦 Static Assets - Cache First
                if (cachedResponse) {
                    return cachedResponse;
                }

                // 🌐 Other requests - Network with cache fallback
                return fetch(event.request)
                    .then((response) => {
                        // Cache successful responses
                        if (response && response.status === 200) {
                            const clonedResponse = response.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, clonedResponse);
                            });
                        }
                        return response;
                    })
                    .catch(() => {
                        // Jika offline dan request adalah navigasi (halaman)
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

// ========================================
// 📤 PUSH NOTIFICATION (Optional)
// ========================================
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

// ========================================
// 🖱️ NOTIFICATION CLICK
// ========================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const url = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Cek apakah ada tab yang sudah terbuka
                for (const client of clientList) {
                    if (client.url === url && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Jika tidak ada, buka tab baru
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});

// ========================================
// 📊 ANALYTICS / REPORTING (Optional)
// ========================================
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('✅ Service Worker loaded!');
