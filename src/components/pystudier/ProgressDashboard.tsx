import { motion } from "framer-motion";
import { Trophy, Flame, CheckCircle2 } from "lucide-react";
import mascot from "@/assets/mascot.png";

interface ProgressDashboardProps {
  userId: string;
}

const ProgressDashboard = ({ userId }: ProgressDashboardProps) => {
  // Placeholder metrics - these would be computed from real data
  const metrics = [
    { label: "Cards Mastered", value: 0, icon: CheckCircle2, emoji: "✅", color: "text-primary" },
    { label: "Quizzes Passed", value: 0, icon: Trophy, emoji: "🏆", color: "text-coral" },
    { label: "Study Streak", value: 0, icon: Flame, emoji: "🔥", color: "text-sunshine" },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 sm:p-4 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
        <h2 className="font-display font-bold text-foreground flex items-center gap-2 text-sm sm:text-base">
          <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          Progress Dashboard
        </h2>
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Track your study progress</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3">
          <img src={mascot} alt="Pylo" className="w-14 h-14 sm:w-20 sm:h-20 object-contain pylo-appear pylo-idle" />
          <p className="font-display font-bold text-foreground text-center text-sm sm:text-base">Keep it up! 💪</p>
        </motion.div>

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
                <p className={`text-2xl sm:text-3xl font-display font-black ${m.color}`}>{m.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="p-4 rounded-2xl bg-secondary/50 border border-border text-center">
          <p className="text-xs sm:text-sm text-muted-foreground font-body">
            Progress tracking is coming soon! Complete quizzes and flashcards to see your stats here.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProgressDashboard;
