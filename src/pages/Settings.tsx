import { useState, useEffect } from "react";
import { ArrowLeft, Palette, CreditCard, Settings as SettingsIcon, GraduationCap, Link2, Unlink, Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }
    return "light";
  });
  const [classroomConnected, setClassroomConnected] = useState(false);
  const [classroomLoading, setClassroomLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkClassroom = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);
      const { data: profile } = await supabase
        .from("profiles" as any)
        .select("google_classroom_token")
        .eq("user_id", session.user.id)
        .single();
      setClassroomConnected(!!(profile as any)?.google_classroom_token);
    };
    checkClassroom();
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("pystudier-theme", next);
  };

  const handleClassroomConnect = async () => {
    setClassroomLoading(true);
    try {
      const REDIRECT_URI = `${window.location.origin}/classroom-callback`;
      const res = await supabase.functions.invoke("google-classroom", {
        body: { action: "get-auth-url", redirect_uri: REDIRECT_URI },
      });
      if (res.data?.url) {
        sessionStorage.setItem("gc_redirect", window.location.href);
        window.location.href = res.data.url;
      } else {
        toast.error("Could not start Google Classroom connection");
      }
    } catch {
      toast.error("Connection failed");
    } finally {
      setClassroomLoading(false);
    }
  };

  const handleClassroomDisconnect = async () => {
    setClassroomLoading(true);
    try {
      await supabase.functions.invoke("google-classroom", {
        body: { action: "disconnect" },
      });
      setClassroomConnected(false);
      toast.success("Google Classroom disconnected");
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setClassroomLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Header */}
      <header className="h-12 sm:h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-3 sm:px-4 gap-2 sm:gap-3 sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          className="rounded-xl h-8 w-8 sm:h-9 sm:w-9"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>
        <SettingsIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        <span className="font-display font-bold text-sm sm:text-base">Settings</span>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Theme */}
        <Card className="border-border shadow-sm">
          <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 sm:p-6">
            <div className="p-2 rounded-xl bg-secondary">
              <Palette className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base sm:text-lg font-display">Theme</CardTitle>
              <CardDescription className="text-xs sm:text-sm font-body">Switch between light and dark mode</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <button onClick={toggleTheme}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-background hover:bg-secondary transition-all w-full text-left">
              {theme === "light" ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-indigo-400" />}
              <div>
                <p className="font-display font-bold text-sm text-foreground">{theme === "light" ? "Light Mode" : "Dark Mode"}</p>
                <p className="text-xs text-muted-foreground">Tap to switch to {theme === "light" ? "dark" : "light"} mode</p>
              </div>
            </button>
          </CardContent>
        </Card>

        {/* Google Classroom */}
        <Card className="border-border shadow-sm">
          <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 sm:p-6">
            <div className="p-2 rounded-xl bg-secondary">
              <GraduationCap className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base sm:text-lg font-display">Google Classroom</CardTitle>
              <CardDescription className="text-xs sm:text-sm font-body">
                {classroomConnected ? "Connected" : "Connect to import assignments"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {classroomConnected ? (
              <button onClick={handleClassroomDisconnect} disabled={classroomLoading}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-all w-full text-left disabled:opacity-50">
                <Unlink className="w-5 h-5 text-destructive" />
                <div>
                  <p className="font-display font-bold text-sm text-destructive">Disconnect</p>
                  <p className="text-xs text-muted-foreground">Remove Google Classroom connection</p>
                </div>
              </button>
            ) : (
              <button onClick={handleClassroomConnect} disabled={classroomLoading}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all w-full text-left disabled:opacity-50">
                <Link2 className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-display font-bold text-sm text-primary">Connect</p>
                  <p className="text-xs text-muted-foreground">Sign in with Google to import assignments</p>
                </div>
              </button>
            )}
          </CardContent>
        </Card>

        {/* Subscription Placeholder */}
        <Card className="border-border shadow-sm opacity-70">
          <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 sm:p-6">
            <div className="p-2 rounded-xl bg-secondary">
              <CreditCard className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-display">Subscription</CardTitle>
              <CardDescription className="text-xs sm:text-sm font-body">Coming soon</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <p className="text-sm font-body text-muted-foreground">Manage your plan, billing, and usage. Premium features will be available in a future update.</p>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] sm:text-xs text-muted-foreground/50 font-body pt-4 pb-6">
          Pystudier © 2026
        </p>
      </div>
    </div>
  );
};

export default Settings;
