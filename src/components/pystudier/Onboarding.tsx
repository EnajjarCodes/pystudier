import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { isValidName } from "@/lib/profanity-filter";
import mascotWave from "@/assets/mascot-wave.png";

interface OnboardingProps {
  onComplete: (data: { name: string; hardestSubject: string; weeklyGoal: number }) => void;
  existingName?: string;
}

const SUBJECTS = [
  "Math", "Science", "Computer Science", "English",
  "Business", "Social Sciences", "Arts", "Professional",
];

const WEEKLY_GOALS = [
  { value: 3, label: "3 sessions", emoji: "📚" },
  { value: 5, label: "5 sessions", emoji: "🔥" },
  { value: 7, label: "7 sessions", emoji: "🏆" },
];

const Onboarding = ({ onComplete, existingName }: OnboardingProps) => {
  const startStep = existingName ? 1 : 0;
  const [step, setStep] = useState(startStep);
  const [name, setName] = useState(existingName || "");
  const [nameError, setNameError] = useState("");
  const [hardestSubject, setHardestSubject] = useState("");
  const [weeklyGoal, setWeeklyGoal] = useState(5);

  // Pylo intro text typewriter
  const [introText, setIntroText] = useState("");
  const [introDone, setIntroDone] = useState(false);
  const displayName = name.trim() || existingName || "";
  const fullIntro = `Hey${displayName ? ` ${displayName}` : ""}! I'm Pylo, your study buddy! 🦉 I'm here to help you learn, take notes, and ace your exams! Let me get to know you a bit better.`;

  useEffect(() => {
    if (step === 1) {
      let i = 0;
      setIntroText("");
      setIntroDone(false);
      const interval = setInterval(() => {
        if (i < fullIntro.length) {
          setIntroText(fullIntro.slice(0, i + 1));
          i++;
        } else {
          clearInterval(interval);
          setIntroDone(true);
        }
      }, 30);
      return () => clearInterval(interval);
    }
  }, [step]);

  const handleNameSubmit = () => {
    const result = isValidName(name);
    if (!result.valid) {
      setNameError(result.error || "Please enter a respectful real name.");
      return;
    }
    setNameError("");
    setStep(1);
  };

  const handleFinish = () => {
    onComplete({ name: name.trim(), hardestSubject, weeklyGoal });
  };

  return (
    <div className="min-h-[100dvh] gradient-hero flex items-center justify-center p-4">
      <div className="max-w-lg w-full flex flex-col items-center gap-6">
        {/* Mascot */}
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          <motion.img
            src={mascotWave}
            alt="Pylo the study owl"
            className="w-28 h-28 sm:w-40 sm:h-40 object-contain drop-shadow-lg"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-card rounded-2xl shadow-elevated p-5 sm:p-6 w-full"
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-card rotate-45 rounded-sm shadow-card" />

          <div className="relative z-10">
            <AnimatePresence mode="wait">
              {/* Step 0: Name */}
              {step === 0 && (
                <motion.div key="name" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="text-lg sm:text-xl font-display font-bold text-foreground text-center mb-4">
                    Hey there! What's your name?
                  </p>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => { setName(e.target.value); setNameError(""); }}
                      placeholder="Type your name here..."
                      autoFocus
                      className="w-full px-4 py-3 rounded-xl border-2 border-primary/20 bg-secondary/50 text-foreground font-body text-base text-center focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground"
                      onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
                    />
                    {nameError && (
                      <p className="text-xs text-destructive text-center font-body">{nameError}</p>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      disabled={!name.trim()}
                      onClick={handleNameSubmit}
                      className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-display font-bold text-base shadow-soft disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                      Continue <ArrowRight className="w-5 h-5" />
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* Step 1: Pylo intro */}
              {step === 1 && (
                <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className={`text-base sm:text-lg font-display font-bold text-foreground text-center min-h-[4rem] ${!introDone ? 'typing-cursor' : ''}`}>
                    {introText}
                  </p>
                  {introDone && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setStep(2)}
                      className="w-full mt-4 py-3 rounded-xl gradient-primary text-primary-foreground font-display font-bold text-base shadow-soft flex items-center justify-center gap-2"
                    >
                      Let's go! <ArrowRight className="w-5 h-5" />
                    </motion.button>
                  )}
                </motion.div>
              )}

              {/* Step 2: Hardest Subject */}
              {step === 2 && (
                <motion.div key="subject" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="text-base sm:text-lg font-display font-bold text-foreground text-center mb-4">
                    What subject do you find the hardest?
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {SUBJECTS.map((subject) => (
                      <motion.button
                        key={subject}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setHardestSubject(subject)}
                        className={`p-3 rounded-xl border-2 transition-all text-left flex items-center justify-between ${
                          hardestSubject === subject
                            ? "border-primary bg-primary/10 shadow-soft"
                            : "border-border bg-card hover:border-primary/40"
                        }`}
                      >
                        <span className="font-display font-bold text-sm text-foreground">{subject}</span>
                        {hardestSubject === subject && <Check className="w-3.5 h-3.5 text-primary" />}
                      </motion.button>
                    ))}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={!hardestSubject}
                    onClick={() => setStep(3)}
                    className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-display font-bold text-base shadow-soft disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    Continue <ArrowRight className="w-5 h-5" />
                  </motion.button>
                </motion.div>
              )}

              {/* Step 3: Weekly Goal */}
              {step === 3 && (
                <motion.div key="goal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="text-base sm:text-lg font-display font-bold text-foreground text-center mb-4">
                    Set your weekly study goal
                  </p>
                  <div className="space-y-2 mb-4">
                    {WEEKLY_GOALS.map((g) => (
                      <motion.button
                        key={g.value}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setWeeklyGoal(g.value)}
                        className={`w-full p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                          weeklyGoal === g.value
                            ? "border-primary bg-primary/10 shadow-soft"
                            : "border-border bg-card hover:border-primary/40"
                        }`}
                      >
                        <span className="text-xl">{g.emoji}</span>
                        <span className="font-display font-bold text-sm text-foreground">{g.label}</span>
                        {weeklyGoal === g.value && <Check className="w-4 h-4 text-primary ml-auto" />}
                      </motion.button>
                    ))}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleFinish}
                    className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-display font-bold text-base shadow-soft flex items-center justify-center gap-2"
                  >
                    Let's Study! <ArrowRight className="w-5 h-5" />
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Logo */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex items-center">
          <span className="text-xl sm:text-2xl font-display font-black text-primary tracking-tight">Py</span>
          <span className="text-xl sm:text-2xl font-display font-black text-coral tracking-tight">studier</span>
        </motion.div>
      </div>
    </div>
  );
};

export default Onboarding;
