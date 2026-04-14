import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const SW_PATH = "/sw.js";

export const useLocationPing = (activeSessionId: string | null) => {
  const swRef = useRef<ServiceWorker | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const getAuthToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const sendMessage = useCallback((message: object) => {
    if (swRef.current) {
      swRef.current.postMessage(message);
    }
  }, []);

  // Register service worker once
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register(SW_PATH).then((registration) => {
      registrationRef.current = registration;
      const sw = registration.active ?? registration.installing ?? registration.waiting;
      if (sw) swRef.current = sw;

      registration.addEventListener("updatefound", () => {
        const newSw = registration.installing;
        if (newSw) {
          newSw.addEventListener("statechange", () => {
            if (newSw.state === "activated") swRef.current = newSw;
          });
        }
      });
    }).catch(() => {
      // Service workers not available (e.g. non-HTTPS dev environment) — fail silently
    });

    // Listen for messages from SW (e.g. location lost)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "LOCATION_LOST") {
        // Dispatch a custom event that the dashboard can listen to
        window.dispatchEvent(new CustomEvent("location-ping-lost", { detail: event.data }));
      }
    };
    navigator.serviceWorker.addEventListener("message", handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, []);

  // Start/stop pinging based on active session
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const startOrStop = async () => {
      if (activeSessionId) {
        const token = await getAuthToken();
        if (!token) return;
        sendMessage({
          type: "START_PINGING",
          payload: {
            sessionId: activeSessionId,
            supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
            supabaseAnonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            authToken: token,
          },
        });
      } else {
        sendMessage({ type: "STOP_PINGING" });
      }
    };

    startOrStop();
  }, [activeSessionId, sendMessage, getAuthToken]);

  // Refresh token in SW when Supabase session refreshes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.access_token) {
        sendMessage({ type: "UPDATE_TOKEN", payload: { authToken: session.access_token } });
      }
    });
    return () => subscription.unsubscribe();
  }, [sendMessage]);
};
