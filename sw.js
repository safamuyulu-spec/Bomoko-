// Service worker minimal : rend Bomoko installable sur l'écran d'accueil.
// Il ne met aucune page en cache : les mises à jour de l'app restent immédiates.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
