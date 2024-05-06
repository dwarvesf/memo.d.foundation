self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open('vault-cache').then(cache => {
      return cache.match(event.request).then(response => {
        if (response) {
          // If the request is in the cache, return the cached response
          return response;
        } else {
          // If the request is not in the cache, fetch it from the network, cache it, and return the network response
          return fetch(event.request).then(networkResponse => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }
      });
    })
  );
});
