import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronRight, MessageCircle, RotateCcw, BookOpen, ImagePlus, FileText, Send, Upload, Target, GraduationCap, Lightbulb, RefreshCw } from "lucide-react";
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
import type { ClassroomItem } from "@/hooks/use-google-classroom";

type SessionStep = "subject" | "topic" | "level" | "pystudying" | "quiz" | "summary" | "continue" | "chat" | "review" | "review-results";
type LearningLevel = "beginner" | "intermediate" | "review";

interface SessionFlowProps {
  sessionId?: string;
  userName: string;
  userId: string;
  onBack: () => void;
  onSessionCreated?: (id: string) => void;
  classroomItem?: ClassroomItem | null;
}

const SUBJECTS = [
  "Math", "Science", "Computer Science", "English",
  "Business", "Social Sciences", "Arts", "Professional",
];

const LEVEL_OPTIONS = [
  { id: "beginner" as LearningLevel, label: "I don't understand it yet", emoji: "🌱", desc: "Full step-by-step teaching" },
  { id: "intermediate" as LearningLevel, label: "I kinda understand it", emoji: "📚", desc: "Shorter explanations, faster pace" },
  { id: "review" as LearningLevel, label: "I just want to review", emoji: "🔄", desc: "Quick check, then test" },
];

const SessionFlow = ({ sessionId, userName, userId, onBack, onSessionCreated, classroomItem }: SessionFlowProps) => {
  const [currentSessionId, setCurrentSessionId] = useState(sessionId || "");
  const [subjectDropdownOpen, setSubjectDropdownOpen] = useState(false);
  const [step, setStep] = useState<SessionStep>("subject");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [topicInput, setTopicInput] = useState("");
  const [extractedContext, setExtractedContext] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [quizTopic, setQuizTopic] = useState("");
  const [quizContext, setQuizContext] = useState("");
  const [learningLevel, setLearningLevel] = useState<LearningLevel>("beginner");

  const [quizResult, setQuizResult] = useState<{ score: number; total: number; topic: string } | null>(null);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [incorrectQuestions, setIncorrectQuestions] = useState<{ question: string; userAnswer: string; correctAnswer: string }[]>([]);
  const [reviewScore, setReviewScore] = useState<{ score: number; total: number } | null>(null);
  const [reviewAttempt, setReviewAttempt] = useState(0);
  const [weakAreas, setWeakAreas] = useState<string[]>([]);

  // Pystudying chat state
  const [pystudyMessages, setPystudyMessages] = useState<Message[]>([]);
  const [pystudyLoading, setPystudyLoading] = useState(false);
  const pystudyRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const [pystudyExchangeCount, setPystudyExchangeCount] = useState(0);

  // Regular chat state (for "Ask Pylo" after quiz)
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Handle classroom item
  useEffect(() => {
    if (!classroomItem || sessionId) return;
    const startClassroomSession = async () => {
      const subject = classroomItem.courseName;
      const topic = classroomItem.title;
      const context = [classroomItem.description, classroomItem.attachmentContent].filter(Boolean).join("\n\n");
      setSelectedSubject(subject);
      setQuizTopic(topic);
      setQuizContext(context);
      setExtractedContext(context);

      const { data, error } = await supabase.from("study_sessions" as any).insert({
        user_id: userId, title: subject, quiz_topic: topic,
      } as any).select().single();
      if (data && !error) {
        const newId = (data as any).id;
        setCurrentSessionId(newId);
        onSessionCreated?.(newId);
      }
      setStep("level");
    };
    startClassroomSession();
  }, [classroomItem]);

  const handleSubjectSelect = (subject: string) => {
    setSelectedSubject(subject);
    setStep("topic");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
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
    const hasText = topicInput.trim().length > 0;
    const hasFiles = attachedFiles.length > 0 || attachedImages.length > 0;
    if (!hasText && !hasFiles) return;

    setExtracting(true);
    let context = "";
    try {
      for (const file of attachedFiles) {
        try {
          const text = await extractFileContent(file);
          context += `\n\n--- Content from ${file.name} ---\n${text}`;
        } catch (e: any) {
          console.error("File extraction error:", e);
          toast.error(`Could not read ${file.name}`);
        }
      }
      for (const img of attachedImages) {
        try {
          const text = await extractImageContent(img);
          context += `\n\n--- Content from image ---\n${text}`;
        } catch (e: any) {
          console.error("Image extraction error:", e);
          toast.error("Could not read image");
        }
      }
    } catch {}

    let topic: string;
    if (hasText && hasFiles) {
      topic = selectedSubject;
      context = `User instruction: ${topicInput.trim()}\n${context}`;
    } else if (hasFiles && !hasText) {
      topic = selectedSubject;
    } else {
      topic = topicInput.trim();
    }

    setQuizTopic(topic);
    setQuizContext(context);
    setExtractedContext(context);
    setExtracting(false);
    setStep("level");
  };

  const handleLevelSelect = async (level: LearningLevel) => {
    setLearningLevel(level);

    // Create session now
    const sessionTitle = selectedSubject;
    const { data, error } = await supabase.from("study_sessions" as any).insert({
      user_id: userId, title: sessionTitle, quiz_topic: quizTopic,
    } as any).select().single();
    if (data && !error) {
      const newId = (data as any).id;
      setCurrentSessionId(newId);
      onSessionCreated?.(newId);
    }

    if (level === "review") {
      // Skip teaching, go straight to practice test
      setStep("quiz");
    } else {
      // Start Pystudying chat
      startPystudying(level);
    }
  };

  // Build pystudying system prompt based on level
  const buildPystudyingPrompt = (level: LearningLevel, retryWeakAreas?: string[]) => {
    const levelInstructions = level === "beginner"
      ? `TEACHING STYLE: Full step-by-step teaching. Use very simple words. Give lots of examples. Go slow. Explain everything like the student is seeing this for the first time. Each step should cover ONE small concept.`
      : `TEACHING STYLE: Shorter explanations, faster pacing. The student has some understanding. Skip basics, focus on key concepts and common mistakes. Be efficient but clear.`;

    const weakAreaNote = retryWeakAreas && retryWeakAreas.length > 0
      ? `\n\nIMPORTANT: The student struggled with these areas previously. Focus your teaching on these weak spots:\n${retryWeakAreas.map((w, i) => `${i + 1}. ${w}`).join("\n")}`
      : "";

    return `You are Pylo, a friendly AI study tutor in Pystudying mode.

SUBJECT: ${selectedSubject}
TOPIC: ${quizTopic}
${extractedContext ? `\nSTUDY MATERIAL:\n${extractedContext}` : ""}
${weakAreaNote}

${levelInstructions}

RULES:
1. Teach ONE concept per message
2. Include a clear example for each concept
3. End each message with ONE simple question to check understanding
4. Use simple, friendly language
5. Use markdown formatting (bold, lists, headers)
6. Start easy and increase complexity gradually
7. Be encouraging and warm
8. Keep each message focused and not too long (max 3-4 paragraphs)
9. If the student answers your question wrong, gently correct them and re-explain before moving on
10. After covering the main concepts (usually 3-5 steps), let the student know they've covered the key ideas

DO NOT:
- Use complex academic language
- Overwhelm with too much info at once
- Skip checking understanding
- Be judgmental about wrong answers

Start by introducing the first concept now.`;
  };

  const startPystudying = (level: LearningLevel, retryWeakAreas?: string[]) => {
    setPystudyMessages([]);
    pystudyRef.current = [];
    setPystudyExchangeCount(0);
    setStep("pystudying");

    // Send initial greeting + first teaching step
    const systemPrompt = buildPystudyingPrompt(level, retryWeakAreas);
    const initialMsg = retryWeakAreas
      ? `Let's review the areas I struggled with in ${quizTopic}.`
      : `I'm ready to learn about ${quizTopic}. Let's start!`;

    setPystudyLoading(true);
    let assistantSoFar = "";
    const assistantId = generateId();

    pystudyRef.current.push({ role: "user", content: initialMsg });

    streamChat({
      messages: pystudyRef.current,
      systemPrompt,
      onDelta: (chunk) => {
        assistantSoFar += chunk;
        setPystudyMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.id === assistantId) return prev.map(m => m.id === assistantId ? { ...m, content: assistantSoFar } : m);
          return [...prev, { id: assistantId, role: "assistant" as const, content: assistantSoFar }];
        });
      },
      onDone: () => {
        pystudyRef.current.push({ role: "assistant", content: assistantSoFar });
        setPystudyLoading(false);
        setPystudyExchangeCount(1);
      },
      onError: (err) => { toast.error(err); setPystudyLoading(false); },
    });
  };

  const handlePystudySend = async (content: string) => {
    const userMsg: Message = { id: generateId(), role: "user", content };
    setPystudyMessages(prev => [...prev, userMsg]);
    setPystudyLoading(true);
    pystudyRef.current.push({ role: "user", content });

    let assistantSoFar = "";
    const assistantId = generateId();
    const systemPrompt = buildPystudyingPrompt(learningLevel);

    try {
      await streamChat({
        messages: pystudyRef.current,
        systemPrompt,
        onDelta: (chunk) => {
          assistantSoFar += chunk;
          setPystudyMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.id === assistantId) return prev.map(m => m.id === assistantId ? { ...m, content: assistantSoFar } : m);
            return [...prev, { id: assistantId, role: "assistant" as const, content: assistantSoFar }];
          });
        },
        onDone: () => {
          pystudyRef.current.push({ role: "assistant", content: assistantSoFar });
          setPystudyLoading(false);
          setPystudyExchangeCount(prev => prev + 1);
        },
        onError: (err) => { toast.error(err); setPystudyLoading(false); },
      });
    } catch { toast.error("Failed to connect."); setPystudyLoading(false); }
  };

  const handlePystudyEdit = (messageIndex: number, newContent: string) => {
    setPystudyMessages(prev => {
      const updated = prev.slice(0, messageIndex);
      updated.push({ ...prev[messageIndex], content: newContent });
      return updated;
    });
    pystudyRef.current = pystudyRef.current.slice(0, messageIndex);
    handlePystudySend(newContent);
  };

  // Determine dynamic quiz question count based on teaching exchanges
  const getDynamicQuestionCount = () => {
    const conceptsCovered = Math.max(3, Math.min(pystudyExchangeCount, 8));
    return Math.min(conceptsCovered * 2, 20);
  };

  const handleQuizComplete = async (score: number, total: number, topic: string) => {
    setQuizResult({ score, total, topic });
    if (currentSessionId) {
      await supabase.from("study_sessions" as any).update({
        quiz_score: score, quiz_total: total, quiz_topic: topic,
        current_step: "summary", updated_at: new Date().toISOString(),
      }).eq("id", currentSessionId);
    }
  };

  const handleIncorrectQuestions = (incorrect: { question: string; userAnswer: string; correctAnswer: string }[]) => {
    setIncorrectQuestions(incorrect);
    setWeakAreas(incorrect.map(q => q.question));
  };

  const handleReviewComplete = async (score: number, total: number) => {
    setReviewScore({ score, total });
    setStep("review-results");
  };

  const startReview = () => {
    setReviewScore(null);
    setReviewAttempt(prev => prev + 1);
    setStep("review");
  };

  const goToSummary = async () => {
    setStep("summary");
    if (!quizResult) return;
    setSummaryLoading(true);
    try {
      const mistakeContext = incorrectQuestions.length > 0
        ? `\nThe student got these wrong:\n${incorrectQuestions.map((q, i) => `${i + 1}. "${q.question}" — answered "${q.userAnswer}", correct was "${q.correctAnswer}"`).join("\n")}`
        : "";
      const prompt = `The student completed a practice test on "${quizResult.topic}" and scored ${quizResult.score}/${quizResult.total}.${mistakeContext}\nGenerate a concise study summary. Use bullet points, max 6 points, keep each to 1-2 sentences. Focus on concepts related to mistakes.`;
      let result = "";
      await streamChat({
        messages: [{ role: "user", content: prompt }],
        onDelta: (chunk) => { result += chunk; setSummary(result); },
        onDone: () => { setSummaryLoading(false); },
        onError: () => {
          setSummaryLoading(false);
          if (!result.trim()) setSummary("Something went wrong — focus on the mistakes above to improve.");
        },
      });
      if (!result.trim()) setSummary("Something went wrong — focus on the mistakes above to improve.");
    } catch {
      setSummaryLoading(false);
      setSummary("Something went wrong — focus on the mistakes above to improve.");
    }
  };

  // Handle going back to pystudying after bad test performance
  const retryWithPystudying = () => {
    const areas = incorrectQuestions.map(q => `${q.question} (correct: ${q.correctAnswer})`);
    setWeakAreas(areas);
    setQuizResult(null);
    setSummary("");
    setIncorrectQuestions([]);
    startPystudying(learningLevel, areas);
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
    setChatMessages(prev => {
      const updated = prev.slice(0, messageIndex);
      updated.push({ ...prev[messageIndex], content: newContent });
      return updated;
    });
    chatRef.current = chatRef.current.slice(0, messageIndex);
    handleChatSend(newContent);
  };

  // Header
  const renderHeader = (title: string, backAction: () => void) => (
    <div className="p-3 sm:p-4 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
      <div className="flex items-center gap-2">
        <button onClick={backAction} className="p-1.5 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <span className="font-display font-bold text-foreground text-sm sm:text-base">{title}</span>
        {quizTopic && step !== "subject" && step !== "topic" && step !== "level" && (
          <span className="text-[10px] sm:text-xs text-muted-foreground ml-1 truncate max-w-[120px]">· {quizTopic}</span>
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

  // ── Focus Mode Overlay (Subject + Topic + Level) ──
  if (step === "subject" || step === "topic" || step === "level") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
        <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.15 }}
          className="relative z-10 flex flex-col items-center w-full max-w-sm mx-4 my-auto py-6"
        >
          <motion.img
            src={mascotWave}
            alt="Pylo"
            className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-lg mb-3"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative w-full rounded-2xl bg-card shadow-elevated p-4 sm:p-5 max-h-[70vh] overflow-y-auto">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-card rotate-45 rounded-sm shadow-card" />

            <div className="relative z-10">
              <AnimatePresence mode="wait">
                {step === "subject" ? (
                  <motion.div key="subject" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.15 }}>
                    <p className="text-sm sm:text-base font-display font-bold text-foreground text-center mb-4">What are we studying?</p>
                    <div className="relative">
                      <button type="button" onClick={() => setSubjectDropdownOpen(!subjectDropdownOpen)}
                        className="w-full px-4 py-3 rounded-xl border-2 border-primary/20 bg-secondary/50 text-foreground font-body text-sm text-left flex items-center justify-between focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all">
                        <span className={selectedSubject ? "text-foreground" : "text-muted-foreground"}>
                          {selectedSubject || "Select a subject..."}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${subjectDropdownOpen ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {subjectDropdownOpen && (
                          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
                            className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-elevated z-20 max-h-48 overflow-y-auto">
                            {SUBJECTS.map((subject) => (
                              <button key={subject} type="button"
                                onClick={() => { setSubjectDropdownOpen(false); handleSubjectSelect(subject); }}
                                className="w-full px-4 py-2.5 text-sm font-body text-foreground text-left hover:bg-secondary/60 transition-colors first:rounded-t-xl last:rounded-b-xl">
                                {subject}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <button onClick={onBack} className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                  </motion.div>
                ) : step === "topic" ? (
                  <motion.div key="topic" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }}>
                    <p className="text-sm sm:text-base font-display font-bold text-foreground text-center mb-1">What topic in {selectedSubject}?</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground text-center mb-3">Type, upload images, or share documents</p>

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
                      <textarea ref={textareaRef} value={topicInput}
                        onChange={(e) => { setTopicInput(e.target.value); autoResize(); }}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleTopicSubmit(); } }}
                        placeholder="e.g., Quadratic equations..."
                        rows={1}
                        className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-border bg-background text-foreground font-body text-xs sm:text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground resize-none overflow-y-auto"
                        style={{ maxHeight: 100 }}
                        autoFocus
                      />
                      <motion.button type="button" whileTap={{ scale: 0.95 }}
                        disabled={extracting || (!topicInput.trim() && attachedFiles.length === 0 && attachedImages.length === 0)}
                        onClick={handleTopicSubmit}
                        className="p-2.5 rounded-xl gradient-primary text-primary-foreground shadow-soft disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0">
                        {extracting ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                      </motion.button>
                    </div>
                    <button onClick={() => setStep("subject")} className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors">← Back</button>
                  </motion.div>
                ) : (
                  <motion.div key="level" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }}>
                    <p className="text-sm sm:text-base font-display font-bold text-foreground text-center mb-1">How familiar are you with this topic?</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground text-center mb-4">{quizTopic}</p>

                    <div className="space-y-2">
                      {LEVEL_OPTIONS.map((opt) => (
                        <motion.button key={opt.id} whileTap={{ scale: 0.98 }}
                          onClick={() => handleLevelSelect(opt.id)}
                          className="w-full p-3 rounded-xl border-2 border-border bg-background hover:border-primary/40 transition-all text-left flex items-center gap-3">
                          <span className="text-xl">{opt.emoji}</span>
                          <div>
                            <p className="font-display font-bold text-sm text-foreground">{opt.label}</p>
                            <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                    <button onClick={() => setStep("topic")} className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors">← Back</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Pystudying (Teaching Chat) ──
  if (step === "pystudying") {
    const showTestButton = pystudyExchangeCount >= 3 && !pystudyLoading;
    return (
      <div className="flex flex-col h-full min-h-0">
        {renderHeader("Pystudying", onBack)}
        <div className="flex-1 overflow-hidden min-h-0">
          <ChatPanel
            userName={userName}
            messages={pystudyMessages}
            onSendMessage={handlePystudySend}
            onEditMessage={handlePystudyEdit}
            isLoading={pystudyLoading}
            hideQuickActions
            topMessage={`Learning: ${quizTopic}`}
          />
        </div>
        {showTestButton && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="p-3 sm:p-4 border-t border-border bg-card/80 flex-shrink-0">
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => setStep("quiz")}
              className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-display font-bold shadow-soft text-sm sm:text-base flex items-center justify-center gap-2">
              I'm ready for the test <GraduationCap className="w-4 h-4" />
            </motion.button>
          </motion.div>
        )}
      </div>
    );
  }

  // ── Practice Test (Quiz) ──
  if (step === "quiz") {
    const dynamicCount = learningLevel === "review" ? 10 : getDynamicQuestionCount();
    return (
      <div className="flex flex-col h-full min-h-0">
        {renderHeader("Practice Test", () => learningLevel === "review" ? onBack() : setStep("pystudying"))}
        <div className="flex-1 overflow-hidden min-h-0">
          <QuizPanel
            userName={userName}
            userId={userId}
            chatContext={quizContext || (pystudyRef.current.length > 0
              ? `Teaching context from Pystudying session:\n${pystudyRef.current.map(m => `${m.role}: ${m.content}`).join("\n\n")}`
              : undefined)}
            onQuizComplete={handleQuizComplete}
            onIncorrectQuestions={handleIncorrectQuestions}
            initialTopic={quizTopic}
            initialSubject={selectedSubject}
            sessionMode
            dynamicQuestionCount={dynamicCount}
          />
        </div>
        {quizResult && (
          <div className="p-3 sm:p-4 border-t border-border bg-card/80 flex-shrink-0">
            <PyloMessage text={quizResult.score >= Math.ceil(quizResult.total * 0.7) ? "You're ready for a real test. 🎉" : "Let's review what you missed."} />
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
    const didWell = quizResult && quizResult.score >= Math.ceil(quizResult.total * 0.7);
    return (
      <div className="flex flex-col h-full min-h-0">
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
            <PyloMessage text="I couldn't generate a summary right now. Focus on the mistakes above." />
          )}
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

  // ── Chat inside session ──
  if (step === "chat") {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-1 overflow-hidden min-h-0">
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

  // ── Review Quiz ──
  if (step === "review") {
    const reviewContext = incorrectQuestions.map((q, i) =>
      `${i + 1}. Question: "${q.question}" — Correct answer: "${q.correctAnswer}"`
    ).join("\n");

    return (
      <div className="flex flex-col h-full min-h-0">
        {renderHeader("Review", () => setStep("continue"))}
        <div className="flex-1 overflow-hidden min-h-0">
          <QuizPanel
            key={`review-${reviewAttempt}`}
            userName={userName}
            userId={userId}
            chatContext={`REVIEW MODE: Generate questions that test understanding of these weak areas:\n${reviewContext}`}
            onQuizComplete={(score, total) => handleReviewComplete(score, total)}
            initialTopic={quizTopic}
            initialSubject={selectedSubject}
            sessionMode
            reviewMode
            reviewQuestionCount={Math.min(5, Math.max(3, incorrectQuestions.length))}
          />
        </div>
      </div>
    );
  }

  // ── Review Results ──
  if (step === "review-results") {
    const passed = reviewScore && reviewScore.score >= Math.ceil(reviewScore.total * 0.7);
    return (
      <div className="flex flex-col h-full min-h-0">
        {renderHeader("Review Results", () => setStep("continue"))}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center text-center gap-3 mb-6">
            <img src={passed ? mascotWave : mascot} alt="Pylo" className="w-16 h-16 sm:w-20 sm:h-20 pylo-appear pylo-idle" />
            {reviewScore && (
              <div className="text-center">
                <p className="text-3xl sm:text-4xl font-display font-black text-primary">{Math.round((reviewScore.score / reviewScore.total) * 100)}%</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">{reviewScore.score}/{reviewScore.total} correct</p>
              </div>
            )}
            <div className="mt-2 p-3 rounded-2xl bg-card shadow-card border border-border max-w-xs">
              <p className="text-sm font-body text-foreground">
                {passed ? "Nice work — you're done with this topic. 🎉" : "Let's try that again to lock it in."}
              </p>
            </div>
          </motion.div>

          <div className="space-y-3 max-w-sm mx-auto">
            {!passed && (
              <>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={retryWithPystudying}
                  className="w-full p-4 rounded-2xl bg-card shadow-card border-2 border-primary/30 hover:border-primary transition-all flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
                    <Lightbulb className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-sm text-foreground">Learn Again</p>
                    <p className="text-xs text-muted-foreground">Pylo will re-teach weak areas</p>
                  </div>
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={startReview}
                  className="w-full p-4 rounded-2xl bg-card shadow-card border border-border hover:border-primary/40 transition-all flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                    <RotateCcw className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-sm text-foreground">Review Again</p>
                    <p className="text-xs text-muted-foreground">Quick retry on weak areas</p>
                  </div>
                </motion.button>
              </>
            )}

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
  }

  // ── Continue (after summary) ──
  const didWell = quizResult && quizResult.score >= Math.ceil(quizResult.total * 0.7);
  return (
    <div className="flex flex-col h-full min-h-0">
      {renderHeader("Continue Learning", () => setStep("summary"))}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center text-center gap-3 mb-6">
          <img src={didWell ? mascotWave : mascot} alt="Pylo" className="w-14 h-14 sm:w-16 sm:h-16 pylo-appear pylo-idle" />
          <h3 className="font-display font-bold text-base sm:text-lg text-foreground">
            {didWell ? "Great work! What's next?" : "Let's strengthen what you missed."}
          </h3>
        </motion.div>

        <div className="space-y-3 max-w-sm mx-auto">
          {/* If did poorly, offer to go back to pystudying */}
          {!didWell && incorrectQuestions.length > 0 && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={retryWithPystudying}
              className="w-full p-4 rounded-2xl bg-card shadow-card border-2 border-primary/30 hover:border-primary transition-all flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-display font-bold text-sm text-foreground">Learn Again</p>
                <p className="text-xs text-muted-foreground">Pylo will re-teach weak areas</p>
              </div>
            </motion.button>
          )}

          {/* Review button */}
          {incorrectQuestions.length > 0 && didWell && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={startReview}
              className="w-full p-4 rounded-2xl bg-card shadow-card border-2 border-primary/30 hover:border-primary transition-all flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
                <Target className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-display font-bold text-sm text-foreground">Review</p>
                <p className="text-xs text-muted-foreground">Focus on what you got wrong</p>
              </div>
            </motion.button>
          )}

          {incorrectQuestions.length === 0 && (
            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/30 text-center">
              <p className="text-sm font-display font-bold text-primary">Perfect score! 🎉</p>
              <p className="text-xs text-muted-foreground mt-1">You've mastered this topic.</p>
            </div>
          )}

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
