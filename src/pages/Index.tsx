import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AuthPage from "@/components/pystudier/AuthPage";
import StudyDashboard from "@/components/pystudier/StudyDashboard";
import Onboarding from "@/components/pystudier/Onboarding";
import type { Session } from "@supabase/supabase-js";

const getChatroomRedirect = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("chatroom_redirect");
  return redirect ? decodeURIComponent(redirect) : null;
};

const redirectToChatRoomWithSession = async (chatroomUrl: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const url = `${chatroomUrl}#access_token=${session.access_token}&refresh_token=${session.refresh_token}&token_type=bearer&expires_in=3600`;
    window.location.href = url;
  }
};

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [chatroomRedirect] = useState(() => getChatroomRedirect());

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (chatroomRedirect && session && !loading) {
      redirectToChatRoomWithSession(chatroomRedirect);
    }
  }, [chatroomRedirect, session, loading]);

  useEffect(() => {
    if (!session || chatroomRedirect) return;
    const checkOnboarding = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, onboarding_complete")
        .eq("id", session.user.id)
        .single();
      if (data) {
        if (!data.onboarding_complete) {
          setNeedsOnboarding(true);
          setProfileName(data.display_name || "");
        } else {
          setNeedsOnboarding(false);
          setProfileName(data.display_name || "");
        }
      } else {
        setNeedsOnboarding(true);
      }
    };
    checkOnboarding();
  }, [session, chatroomRedirect]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] gradient-hero flex items-center justify-center">
        <div className="animate-pulse font-display font-black text-2xl">
          <span className="text-primary">Py</span>
          <span className="text-coral">studier</span>
        </div>
      </div>
    );
  }

  if (chatroomRedirect && session) {
    return (
      <div className="min-h-[100dvh] gradient-hero flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse font-display font-black text-2xl mb-2">
            <span className="text-primary">Py</span>
            <span className="text-coral">studier</span>
          </div>
          <p className="text-sm text-muted-foreground">Taking you to Study Rooms…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthPage onAuthSuccess={() => {}} chatroomRedirect={chatroomRedirect} />;
  }

  if (needsOnboarding) {
    const existingName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || profileName || "";

    return (
      <Onboarding
        existingName={existingName || undefined}
        onComplete={async (data) => {
          await supabase.from("profiles").update({
            display_name: data.name,
            onboarding_complete: true,
            hardest_subject: data.hardestSubject,
            weekly_goal: data.weeklyGoal,
          }).eq("id", session.user.id);
          setProfileName(data.name);
          setNeedsOnboarding(false);
        }}
      />
    );
  }

  const userName = profileName || session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Student";

  return <StudyDashboard userName={userName} userId={session.user.id} />;
};

export default Index;
