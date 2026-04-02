import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronRight, MessageCircle, RotateCcw, BookOpen, ImagePlus, FileText, Send, Upload } from "lucide-react";
import QuizPanel from "./QuizPanel";
import ChatPanel, { Message } from "./ChatPanel";
import { streamChat } from "@/lib/ai-stream";
import { extractFileContent, extractImageContent } from "@/lib/content-extractor";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import mascot from "@/assets/mascot.png";
import mascotWave from "@/assets/mascot-wave.png";
import mascotThinking from "@/assets/mascot-thinking.png";
import { ChevronDown } from "lucide-react";

type SessionStep = "subject" | "topic" | "quiz" | "summary" | "continue" | "chat";

interface SessionFlowProps {
  sessionId: string;
  userName: string;
  userId: string;
  onBack: () => void;
}

const SUBJECTS = [
  "Math", "Science", "Computer Science", "English",
  "Business", "Social Sciences", "Arts", "Professional",
];

const MAX_FILES = 10;

const SessionFlow = ({ sessionId, userName, userId, onBack }: SessionFlowProps) => {
  const [step, setStep] = useState<SessionStep>("subject");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [topicInput, setTopicInput] = useState("");
  const [extractedContext, setExtractedContext] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [quizTopic, setQuizTopic] = useState("");
  const [quizContext, setQuizContext] = useState("");

  const [quizResult, setQuizResult] = useState<{ score: number; total: number; topic: string } | null>(null);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const currentStepIndex = ["subject", "topic", "quiz", "summary", "continue"].indexOf(step);
  const stepLabels = ["Subject", "Topic", "Quiz", "Summary", "Next"];

  const handleSubjectSelect = (subject: string) => {
    setSelectedSubject(subject);
    setStep("topic");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const total = attachedImages.length + attachedFiles.length + files.length;
    if (total > MAX_FILES) {
      toast.error("You can upload up to 10 files.");
      return;
    }
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) setAttachedImages((prev) => [...prev, ev.target!.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const total = attachedImages.length + attachedFiles.length + files.length;
    if (total > MAX_FILES) {
      toast.error("You can upload up to 10 files.");
      return;
    }
    setAttachedFiles((prev) => [...prev, ...Array.from(files)]);
    e.target.value = "";
  };

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  }, []);

  const handleTopicSubmit = async () => {
    const hasInput = topicInput.trim() || attachedFiles.length > 0 || attachedImages.length > 0;
    if (!hasInput) return;

    setExtracting(true);
    let context = "";

    try {
      // Extract content from files
      for (const file of attachedFiles) {
        try {
          const text = await extractFileContent(file);
          context += `\n\n--- Content from ${file.name} ---\n${text}`;
        } catch (e: any) {
          console.error("File extraction error:", e);
        }
      }
      // Extract content from images
      for (const img of attachedImages) {
        try {
          const text = await extractImageContent(img);
          context += `\n\n--- Content from image ---\n${text}`;
        } catch (e: any) {
          console.error("Image extraction error:", e);
        }
      }
    } catch {}

    const topic = topicInput.trim() || selectedSubject;
    setQuizTopic(topic);
    setQuizContext(context);
    setExtractedContext(context);
    setExtracting(false);

    // Update session title
    await supabase.from("study_sessions" as any).update({
      title: topic,
      quiz_topic: topic,
      updated_at: new Date().toISOString(),
    }).eq("id", sessionId);

    setStep("quiz");
  };

  const handleQuizComplete = async (score: number, total: number, topic: string) => {
    setQuizResult({ score, total, topic });
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
      const prompt = `The student just completed a quiz on "${quizResult.topic}" and scored ${quizResult.score}/${quizResult.total}. Generate a concise study summary of the key concepts. Use bullet points, max 6 points, keep each point to 1-2 sentences.`;
      let result = "";
      await streamChat({
        messages: [{ role: "user", content: prompt }],
        onDelta: (chunk) => { result += chunk; setSummary(result); },
        onDone: () => { setSummaryLoading(false); },
        onError: () => {
          setSummaryLoading(false);
          setSummary("");
        },
      });
    } catch {
      setSummaryLoading(false);
      setSummary("");
    }
  };

  const handleChatSend = async (content: string) => {
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

  const handleChatEdit = (messageIndex: number, newContent: string) => {
    // Find the user message, replace it, remove everything after
    setChatMessages(prev => {
      const updated = prev.slice(0, messageIndex);
      updated.push({ ...prev[messageIndex], content: newContent });
      return updated;
    });
    // Rebuild chat history
    chatRef.current = chatRef.current.slice(0, messageIndex);
    // Re-send
    handleChatSend(newContent);
  };

  // Header with step indicators and session identity
  const renderHeader = (title: string, backAction: () => void, showSteps = true) => (
    <div className="p-3 sm:p-4 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
      <div className="flex items-center gap-2">
        <button onClick={backAction} className="p-1.5 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <span className="font-display font-bold text-foreground text-sm sm:text-base">{title}</span>
        {quizTopic && step !== "subject" && step !== "topic" && (
          <span className="text-[10px] sm:text-xs text-muted-foreground ml-1 truncate max-w-[120px]">
            · {quizTopic}
          </span>
        )}
        {showSteps && (
          <div className="ml-auto flex items-center gap-1">
            {stepLabels.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all ${
                i <= currentStepIndex ? "bg-primary" : "bg-border"
              }`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Pylo message bubble
  const PyloMessage = ({ text }: { text: string }) => (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 items-start">
      <img src={mascot} alt="Pylo" className="w-7 h-7 sm:w-8 sm:h-8 object-contain flex-shrink-0 pylo-idle" />
      <div className="rounded-2xl rounded-bl-md bg-card shadow-card px-3 sm:px-4 py-2 sm:py-2.5">
        <p className="text-xs sm:text-sm text-foreground font-body">{text}</p>
      </div>
    </motion.div>
  );

  // ── Focus Mode Overlay (Subject + Topic) ──
  if (step === "subject" || step === "topic") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-foreground/60 backdrop-blur-sm" />

        {/* Centered content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.15 }}
          className="relative z-10 flex flex-col items-center w-full max-w-sm mx-4"
        >
          {/* Pylo mascot */}
          <img src={mascot} alt="Pylo" className="w-16 h-16 sm:w-20 sm:h-20 object-contain pylo-idle mb-3" />

          {/* Message card */}
          <div className="w-full rounded-2xl bg-card shadow-elevated border border-border p-4 sm:p-5">
            <AnimatePresence mode="wait">
              {step === "subject" ? (
                <motion.div key="subject" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.15 }}>
                  <p className="text-sm sm:text-base font-display font-bold text-foreground text-center mb-4">What are we studying?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SUBJECTS.map((subject) => (
                      <motion.button key={subject} whileTap={{ scale: 0.97 }} onClick={() => handleSubjectSelect(subject)}
                        className="p-2.5 sm:p-3 rounded-xl border-2 border-border bg-background hover:border-primary/50 hover:bg-secondary/50 transition-all text-center">
                        <p className="font-display font-bold text-xs sm:text-sm text-foreground">{subject}</p>
                      </motion.button>
                    ))}
                  </div>
                  <button onClick={onBack} className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                </motion.div>
              ) : (
                <motion.div key="topic" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }}>
                  <p className="text-sm sm:text-base font-display font-bold text-foreground text-center mb-1">What topic in {selectedSubject}?</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground text-center mb-3">Type, upload images, or share documents</p>

                  {/* Attached files/images preview */}
                  {(attachedFiles.length > 0 || attachedImages.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {attachedImages.map((img, i) => (
                        <div key={`img-${i}`} className="relative group">
                          <img src={img} alt="" className="w-12 h-12 object-cover rounded-lg border border-border" />
                          <button onClick={() => setAttachedImages(prev => prev.filter((_, idx) => idx !== i))}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                        </div>
                      ))}
                      {attachedFiles.map((file, i) => (
                        <div key={`file-${i}`} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-background border border-border">
                          <FileText className="w-3 h-3 text-coral" />
                          <span className="text-[10px] font-semibold truncate max-w-[70px]">{file.name}</span>
                          <button onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-destructive text-[10px] font-bold">×</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload buttons + input */}
                  <input ref={imageInputRef as any} type="file" accept="image/*" multiple hidden onChange={handleImageUpload} />
                  <input ref={fileInputRef as any} type="file" accept=".pdf,.txt,.md,.csv,.docx,.pptx" multiple hidden onChange={handleFileUpload} />

                  <div className="flex items-center gap-1 mb-2">
                    <button type="button" onClick={() => imageInputRef.current?.click()} className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary transition-all">
                      <ImagePlus className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg text-muted-foreground hover:text-coral hover:bg-secondary transition-all">
                      <Upload className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-end gap-1.5">
                    <textarea
                      ref={textareaRef}
                      value={topicInput}
                      onChange={(e) => { setTopicInput(e.target.value); autoResize(); }}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleTopicSubmit(); } }}
                      placeholder="e.g., Quadratic equations..."
                      rows={1}
                      className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-border bg-background text-foreground font-body text-xs sm:text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground resize-none overflow-y-auto"
                      style={{ maxHeight: 100 }}
                      autoFocus
                    />
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      disabled={extracting || (!topicInput.trim() && attachedFiles.length === 0 && attachedImages.length === 0)}
                      onClick={handleTopicSubmit}
                      className="p-2.5 rounded-xl gradient-primary text-primary-foreground shadow-soft disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
                    >
                      {extracting ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                    </motion.button>
                  </div>

                  <button onClick={() => setStep("subject")} className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors">← Back</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Quiz ──
  if (step === "quiz") {
    return (
      <div className="flex flex-col h-full">
        {renderHeader("Study Session", onBack)}
        <div className="flex-1 overflow-hidden">
          <QuizPanel
            userName={userName}
            userId={userId}
            chatContext={quizContext}
            onQuizComplete={handleQuizComplete}
            initialTopic={quizTopic}
            initialSubject={selectedSubject}
            sessionMode
          />
        </div>
        {quizResult && (
          <div className="p-3 sm:p-4 border-t border-border bg-card/80 flex-shrink-0">
            <PyloMessage text="Let's see how you did." />
            <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }} onClick={goToSummary}
              className="w-full mt-3 py-3 rounded-xl gradient-primary text-primary-foreground font-display font-bold shadow-soft text-sm sm:text-base flex items-center justify-center gap-2">
              Continue <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        )}
      </div>
    );
  }

  // ── Summary ──
  if (step === "summary") {
    const hasSummary = summary.trim().length > 0;
    return (
      <div className="flex flex-col h-full">
        {renderHeader("Study Summary", () => setStep("quiz"))}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          <PyloMessage text="Here are the key ideas." />

          {quizResult && (
            <div className="p-3 sm:p-4 rounded-2xl bg-card shadow-card border border-border text-center">
              <p className="text-2xl sm:text-3xl font-display font-black text-primary">{Math.round((quizResult.score / quizResult.total) * 100)}%</p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">{quizResult.score}/{quizResult.total} correct on {quizResult.topic}</p>
            </div>
          )}

          {summaryLoading && !hasSummary ? (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-card shadow-card">
              <img src={mascotThinking} alt="thinking" className="w-6 h-6 pylo-thinking" />
              <span className="text-xs sm:text-sm text-muted-foreground">Generating summary...</span>
            </div>
          ) : hasSummary ? (
            <div className="p-3 sm:p-4 rounded-xl bg-card shadow-card prose prose-sm max-w-none text-foreground [&_p]:text-foreground [&_li]:text-foreground [&_strong]:text-foreground text-xs sm:text-sm">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{summary}</ReactMarkdown>
            </div>
          ) : (
            <PyloMessage text="I couldn't generate a summary right now. Focus on the mistakes above—that's where you'll improve most." />
          )}
        </div>

        <div className="p-3 sm:p-4 border-t border-border bg-card/80 flex-shrink-0">
          <PyloMessage text="What do you want to do next?" />
          <motion.button whileTap={{ scale: 0.98 }} onClick={() => setStep("continue")}
            className="w-full mt-3 py-3 rounded-xl gradient-primary text-primary-foreground font-display font-bold shadow-soft text-sm sm:text-base flex items-center justify-center gap-2">
            Continue <ChevronRight className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    );
  }

  // ── Chat inside session ──
  if (step === "chat") {
    return (
      <div className="flex flex-col h-full">
        {renderHeader("Ask Pylo", () => setStep("continue"), false)}
        <div className="flex-1 overflow-hidden">
          <ChatPanel
            userName={userName}
            messages={chatMessages.length === 0
              ? [{ id: "system-hint", role: "assistant" as const, content: "Ask me anything about this topic." }]
              : chatMessages}
            onSendMessage={handleChatSend}
            onEditMessage={handleChatEdit}
            isLoading={chatLoading}
            hideQuickActions
            topMessage={quizTopic ? `Studying: ${quizTopic}` : undefined}
          />
        </div>
      </div>
    );
  }

  // ── Continue ──
  return (
    <div className="flex flex-col h-full">
      {renderHeader("Continue Learning", () => setStep("summary"))}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center text-center gap-3 mb-6">
          <img src={mascot} alt="Pylo" className="w-14 h-14 sm:w-16 sm:h-16 pylo-appear pylo-idle" />
          <h3 className="font-display font-bold text-base sm:text-lg text-foreground">Great work! What's next?</h3>
        </motion.div>

        <div className="space-y-3 max-w-sm mx-auto">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => { setStep("subject"); setQuizResult(null); setSummary(""); setQuizTopic(""); setQuizContext(""); setSelectedSubject(""); setTopicInput(""); setAttachedFiles([]); setAttachedImages([]); }}
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
