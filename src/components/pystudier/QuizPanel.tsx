import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, CheckCircle2, XCircle, Loader2, ArrowLeft, Shuffle,
  CircleDot, ToggleLeft, PenLine, Link2, BookOpen, Target,
  Hash, ToggleRight, Trophy, RotateCcw, ChevronRight, Award,
  TrendingUp, BookOpenCheck, Zap, Gauge, Flame
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { supabase } from "@/integrations/supabase/client";
import mascot from "@/assets/mascot.png";
import mascotThinking from "@/assets/mascot-thinking.png";

export interface QuizQuestion {
  type: "multiple_choice" | "true_false" | "written" | "matching";
  question: string;
  options: string[];
  correctAnswer: string;
  matchPairs?: { left: string; right: string }[];
  explanation: string;
}

interface QuizSetup {
  topic: string;
  questionTypes: string[];
  questionCount: number;
  checkAnswers: boolean;
  difficulty: "easy" | "normal" | "hard";
}

type QuizPhase = "setup" | "loading" | "taking" | "results";

interface QuizPanelProps {
  userName: string;
  userId: string;
  chatContext?: string;
}

const MAX_QUESTIONS = 50;
const QUESTION_TYPES = [
  { id: "multiple_choice", label: "Multiple Choice", icon: CircleDot },
  { id: "true_false", label: "True / False", icon: ToggleLeft },
  { id: "written", label: "Written Answer", icon: PenLine },
  { id: "matching", label: "Matching", icon: Link2 },
];

const DIFFICULTIES = [
  { id: "easy" as const, label: "Easy", icon: Zap, desc: "Simple recall" },
  { id: "normal" as const, label: "Normal", icon: Gauge, desc: "Balanced" },
  { id: "hard" as const, label: "Hard", icon: Flame, desc: "Complex reasoning" },
];

const QuizPanel = ({ userName, userId, chatContext }: QuizPanelProps) => {
  const [phase, setPhase] = useState<QuizPhase>("setup");
  const [setup, setSetup] = useState<QuizSetup>({
    topic: "",
    questionTypes: [],
    questionCount: 10,
    checkAnswers: true,
    difficulty: "normal",
  });
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [matchingAnswers, setMatchingAnswers] = useState<Record<number, Record<string, string>>>({});
  const [showAnswer, setShowAnswer] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [error, setError] = useState("");
  const [aiResults, setAiResults] = useState<Record<number, { correct: boolean; explanation: string }>>({});

  const toggleQuestionType = (typeId: string) => {
    setSetup((prev) => ({
      ...prev,
      questionTypes: prev.questionTypes.includes(typeId)
        ? prev.questionTypes.filter((t) => t !== typeId)
        : [...prev.questionTypes, typeId],
    }));
  };

  const generateQuiz = async () => {
    if (setup.questionTypes.length === 0 || !setup.topic.trim()) return;
    setPhase("loading");
    setError("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-quiz", {
        body: {
          topic: setup.topic,
          questionTypes: setup.questionTypes,
          questionCount: setup.questionCount,
          context: chatContext,
          difficulty: setup.difficulty,
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setQuestions(data.questions || []);
      setUserAnswers({});
      setMatchingAnswers({});
      setCurrentQ(0);
      setShowAnswer(false);
      setAiResults({});
      setPhase("taking");
    } catch (e: any) {
      setError(e.message || "Failed to generate quiz");
      setPhase("setup");
    }
  };

  const normalizeAnswer = (s: string) => s.toLowerCase().trim().replace(/[.,;:!?'"()]/g, "").replace(/\s+/g, " ");

  const checkAnswerWithAI = async (questionIdx: number, answer: string) => {
    const q = questions[questionIdx];
    try {
      const { data, error: fnError } = await supabase.functions.invoke("check-answer", {
        body: { userAnswer: answer, correctAnswer: q.correctAnswer, question: q.question },
      });
      if (fnError || data?.error) {
        const correct = normalizeAnswer(answer) === normalizeAnswer(q.correctAnswer);
        setAiResults((prev) => ({ ...prev, [questionIdx]: { correct, explanation: correct ? "" : q.explanation } }));
      } else {
        setAiResults((prev) => ({ ...prev, [questionIdx]: { correct: data.correct, explanation: data.correct ? "" : (data.explanation || q.explanation) } }));
      }
    } catch {
      const correct = normalizeAnswer(answer) === normalizeAnswer(q.correctAnswer);
      setAiResults((prev) => ({ ...prev, [questionIdx]: { correct, explanation: correct ? "" : q.explanation } }));
    }
  };

  const handleAnswer = async (answer: string) => {
    setUserAnswers((prev) => ({ ...prev, [currentQ]: answer }));
    if (setup.checkAnswers) {
      await checkAnswerWithAI(currentQ, answer);
      setShowAnswer(true);
    }
  };

  const handleMatchAnswer = (left: string, right: string) => {
    setMatchingAnswers((prev) => ({
      ...prev,
      [currentQ]: { ...(prev[currentQ] || {}), [left]: right },
    }));
  };

  const nextQuestion = () => {
    setShowAnswer(false);
    if (currentQ < questions.length - 1) {
      setCurrentQ((p) => p + 1);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    setPhase("results");

    // Save quiz progress
    const score = getScore();
    try {
      await supabase.from("study_progress" as any).insert({
        user_id: userId,
        activity_type: "quiz_completed",
        score,
        total: questions.length,
        topic: setup.topic,
      });
    } catch {}


    // Check all unchecked answers with AI
    const uncheckedPromises: Promise<void>[] = [];
    questions.forEach((q, i) => {
      if (q.type !== "matching" && !aiResults[i] && userAnswers[i]) {
        uncheckedPromises.push(checkAnswerWithAI(i, userAnswers[i]));
      }
    });
    if (uncheckedPromises.length > 0) await Promise.all(uncheckedPromises);

    const incorrectQuestions = questions
      .map((q, i) => {
        if (q.type === "matching") {
          const matches = matchingAnswers[i] || {};
          const pairs = q.matchPairs || [];
          const allCorrect = pairs.every((p) => matches[p.left] === p.right);
          if (!allCorrect) return { question: q.question, userAnswer: JSON.stringify(matches), correctAnswer: pairs.map((p) => `${p.left} → ${p.right}`).join(", ") };
          return null;
        }
        const result = aiResults[i];
        if (result && !result.correct) return { question: q.question, userAnswer: userAnswers[i] || "", correctAnswer: q.correctAnswer };
        if (!result) {
          const ua = userAnswers[i] || "";
          if (normalizeAnswer(ua) !== normalizeAnswer(q.correctAnswer)) return { question: q.question, userAnswer: ua, correctAnswer: q.correctAnswer };
        }
        return null;
      })
      .filter(Boolean);

    if (incorrectQuestions.length > 0) {
      setLoadingExplanation(true);
      try {
        const { data, error: fnError } = await supabase.functions.invoke("explain-answers", { body: { incorrectQuestions } });
        if (fnError) throw fnError;
        setExplanation(data?.explanation || "");
      } catch {
        setExplanation("Could not load explanations at this time.");
      }
      setLoadingExplanation(false);
    }
  };

  const getScore = () => {
    let correct = 0;
    questions.forEach((q, i) => {
      if (q.type === "matching") {
        const matches = matchingAnswers[i] || {};
        const pairs = q.matchPairs || [];
        if (pairs.every((p) => matches[p.left] === p.right)) correct++;
      } else if (aiResults[i]) {
        if (aiResults[i].correct) correct++;
      } else {
        if (normalizeAnswer(userAnswers[i] || "") === normalizeAnswer(q.correctAnswer)) correct++;
      }
    });
    return correct;
  };

  const resetQuiz = () => {
    setPhase("setup");
    setQuestions([]);
    setUserAnswers({});
    setMatchingAnswers({});
    setAiResults({});
    setExplanation("");
    setCurrentQ(0);
    setShowAnswer(false);
  };

  // ── Setup Phase ─────────────────────────────
  if (phase === "setup") {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 sm:p-4 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
          <h2 className="font-display font-bold text-foreground flex items-center gap-2 text-sm sm:text-base">
            <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            Quiz Creator
          </h2>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Configure your quiz settings</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-2 sm:gap-3">
            <img src={mascot} alt="Pylo" className="w-14 h-14 sm:w-20 sm:h-20 object-contain pylo-appear pylo-idle" />
            <p className="font-display font-bold text-foreground text-center text-sm sm:text-base">
              Let's test your knowledge, {userName}!
            </p>
          </motion.div>

          {error && <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs sm:text-sm font-body">{error}</div>}

          {/* Topic */}
          <div className="space-y-1.5 sm:space-y-2">
            <label className="font-display font-bold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
              What topic?
            </label>
            <input type="text" value={setup.topic} onChange={(e) => setSetup((p) => ({ ...p, topic: e.target.value }))} placeholder="e.g., Photosynthesis, World War 2, Python loops..."
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-border bg-background text-foreground font-body text-xs sm:text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground" />
          </div>

          {/* Difficulty */}
          <div className="space-y-1.5 sm:space-y-2">
            <label className="font-display font-bold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
              Difficulty
            </label>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {DIFFICULTIES.map((d) => (
                <motion.button key={d.id} whileTap={{ scale: 0.98 }} onClick={() => setSetup((p) => ({ ...p, difficulty: d.id }))}
                  className={`p-2.5 sm:p-3 rounded-xl border-2 transition-all text-center ${
                    setup.difficulty === d.id ? "border-primary bg-primary/10 shadow-soft" : "border-border bg-card hover:border-primary/40"
                  }`}>
                  <d.icon className={`w-4 h-4 sm:w-5 sm:h-5 mx-auto ${setup.difficulty === d.id ? "text-primary" : "text-muted-foreground"}`} />
                  <p className="font-display font-bold text-xs sm:text-sm text-foreground mt-1">{d.label}</p>
                  <p className="text-[10px] text-muted-foreground">{d.desc}</p>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Question Types */}
          <div className="space-y-1.5 sm:space-y-2">
            <label className="font-display font-bold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
              Question Types <span className="text-destructive">*</span>
            </label>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Select at least one</p>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              {QUESTION_TYPES.map((qt) => (
                <motion.button key={qt.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => toggleQuestionType(qt.id)}
                  className={`p-2.5 sm:p-3 rounded-xl border-2 transition-all text-left ${
                    setup.questionTypes.includes(qt.id) ? "border-primary bg-primary/10 shadow-soft" : "border-border bg-card hover:border-primary/40"
                  }`}>
                  <qt.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${setup.questionTypes.includes(qt.id) ? "text-primary" : "text-muted-foreground"}`} />
                  <p className="font-display font-bold text-xs sm:text-sm text-foreground mt-1">{qt.label}</p>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Question Count */}
          <div className="space-y-1.5 sm:space-y-2">
            <label className="font-display font-bold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
              How many questions? ({setup.questionCount})
            </label>
            <input type="range" min={1} max={MAX_QUESTIONS} value={setup.questionCount} onChange={(e) => setSetup((p) => ({ ...p, questionCount: parseInt(e.target.value) }))}
              className="w-full accent-[hsl(var(--primary))]" />
            <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground"><span>1</span><span>{MAX_QUESTIONS}</span></div>
          </div>

          {/* Check Answers */}
          <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-card shadow-card gap-3">
            <div className="min-w-0">
              <p className="font-display font-bold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                <ToggleRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary flex-shrink-0" />
                Check as you go?
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">See if each answer is correct immediately</p>
            </div>
            <button onClick={() => setSetup((p) => ({ ...p, checkAnswers: !p.checkAnswers }))}
              className={`w-11 h-6 sm:w-12 sm:h-7 rounded-full transition-all relative flex-shrink-0 ${setup.checkAnswers ? "bg-primary" : "bg-border"}`}>
              <div className={`absolute top-0.5 sm:top-1 w-5 h-5 rounded-full bg-card shadow transition-transform ${setup.checkAnswers ? "translate-x-5 sm:translate-x-6" : "translate-x-0.5 sm:translate-x-1"}`} />
            </button>
          </div>

          {/* Generate Button */}
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={setup.questionTypes.length === 0 || !setup.topic.trim()} onClick={generateQuiz}
            className="w-full py-3 sm:py-4 rounded-xl gradient-primary text-primary-foreground font-display font-bold text-sm sm:text-lg shadow-soft disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
            Generate Quiz <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </motion.button>
        </div>
      </div>
    );
  }

  // ── Loading Phase ───────────────────────────
  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 sm:gap-4 px-4">
        <img src={mascotThinking} alt="Pylo thinking" className="w-16 h-16 sm:w-20 sm:h-20 object-contain pylo-thinking" />
        <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-primary" />
        <p className="font-display font-bold text-foreground text-sm sm:text-base">Pylo is creating your quiz...</p>
        <p className="text-xs sm:text-sm text-muted-foreground">This might take a few seconds</p>
      </div>
    );
  }

  // ── Taking Phase ────────────────────────────
  if (phase === "taking") {
    const q = questions[currentQ];
    if (!q) return null;

    const isAnswered = q.type === "matching"
      ? Object.keys(matchingAnswers[currentQ] || {}).length === (q.matchPairs?.length || 0)
      : userAnswers[currentQ] !== undefined && userAnswers[currentQ] !== "";

    const isCorrect = q.type === "matching"
      ? (q.matchPairs || []).every((p) => (matchingAnswers[currentQ] || {})[p.left] === p.right)
      : aiResults[currentQ]?.correct ?? (normalizeAnswer(userAnswers[currentQ] || "") === normalizeAnswer(q.correctAnswer));

    return (
      <div className="flex flex-col h-full">
        <div className="p-3 sm:p-4 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center justify-between">
            <button onClick={resetQuiz} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <span className="font-display font-bold text-foreground text-xs sm:text-sm">
              Question {currentQ + 1} of {questions.length}
            </span>
            <span className="text-[10px] sm:text-xs text-muted-foreground capitalize px-2 py-0.5 sm:py-1 rounded-lg bg-secondary">
              {q.type.replace("_", " ")}
            </span>
          </div>
          <div className="mt-2 h-1 sm:h-1.5 bg-secondary rounded-full overflow-hidden">
            <motion.div className="h-full gradient-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
          <motion.div key={currentQ} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="prose prose-sm max-w-none mb-3 sm:mb-4">
              <h3 className="font-display font-bold text-sm sm:text-lg text-foreground">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{q.question}</ReactMarkdown>
              </h3>
            </div>

            {/* Multiple Choice */}
            {q.type === "multiple_choice" && (
              <div className="space-y-1.5 sm:space-y-2">
                {q.options.map((opt) => {
                  const selected = userAnswers[currentQ] === opt;
                  const correct = showAnswer && opt === q.correctAnswer;
                  const wrong = showAnswer && selected && !aiResults[currentQ]?.correct && opt !== q.correctAnswer;
                  return (
                    <motion.button key={opt} whileTap={{ scale: 0.98 }} disabled={showAnswer} onClick={() => handleAnswer(opt)}
                      className={`w-full text-left p-3 sm:p-4 rounded-xl border-2 transition-all font-body ${
                        correct ? "border-primary bg-primary/10" : wrong ? "border-destructive bg-destructive/10" : selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                      }`}>
                      <div className="flex items-center gap-2 sm:gap-3">
                        {correct && <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />}
                        {wrong && <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive flex-shrink-0" />}
                        <span className="text-xs sm:text-sm text-foreground">{opt}</span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}

            {/* True/False */}
            {q.type === "true_false" && (
              <div className="flex gap-2 sm:gap-3">
                {["True", "False"].map((opt) => {
                  const selected = userAnswers[currentQ] === opt;
                  const correct = showAnswer && opt === q.correctAnswer;
                  const wrong = showAnswer && selected && !aiResults[currentQ]?.correct && opt !== q.correctAnswer;
                  return (
                    <motion.button key={opt} whileTap={{ scale: 0.98 }} disabled={showAnswer} onClick={() => handleAnswer(opt)}
                      className={`flex-1 p-4 sm:p-6 rounded-xl border-2 font-display font-bold text-sm sm:text-lg transition-all flex items-center justify-center gap-2 ${
                        correct ? "border-primary bg-primary/10" : wrong ? "border-destructive bg-destructive/10" : selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                      }`}>
                      {opt === "True" ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />}
                      {opt}
                    </motion.button>
                  );
                })}
              </div>
            )}

            {/* Written */}
            {q.type === "written" && (
              <div className="space-y-2 sm:space-y-3">
                <textarea
                  value={userAnswers[currentQ] || ""}
                  onChange={(e) => setUserAnswers((p) => ({ ...p, [currentQ]: e.target.value }))}
                  disabled={showAnswer}
                  placeholder="Type your answer..."
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-border bg-background text-foreground font-body text-xs sm:text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[80px] sm:min-h-[100px] resize-none placeholder:text-muted-foreground"
                />
                {/* Only show submit when check-as-you-go is ON */}
                {setup.checkAnswers && !showAnswer && (
                  <motion.button whileTap={{ scale: 0.98 }} disabled={!userAnswers[currentQ]?.trim()}
                    onClick={async () => {
                      await checkAnswerWithAI(currentQ, userAnswers[currentQ]);
                      setShowAnswer(true);
                    }}
                    className="px-5 sm:px-6 py-2 rounded-xl gradient-primary text-primary-foreground font-display font-bold text-xs sm:text-sm shadow-soft disabled:opacity-40 flex items-center gap-2">
                    Submit Answer
                  </motion.button>
                )}
              </div>
            )}

            {/* Matching */}
            {q.type === "matching" && q.matchPairs && (
              <MatchingQuestion pairs={q.matchPairs} answers={matchingAnswers[currentQ] || {}} onMatch={handleMatchAnswer} showAnswer={showAnswer} />
            )}

            {/* Show answer feedback (only when check-as-you-go) */}
            {showAnswer && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`mt-3 sm:mt-4 p-3 sm:p-4 rounded-xl ${isCorrect ? "bg-primary/10 border border-primary/30" : "bg-destructive/10 border border-destructive/30"}`}>
                <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                  {isCorrect ? (
                    <><CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" /><span className="font-display font-bold text-primary text-xs sm:text-sm">Correct!</span></>
                  ) : (
                    <><XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" /><span className="font-display font-bold text-destructive text-xs sm:text-sm">Not quite!</span></>
                  )}
                </div>
                {!isCorrect && q.type !== "matching" && (
                  <p className="text-xs sm:text-sm text-foreground font-body"><strong>Correct answer:</strong> {q.correctAnswer}</p>
                )}
                <p className="text-xs sm:text-sm text-muted-foreground font-body mt-1">
                  {aiResults[currentQ]?.explanation || q.explanation}
                </p>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Next / Finish button */}
        <div className="p-3 sm:p-4 border-t border-border bg-card/80 flex-shrink-0">
          {(showAnswer || (!setup.checkAnswers && isAnswered)) && (
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileTap={{ scale: 0.98 }} onClick={nextQuestion}
              className="w-full py-2.5 sm:py-3 rounded-xl gradient-primary text-primary-foreground font-display font-bold shadow-soft text-sm sm:text-base flex items-center justify-center gap-2">
              {currentQ < questions.length - 1 ? (<>Next Question <ChevronRight className="w-4 h-4" /></>) : (<>See Results <Trophy className="w-4 h-4" /></>)}
            </motion.button>
          )}
          {!setup.checkAnswers && !isAnswered && q.type !== "written" && q.type !== "matching" && (
            <p className="text-center text-xs sm:text-sm text-muted-foreground">Select an answer to continue</p>
          )}
          {/* For written without check-as-you-go, show next button once they've typed something */}
          {!setup.checkAnswers && q.type === "written" && userAnswers[currentQ]?.trim() && !showAnswer && (
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileTap={{ scale: 0.98 }} onClick={nextQuestion}
              className="w-full py-2.5 sm:py-3 rounded-xl gradient-primary text-primary-foreground font-display font-bold shadow-soft text-sm sm:text-base flex items-center justify-center gap-2">
              {currentQ < questions.length - 1 ? (<>Next Question <ChevronRight className="w-4 h-4" /></>) : (<>See Results <Trophy className="w-4 h-4" /></>)}
            </motion.button>
          )}
        </div>
      </div>
    );
  }

  // ── Results Phase ───────────────────────────
  const score = getScore();
  const total = questions.length;
  const pct = Math.round((score / total) * 100);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 sm:p-4 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
        <h2 className="font-display font-bold text-foreground text-center flex items-center justify-center gap-2 text-sm sm:text-base">
          <Award className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          Quiz Results
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <img src={mascot} alt="Pylo" className="w-14 h-14 sm:w-20 sm:h-20 object-contain mx-auto mb-2 sm:mb-3 pylo-appear pylo-idle" />
          <div className="text-4xl sm:text-5xl font-display font-black text-primary">{pct}%</div>
          <p className="font-display font-bold text-sm sm:text-lg text-foreground mt-1">{score} / {total} correct</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1.5">
            {pct >= 80 ? (<><TrendingUp className="w-4 h-4 text-primary" /> Amazing work!</>) : pct >= 60 ? (<><BookOpenCheck className="w-4 h-4 text-primary" /> Good effort!</>) : (<><BookOpen className="w-4 h-4 text-muted-foreground" /> Keep practicing!</>)}
          </p>
        </motion.div>

        <div className="space-y-1.5 sm:space-y-2">
          <h3 className="font-display font-bold text-xs sm:text-sm text-foreground">Question Breakdown</h3>
          {questions.map((q, i) => {
            let correct: boolean;
            if (q.type === "matching") {
              const matches = matchingAnswers[i] || {};
              correct = (q.matchPairs || []).every((p) => matches[p.left] === p.right);
            } else if (aiResults[i]) {
              correct = aiResults[i].correct;
            } else {
              correct = normalizeAnswer(userAnswers[i] || "") === normalizeAnswer(q.correctAnswer);
            }
            return (
              <div key={i} className={`p-2.5 sm:p-3 rounded-xl border ${correct ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
                <div className="flex items-start gap-2">
                  {correct ? <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary mt-0.5 flex-shrink-0" /> : <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive mt-0.5 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-body text-foreground">{q.question}</p>
                    {!correct && q.type !== "matching" && (
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                        Your answer: <span className="text-destructive">{userAnswers[i] || "(no answer)"}</span>{" · "}Correct: <span className="text-primary">{q.correctAnswer}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {(loadingExplanation || explanation) && (
          <div className="space-y-1.5 sm:space-y-2">
            <h3 className="font-display font-bold text-xs sm:text-sm text-foreground flex items-center gap-2">
              <img src={mascot} alt="Pylo" className="w-4 h-4 sm:w-5 sm:h-5" /> Pylo's Explanations
            </h3>
            {loadingExplanation ? (
              <div className="flex items-center gap-2 p-3 sm:p-4 rounded-xl bg-card shadow-card">
                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-primary" />
                <span className="text-xs sm:text-sm text-muted-foreground">Pylo is reviewing your answers...</span>
              </div>
            ) : (
              <div className="p-3 sm:p-4 rounded-xl bg-card shadow-card prose prose-sm max-w-none text-foreground [&_p]:text-foreground [&_li]:text-foreground [&_strong]:text-foreground text-xs sm:text-sm">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{explanation}</ReactMarkdown>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 sm:gap-3 pb-4">
          <motion.button whileTap={{ scale: 0.98 }} onClick={resetQuiz}
            className="flex-1 py-2.5 sm:py-3 rounded-xl gradient-primary text-primary-foreground font-display font-bold shadow-soft flex items-center justify-center gap-2 text-sm sm:text-base">
            <RotateCcw className="w-4 h-4" /> New Quiz
          </motion.button>
        </div>
      </div>
    </div>
  );
};

// ── Matching Sub-component ──────────────────
function MatchingQuestion({ pairs, answers, onMatch, showAnswer }: { pairs: { left: string; right: string }[]; answers: Record<string, string>; onMatch: (left: string, right: string) => void; showAnswer: boolean }) {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const shuffledRight = useState(() => [...pairs.map((p) => p.right)].sort(() => Math.random() - 0.5))[0];

  const handleRightClick = (right: string) => {
    if (selectedLeft && !showAnswer) {
      onMatch(selectedLeft, right);
      setSelectedLeft(null);
    }
  };

  return (
    <div className="space-y-2 sm:space-y-3">
      <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
        <Shuffle className="w-3 h-3" /> Tap a term on the left, then its match on the right
      </p>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="space-y-1.5 sm:space-y-2">
          {pairs.map((p) => {
            const matched = answers[p.left];
            const correct = showAnswer && matched === p.right;
            const wrong = showAnswer && matched && matched !== p.right;
            return (
              <button key={p.left} disabled={showAnswer || !!matched} onClick={() => setSelectedLeft(p.left)}
                className={`w-full p-2.5 sm:p-3 rounded-xl border-2 text-left text-xs sm:text-sm font-body transition-all ${
                  selectedLeft === p.left ? "border-primary bg-primary/10" : correct ? "border-primary bg-primary/10" : wrong ? "border-destructive bg-destructive/10" : matched ? "border-muted bg-muted/50 opacity-60" : "border-border bg-card"
                }`}>
                {p.left}
              </button>
            );
          })}
        </div>
        <div className="space-y-1.5 sm:space-y-2">
          {shuffledRight.map((right) => {
            const usedBy = Object.entries(answers).find(([, v]) => v === right);
            return (
              <button key={right} disabled={showAnswer || !!usedBy} onClick={() => handleRightClick(right)}
                className={`w-full p-2.5 sm:p-3 rounded-xl border-2 text-left text-xs sm:text-sm font-body transition-all ${
                  usedBy ? "border-muted bg-muted/50 opacity-60" : "border-border bg-card hover:border-primary/40"
                }`}>
                {right}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default QuizPanel;
