import { useLocation } from "@/contexts/LocationContext";
import { MapPinOff, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const LocationGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { permissionGranted, permissionDenied, loading, refreshLocation } = useLocation();

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
          Location access is required to use this system. Please enable location permissions in your browser settings and try again.
        </p>
        <Button onClick={refreshLocation} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Try Again
        </Button>
      </div>
    );
  }

  return <>{children}</>;
};

export default LocationGate;
