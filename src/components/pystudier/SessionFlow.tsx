import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronRight, MessageCircle, Brain, RotateCcw, BookOpen } from "lucide-react";
import QuizPanel from "./QuizPanel";
import ChatPanel, { Message } from "./ChatPanel";
import { streamChat } from "@/lib/ai-stream";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import mascot from "@/assets/mascot.png";
import mascotThinking from "@/assets/mascot-thinking.png";

type SessionStep = "quiz" | "summary" | "continue" | "chat";

interface SessionFlowProps {
  sessionId: string;
  userName: string;
  userId: string;
  onBack: () => void;
}

const SessionFlow = ({ sessionId, userName, userId, onBack }: SessionFlowProps) => {
  const [step, setStep] = useState<SessionStep>("quiz");
  const [quizResult, setQuizResult] = useState<{ score: number; total: number; topic: string } | null>(null);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Chat state for "Ask Pylo" inside session
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const handleQuizComplete = async (score: number, total: number, topic: string) => {
    setQuizResult({ score, total, topic });
    // Update session in DB
    await supabase.from("study_sessions" as any).update({
      quiz_score: score,
      quiz_total: total,
      quiz_topic: topic,
      current_step: "summary",
      title: topic || "Study Session",
      updated_at: new Date().toISOString(),
    }).eq("id", sessionId);
  };

  const goToSummary = async () => {
    setStep("summary");
    if (!quizResult) return;
    setSummaryLoading(true);
    try {
      const prompt = `The student just completed a quiz on "${quizResult.topic}" and scored ${quizResult.score}/${quizResult.total}. Generate a concise study summary of the key concepts for this topic. Focus on the most important points they should remember. Use bullet points and keep it clear.`;
      
      let result = "";
      await streamChat({
        messages: [{ role: "user", content: prompt }],
        onDelta: (chunk) => { result += chunk; setSummary(result); },
        onDone: () => { setSummaryLoading(false); },
        onError: (err) => { toast.error(err); setSummaryLoading(false); setSummary("Could not generate summary."); },
      });
    } catch {
      setSummaryLoading(false);
      setSummary("Could not generate summary at this time.");
    }
  };

  const handleChatSend = async (content: string, images?: string[], file?: File | null) => {
    const userMsg: Message = { id: generateId(), role: "user", content };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);
    chatRef.current.push({ role: "user", content });

    let assistantSoFar = "";
    const assistantId = generateId();
    try {
      await streamChat({
        messages: chatRef.current,
        onDelta: (chunk) => {
          assistantSoFar += chunk;
          setChatMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.id === assistantId) return prev.map(m => m.id === assistantId ? { ...m, content: assistantSoFar } : m);
            return [...prev, { id: assistantId, role: "assistant" as const, content: assistantSoFar }];
          });
        },
        onDone: () => { chatRef.current.push({ role: "assistant", content: assistantSoFar }); setChatLoading(false); },
        onError: (err) => { toast.error(err); setChatLoading(false); },
      });
    } catch { toast.error("Failed to connect."); setChatLoading(false); }
  };

  // Quiz step
  if (step === "quiz") {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 sm:p-4 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0 flex items-center gap-2">
          <button onClick={onBack} className="p-1.5 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <span className="font-display font-bold text-foreground text-sm sm:text-base">Study Session</span>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="flex gap-1">
              {["quiz", "summary", "continue"].map((s, i) => (
                <div key={s} className={`w-2 h-2 rounded-full transition-all ${step === s || (s === "quiz" && step === "quiz") ? "bg-primary scale-110" : "bg-border"}`} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <QuizPanel userName={userName} userId={userId} onQuizComplete={handleQuizComplete} />
        </div>
        {quizResult && (
          <div className="p-3 sm:p-4 border-t border-border bg-card/80 flex-shrink-0">
            <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }} onClick={goToSummary}
              className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-display font-bold shadow-soft text-sm sm:text-base flex items-center justify-center gap-2">
              View Summary <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        )}
      </div>
    );
  }

  // Summary step
  if (step === "summary") {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 sm:p-4 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0 flex items-center gap-2">
          <button onClick={() => setStep("quiz")} className="p-1.5 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <span className="font-display font-bold text-foreground text-sm sm:text-base">Study Summary</span>
          <div className="ml-auto flex gap-1">
            {["quiz", "summary", "continue"].map((s) => (
              <div key={s} className={`w-2 h-2 rounded-full ${s === "summary" ? "bg-primary scale-110" : s === "quiz" ? "bg-primary/50" : "bg-border"}`} />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {quizResult && (
            <div className="p-4 rounded-2xl bg-card shadow-card border border-border text-center">
              <p className="text-2xl sm:text-3xl font-display font-black text-primary">{Math.round((quizResult.score / quizResult.total) * 100)}%</p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">{quizResult.score}/{quizResult.total} correct on {quizResult.topic}</p>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="font-display font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
              <img src={mascot} alt="Pylo" className="w-5 h-5 pylo-idle" /> Key Concepts
            </h3>
            {summaryLoading && !summary ? (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-card shadow-card">
                <img src={mascotThinking} alt="thinking" className="w-6 h-6 pylo-thinking" />
                <span className="text-xs sm:text-sm text-muted-foreground">Generating summary...</span>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-card shadow-card prose prose-sm max-w-none text-foreground [&_p]:text-foreground [&_li]:text-foreground [&_strong]:text-foreground text-xs sm:text-sm">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{summary}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        <div className="p-3 sm:p-4 border-t border-border bg-card/80 flex-shrink-0">
          <motion.button whileTap={{ scale: 0.98 }} onClick={() => setStep("continue")}
            className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-display font-bold shadow-soft text-sm sm:text-base flex items-center justify-center gap-2">
            Continue <ChevronRight className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    );
  }

  // Chat inside session
  if (step === "chat") {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 sm:p-4 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0 flex items-center gap-2">
          <button onClick={() => setStep("continue")} className="p-1.5 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <span className="font-display font-bold text-foreground text-sm sm:text-base">Ask Pylo</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatPanel userName={userName} messages={chatMessages} onSendMessage={handleChatSend} isLoading={chatLoading} />
        </div>
      </div>
    );
  }

  // Continue step
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 sm:p-4 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0 flex items-center gap-2">
        <button onClick={() => setStep("summary")} className="p-1.5 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <span className="font-display font-bold text-foreground text-sm sm:text-base">Continue Learning</span>
        <div className="ml-auto flex gap-1">
          {["quiz", "summary", "continue"].map((s) => (
            <div key={s} className={`w-2 h-2 rounded-full ${s === "continue" ? "bg-primary scale-110" : "bg-primary/50"}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center text-center gap-3 mb-6">
          <img src={mascot} alt="Pylo" className="w-16 h-16 pylo-appear pylo-idle" />
          <h3 className="font-display font-bold text-base sm:text-lg text-foreground">Great work! What's next?</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">Choose how to keep learning</p>
        </motion.div>

        <div className="space-y-3 max-w-sm mx-auto">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { setStep("quiz"); setQuizResult(null); setSummary(""); }}
            className="w-full p-4 rounded-2xl bg-card shadow-card border border-border hover:border-primary/40 transition-all flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
              <RotateCcw className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-display font-bold text-sm text-foreground">New Quiz</p>
              <p className="text-xs text-muted-foreground">Test yourself on another topic</p>
            </div>
          </motion.button>

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setStep("chat")}
            className="w-full p-4 rounded-2xl bg-card shadow-card border border-border hover:border-primary/40 transition-all flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-coral/20 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-5 h-5 text-coral" />
            </div>
            <div>
              <p className="font-display font-bold text-sm text-foreground">Ask Pylo</p>
              <p className="text-xs text-muted-foreground">Get deeper explanations</p>
            </div>
          </motion.button>

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onBack}
            className="w-full p-4 rounded-2xl bg-card shadow-card border border-border hover:border-primary/40 transition-all flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-display font-bold text-sm text-foreground">Done</p>
              <p className="text-xs text-muted-foreground">Back to sessions list</p>
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default SessionFlow;
