import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AuthPage from "@/components/pystudier/AuthPage";
import StudyDashboard from "@/components/pystudier/StudyDashboard";
import Onboarding from "@/components/pystudier/Onboarding";
import type { Session } from "@supabase/supabase-js";


const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [profileName, setProfileName] = useState("");

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
    if (!session) {
      setProfileChecked(false);
      setNeedsOnboarding(false);
      return;
    }
    const checkOnboarding = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, onboarding_complete")
        .eq("user_id", session.user.id)
        .single();
      if (data) {
        setProfileName(data.display_name || "");
        setNeedsOnboarding(!data.onboarding_complete);
      } else {
        setNeedsOnboarding(true);
      }
      setProfileChecked(true);
    };
    checkOnboarding();
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] gradient-hero flex flex-col items-center justify-center gap-4">
        <div className="animate-pulse font-display font-black text-2xl">
          <span className="text-primary">Py</span>
          <span className="text-coral">studier</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthPage onAuthSuccess={() => {}} />;
  }

  if (!profileChecked) {
    return (
      <div className="min-h-[100dvh] gradient-hero flex flex-col items-center justify-center gap-4">
        <div className="animate-pulse font-display font-black text-2xl">
          <span className="text-primary">Py</span>
          <span className="text-coral">studier</span>
        </div>
      </div>
    );
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
          }).eq("user_id", session.user.id);
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
