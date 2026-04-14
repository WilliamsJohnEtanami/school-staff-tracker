/* eslint-disable no-restricted-globals */

const PING_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
let pingTimer = null;
let activeSessionId = null;
let supabaseUrl = null;
let supabaseAnonKey = null;
let authToken = null;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
  const { type, payload } = event.data ?? {};

  if (type === "START_PINGING") {
    activeSessionId = payload.sessionId;
    supabaseUrl = payload.supabaseUrl;
    supabaseAnonKey = payload.supabaseAnonKey;
    authToken = payload.authToken;
    startPinging();
  }

  if (type === "STOP_PINGING") {
    stopPinging();
    activeSessionId = null;
  }

  if (type === "UPDATE_TOKEN") {
    authToken = payload.authToken;
  }
});

function startPinging() {
  stopPinging();
  // Ping immediately then on interval
  pingLocation();
  pingTimer = setInterval(pingLocation, PING_INTERVAL_MS);
}

function stopPinging() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

async function pingLocation() {
  if (!activeSessionId || !supabaseUrl || !authToken) return;

  try {
    const position = await getCurrentPosition();
    await sendPing({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      location_available: true,
    });
  } catch (err) {
    // Location unavailable — still log the event
    await sendPing({ latitude: 0, longitude: 0, location_available: false });
    // Notify all open clients
    notifyClients({ type: "LOCATION_LOST", sessionId: activeSessionId });
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!self.navigator?.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    self.navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

async function sendPing({ latitude, longitude, location_available }) {
  if (!supabaseUrl || !supabaseAnonKey || !authToken) return;

  try {
    await fetch(`${supabaseUrl}/functions/v1/location-ping`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
        "apikey": supabaseAnonKey,
      },
      body: JSON.stringify({
        session_id: activeSessionId,
        latitude,
        longitude,
        location_available,
      }),
    });
  } catch {
    // Silently fail — network may be unavailable
  }
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: "window" });
  clients.forEach(client => client.postMessage(message));
}
