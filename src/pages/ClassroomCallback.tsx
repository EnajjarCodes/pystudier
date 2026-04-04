import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useGoogleClassroom } from "@/hooks/use-google-classroom";
import { supabase } from "@/integrations/supabase/client";

const ClassroomCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get("code");

  useEffect(() => {
    const handle = async () => {
      if (!code) {
        navigate("/");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/");
        return;
      }

      const redirectUri = `${window.location.origin}/classroom-callback`;
      const res = await supabase.functions.invoke("google-classroom", {
        body: { action: "exchange-code", code, redirect_uri: redirectUri },
      });

      const returnTo = sessionStorage.getItem("gc_redirect") || "/";
      sessionStorage.removeItem("gc_redirect");
      navigate(returnTo.replace(window.location.origin, "") || "/");
    };

    handle();
  }, [code, navigate]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-pulse font-display font-black text-2xl mb-2">
          <span className="text-primary">Py</span>
          <span className="text-coral">studier</span>
        </div>
        <p className="text-sm text-muted-foreground">Connecting Google Classroom...</p>
      </div>
    </div>
  );
};

export default ClassroomCallback;
