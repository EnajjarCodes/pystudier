import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, BarChart3, Menu, X, Plus, Clock, Trash2, LogOut, GraduationCap, Link2, Unlink } from "lucide-react";
import ProgressDashboard from "./ProgressDashboard";
import SessionFlow from "./SessionFlow";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useGoogleClassroom, type ClassroomItem } from "@/hooks/use-google-classroom";

interface StudyDashboardProps {
  userName: string;
  userId: string;
}

type Tab = "study" | "progress";

interface StudySession {
  id: string;
  title: string;
  current_step: string;
  quiz_topic: string | null;
  quiz_score: number | null;
  quiz_total: number | null;
  created_at: string;
  updated_at: string;
}

const StudyDashboard = ({ userName, userId }: StudyDashboardProps) => {
  const [activeTab, setActiveTab] = useState<Tab>("study");
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadSessions = useCallback(async () => {
    const { data } = await supabase
      .from("study_sessions" as any)
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (data) setSessions(data as any);
  }, [userId]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const startNewSession = () => {
    // Don't create DB record yet — SessionFlow creates it at quiz stage
    setActiveSessionId("new");
  };

  const deleteSession = async (id: string) => {
    await supabase.from("study_sessions" as any).delete().eq("id", id);
    if (activeSessionId === id) setActiveSessionId(null);
    loadSessions();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const tabs: { id: Tab; label: string; icon: typeof BookOpen }[] = [
    { id: "study", label: "Study", icon: BookOpen },
    { id: "progress", label: "Progress", icon: BarChart3 },
  ];

  // If a session is active, show SessionFlow
  if (activeSessionId) {
    return (
      <div className="h-[100dvh] min-h-0 bg-background flex flex-col overflow-hidden">
        <SessionFlow
          sessionId={activeSessionId === "new" ? undefined : activeSessionId}
          userName={userName}
          userId={userId}
          onBack={() => { setActiveSessionId(null); loadSessions(); }}
          onSessionCreated={(id) => setActiveSessionId(id)}
        />
      </div>
    );
  }

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="h-[100dvh] min-h-0 bg-background flex flex-col overflow-hidden">
      {/* Top Nav */}
      <header className="h-12 sm:h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-3 sm:px-4 gap-2 sm:gap-3 flex-shrink-0">
        <button onClick={() => setMenuOpen(!menuOpen)} className="p-1.5 sm:p-2 rounded-xl hover:bg-secondary transition-colors">
          {menuOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>
        <div className="flex items-baseline">
          <span className="font-display font-black text-primary text-base sm:text-lg">Py</span>
          <span className="font-display font-black text-coral text-base sm:text-lg">studier</span>
        </div>
        <div className="ml-auto" />
      </header>

      {/* Menu overlay */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenuOpen(false)} className="fixed inset-0 bg-foreground/20 z-40" />
            <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} className="fixed left-0 top-12 sm:top-14 bottom-0 w-72 sm:w-80 bg-card border-r border-border z-50 flex flex-col">
              <div className="p-4 border-b border-border">
                <p className="font-display font-bold text-foreground text-sm">👋 Hey, {userName}</p>
              </div>
              <div className="flex-1" />
              <div className="p-4 border-t border-border">
                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-destructive hover:bg-destructive/10 transition-colors text-sm font-body">
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar tabs */}
        <div className="hidden lg:flex flex-col w-14 xl:w-16 border-r border-border bg-card/50 items-center py-3 gap-2 flex-shrink-0">
          {tabs.map((tab) => (
            <motion.button key={tab.id} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setActiveTab(tab.id)}
              className={`p-2.5 sm:p-3 rounded-xl transition-all ${activeTab === tab.id ? "gradient-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:bg-secondary"}`}
              title={tab.label}>
              <tab.icon className="w-4 h-4 sm:w-5 sm:h-5" />
            </motion.button>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden pb-14 lg:pb-0 min-h-0">
          {activeTab === "study" && (
            <div className="flex flex-col h-full">
              <div className="p-3 sm:p-4 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0 flex items-center justify-between">
                <div>
                  <h2 className="font-display font-bold text-foreground text-sm sm:text-base flex items-center gap-2">
                    <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    Study Sessions
                  </h2>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Your guided learning experiences</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
                {/* Start Studying CTA */}
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={startNewSession}
                  className="w-full py-4 sm:py-5 rounded-2xl gradient-primary text-primary-foreground font-display font-bold text-base sm:text-lg shadow-soft flex items-center justify-center gap-2">
                  <Plus className="w-5 h-5" /> Start Studying
                </motion.button>

                {/* Sessions list */}
                {sessions.length === 0 ? (
                  <div className="text-center py-8 sm:py-12">
                    <BookOpen className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="font-display font-bold text-foreground text-sm sm:text-base">Let's start your first study session</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">Tap "Start Studying" above to begin!</p>
                  </div>
                ) : (
                  sessions.map((session, i) => (
                    <motion.div key={session.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="p-3 sm:p-4 rounded-2xl bg-card shadow-card border border-border hover:border-primary/30 transition-all cursor-pointer group"
                      onClick={() => setActiveSessionId(session.id)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display font-bold text-sm text-foreground truncate">{session.title || "Study Session"}</h3>
                          <div className="flex items-center gap-2 mt-1.5">
                            {session.quiz_topic && (
                              <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold truncate">
                                {session.quiz_topic}
                              </span>
                            )}
                            {session.quiz_score !== null && session.quiz_total !== null && (
                              <span className="text-[10px] sm:text-xs text-muted-foreground">
                                {session.quiz_score}/{session.quiz_total}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatDate(session.updated_at)}
                          </p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "progress" && (
            <ProgressDashboard userId={userId} />
          )}
        </div>

        {/* Mobile bottom tabs */}
        <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border flex lg:hidden z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${activeTab === tab.id ? "text-primary" : "text-muted-foreground"}`}>
              <tab.icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StudyDashboard;
