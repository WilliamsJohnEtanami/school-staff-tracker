import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import LogoMark from "@/components/LogoMark";

const TEST_ADMIN = {
  email: "admin@school.edu",
  password: "admin123",
  name: "Admin",
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const { signIn, role, session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const normalizedEmail = email.trim().toLowerCase();
  const isAdminRecoveryEmail = normalizedEmail === TEST_ADMIN.email;

  useEffect(() => {
    if (role === "admin") navigate("/admin", { replace: true });
    else if (role === "staff") navigate("/staff", { replace: true });
  }, [role, navigate]);

  const extractFunctionErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === "object" && error !== null) {
      const maybeError = error as {
        message?: string;
        context?: { data?: string | { error?: string } };
      };

      if (maybeError.message) {
        return maybeError.message;
      }

      const data = maybeError.context?.data;
      if (typeof data === "string") {
        try {
          const parsed = JSON.parse(data);
          if (parsed?.error) {
            return parsed.error;
          }
        } catch {
          return data;
        }
      }

      if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
        return data.error;
      }
    }

    return "Unable to restore admin access right now.";
  };

  const restoreAdminAccess = async (autoTriggered = false) => {
    if (!isAdminRecoveryEmail) {
      if (!autoTriggered) {
        toast({
          title: "Admin Recovery Email Required",
          description: `Use ${TEST_ADMIN.email} to restore the original admin account.`,
          variant: "destructive",
        });
      }

      return false;
    }

    if (password.length < 6) {
      if (!autoTriggered) {
        toast({
          title: "Password Required",
          description: "Enter the admin password first so the account can be restored.",
          variant: "destructive",
        });
      }

      return false;
    }

    setRecoveryLoading(true);

    try {
      const response = await supabase.functions.invoke("setup-admin", {
        body: {
          name: TEST_ADMIN.name,
          email: normalizedEmail,
          password,
        },
      });

      if (response.error) {
        throw new Error(extractFunctionErrorMessage(response.error));
      }

      if (!session) {
        const { error: signInError } = await signIn(normalizedEmail, password);
        if (signInError) {
          throw signInError;
        }
      }

      toast({
        title: "Admin Access Restored",
        description: "Redirecting you to the admin dashboard.",
      });

      window.location.assign("/admin");
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to restore admin access right now.";

      toast({
        title: autoTriggered ? "Admin Recovery Failed" : "Unable to Restore Admin Access",
        description: message,
        variant: "destructive",
      });

      return false;
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(normalizedEmail, password);
    setLoading(false);

    if (error) {
      if (isAdminRecoveryEmail) {
        const restored = await restoreAdminAccess(true);
        if (restored) {
          return;
        }
      }

      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border-0 shadow-primary/10">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit">
            <LogoMark className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">Staff Attendance System</CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in to mark your attendance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {session && !role ? (
              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription>
                  Your account is signed in, but this Supabase project is missing your app access.
                  If this is the school admin account, use <strong>{TEST_ADMIN.email}</strong> and click
                  Restore Admin Access.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@school.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((s) => !s)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading || recoveryLoading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sign In
            </Button>

            {isAdminRecoveryEmail ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loading || recoveryLoading}
                  onClick={() => {
                    void restoreAdminAccess();
                  }}
                >
                  {recoveryLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Restore Admin Access
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Use this after switching Supabase projects. It recreates or repairs the first admin account for
                  <strong> {TEST_ADMIN.email}</strong>.
                </p>
              </>
            ) : null}

            <div className="text-center">
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot your password?
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
