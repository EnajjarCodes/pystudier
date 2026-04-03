import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Flame, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ProgressDashboardProps {
  userId: string;
}

const ProgressDashboard = ({ userId }: ProgressDashboardProps) => {
  const [quizzesPassed, setQuizzesPassed] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const { data } = await supabase
          .from("study_progress" as any)
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (data && Array.isArray(data)) {
          // Quizzes where score >= 70%
          const quizzes = data.filter((d: any) => d.activity_type === "quiz_completed");
          const passed = quizzes.filter((d: any) => d.total > 0 && (d.score / d.total) >= 0.7).length;
          setQuizzesPassed(passed);

          // Total correct answers
          const correct = quizzes.reduce((sum: number, d: any) => sum + (d.score || 0), 0);
          setTotalCorrect(correct);

          // Study streak: consecutive days with activity
          const dates = new Set(data.map((d: any) => new Date(d.created_at).toDateString()));
          let s = 0;
          const today = new Date();
          for (let i = 0; i < 365; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            if (dates.has(d.toDateString())) {
              s++;
            } else if (i > 0) {
              break;
            }
          }
          setStreak(s);
        }
      } catch {}
      setLoading(false);
    };
    fetchProgress();
  }, [userId]);

  const metrics = [
    { label: "Questions Correct", value: totalCorrect, emoji: "✅", color: "text-primary" },
    { label: "Quizzes Passed", value: quizzesPassed, emoji: "🏆", color: "text-coral" },
    { label: "Study Streak", value: streak, emoji: "🔥", color: "text-sunshine", suffix: streak === 1 ? " day" : " days" },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 sm:p-4 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
        <h2 className="font-display font-bold text-foreground flex items-center gap-2 text-sm sm:text-base">
          <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          Progress Dashboard
        </h2>
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Track your study progress</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
        <div className="grid gap-3">
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-4 sm:p-5 rounded-2xl bg-card shadow-card border border-border flex items-center gap-4"
            >
              <div className="text-3xl sm:text-4xl">{m.emoji}</div>
              <div className="flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground font-body">{m.label}</p>
                <p className={`text-2xl sm:text-3xl font-display font-black ${m.color}`}>
                  {loading ? "—" : m.value}{!loading && m.suffix ? m.suffix : ""}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {!loading && totalCorrect === 0 && (
          <div className="p-4 rounded-2xl bg-secondary/50 border border-border text-center">
            <p className="text-xs sm:text-sm text-muted-foreground font-body">
              Complete quizzes to see your stats here! 📊
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressDashboard;
