import { useLocation } from "@/contexts/LocationContext";
import { MapPinOff, Loader2, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

const LocationGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { permissionGranted, permissionDenied, loading, refreshLocation } = useLocation();

  const openLocationSettings = () => {
    // On Android Chrome, we can try to open app settings
    // On most browsers, we guide users to the right place
    const isAndroid = /android/i.test(navigator.userAgent);
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

    if (isAndroid) {
      // Try to open Android app settings (works on some browsers)
      window.open("intent://settings/location#Intent;scheme=android-app;end", "_blank");
    } else if (isIOS) {
      // iOS: open Settings app (only works from Safari in some cases)
      window.open("app-settings:", "_blank");
    }

    // Fallback: show a helpful message
    alert(
      "To enable location access:\n\n" +
      "1. Open your device Settings\n" +
      "2. Go to Privacy > Location Services\n" +
      "3. Find your browser and set it to 'Allow'\n" +
      "4. Come back here and tap 'Try Again'"
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Requesting location access...</p>
      </div>
    );
  }

  if (permissionDenied || !permissionGranted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-6 p-6">
        <div className="bg-destructive/10 p-6 rounded-full">
          <MapPinOff className="h-16 w-16 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground text-center">Location Access Required</h1>
        <p className="text-muted-foreground text-center max-w-md">
          Location access is required to use this system. Please enable location permissions in your browser or device settings and try again.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={openLocationSettings} variant="default" className="gap-2">
            <Settings className="h-4 w-4" /> Open Location Settings
          </Button>
          <Button onClick={refreshLocation} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Try Again
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default LocationGate;
