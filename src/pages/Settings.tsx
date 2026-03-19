import { ArrowLeft, Palette, CreditCard, Settings as SettingsIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Settings = () => {
  const navigate = useNavigate();

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
        {/* Theme Placeholder */}
        <Card className="border-border shadow-sm opacity-70">
          <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 sm:p-6">
            <div className="p-2 rounded-xl bg-secondary">
              <Palette className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-display">Theme</CardTitle>
              <CardDescription className="text-xs sm:text-sm font-body">Coming soon</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <p className="text-sm font-body text-muted-foreground">Customize the look and feel of Pystudier. Dark mode, accent colors, and more — coming in a future update.</p>
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
