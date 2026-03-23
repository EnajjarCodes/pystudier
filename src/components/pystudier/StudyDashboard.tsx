import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, FileText, Brain, Menu, X, BarChart3, Users } from "lucide-react";
import ChatPanel, { Message } from "./ChatPanel";
import NotesPanel, { Note } from "./NotesPanel";
import QuizPanel from "./QuizPanel";
import ConversationSidebar, { Conversation } from "./ConversationSidebar";
import ProgressDashboard from "./ProgressDashboard";
import { streamChat } from "@/lib/ai-stream";
import { extractFileContent, extractImageContent } from "@/lib/content-extractor";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import mascot from "@/assets/mascot.png";

const CHATROOM_URL = import.meta.env.VITE_CHATROOM_URL || "https://041378b9-921d-4592-a288-68dfbdadac56-00-3dweh90a1cs1g.picard.replit.dev";

interface StudyDashboardProps {
  userName: string;
  userId: string;
}

type Tab = "chat" | "notes" | "quiz" | "dashboard";

const StudyDashboard = ({ userName, userId }: StudyDashboardProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const conversationRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const loadConversations = useCallback(async () => {
    const { data } = await supabase.from("conversations").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
    if (data) setConversations(data);
  }, [userId]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const loadMessages = async (conversationId: string) => {
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
    if (data) {
      setMessages(data.map((m: any) => ({ id: m.id, role: m.role, content: m.content, images: m.images, fileName: m.file_name })));
      conversationRef.current = data.map((m: any) => ({ role: m.role, content: m.content }));
    }
  };

  const createNewConversation = async () => {
    const { data, error } = await supabase.from("conversations").insert({ user_id: userId, title: "New Chat" }).select().single();
    if (data && !error) {
      setActiveConversationId(data.id);
      setMessages([]);
      conversationRef.current = [];
      loadConversations();
    }
    return data?.id || null;
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    loadMessages(id);
    setChatSidebarOpen(false);
    setActiveTab("chat");
  };

  const handleNewConversation = async () => {
    await createNewConversation();
    setChatSidebarOpen(false);
    setActiveTab("chat");
  };

  const handleRenameConversation = async (id: string, title: string) => {
    await supabase.from("conversations").update({ title }).eq("id", id);
    loadConversations();
  };

  const handleDeleteConversation = async (id: string) => {
    await supabase.from("conversations").delete().eq("id", id);
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setMessages([]);
      conversationRef.current = [];
    }
    loadConversations();
  };

  const saveMessage = async (conversationId: string, role: string, content: string, images?: string[], fileName?: string) => {
    await supabase.from("messages").insert({ conversation_id: conversationId, user_id: userId, role, content, images: images || null, file_name: fileName || null });
  };

  const generateAITitle = async (message: string, convId: string) => {
    try {
      const { data } = await supabase.functions.invoke("generate-title", { body: { message } });
      const title = data?.title || message.slice(0, 40) || "New Chat";
      await supabase.from("conversations").update({ title }).eq("id", convId);
      loadConversations();
    } catch {
      const title = message.slice(0, 40) || "New Chat";
      await supabase.from("conversations").update({ title }).eq("id", convId);
      loadConversations();
    }
  };

  const handleEditMessage = async (messageIndex: number, newContent: string) => {
    // Remove messages from the edited index onward
    const newMessages = messages.slice(0, messageIndex);
    const editedMsg: Message = { ...messages[messageIndex], content: newContent };
    newMessages.push(editedMsg);
    setMessages(newMessages);
    conversationRef.current = newMessages.map((m) => ({ role: m.role, content: m.content }));

    // Re-send as if it's a new message
    let convId = activeConversationId;
    if (!convId) return;

    setIsLoading(true);
    conversationRef.current = newMessages.map((m) => ({ role: m.role, content: m.content }));

    let assistantSoFar = "";
    const assistantId = generateId();

    try {
      await streamChat({
        messages: conversationRef.current,
        onDelta: (chunk) => {
          assistantSoFar += chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.id === assistantId) {
              return prev.map((m) => (m.id === assistantId ? { ...m, content: assistantSoFar } : m));
            }
            return [...prev, { id: assistantId, role: "assistant" as const, content: assistantSoFar }];
          });
        },
        onDone: async () => {
          conversationRef.current.push({ role: "assistant", content: assistantSoFar });
          await saveMessage(convId!, "assistant", assistantSoFar);
          await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId!);
          setIsLoading(false);
        },
        onError: (error) => { toast.error(error); setIsLoading(false); },
      });
    } catch {
      toast.error("Failed to connect to Pylo.");
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (content: string, images?: string[], file?: File | null) => {
    let convId = activeConversationId;
    if (!convId) {
      convId = await createNewConversation();
      if (!convId) return;
    }

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: content || (file ? `Uploaded: ${file.name}` : "Shared an image"),
      images,
      fileName: file?.name,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    let extractedContent = "";
    try {
      if (file) {
        toast.info(`Extracting content from ${file.name}...`);
        extractedContent = await extractFileContent(file);
      }
      if (images && images.length > 0) {
        toast.info("Extracting text from image...");
        const imageTexts = await Promise.all(images.map((img) => extractImageContent(img)));
        const combined = imageTexts.filter(Boolean).join("\n\n");
        if (combined) extractedContent += (extractedContent ? "\n\n" : "") + combined;
      }
    } catch (err) {
      console.error("Extraction error:", err);
      toast.error("Could not fully extract content, sending as-is.");
    }

    let userContent = content;
    if (extractedContent) {
      userContent = `${content ? content + "\n\n" : ""}[Extracted content from uploaded file(s):\n${extractedContent}]`;
    } else if (file) {
      userContent = `[User uploaded a file: ${file.name}] ${content}`;
    } else if (images?.length) {
      userContent = `[User shared image(s)] ${content}`;
    }

    conversationRef.current.push({ role: "user", content: userContent });
    await saveMessage(convId, "user", userMessage.content, images, file?.name);

    if (conversationRef.current.length === 1) {
      generateAITitle(content || (file ? file.name : "New Chat"), convId);
    }

    let assistantSoFar = "";
    const assistantId = generateId();

    try {
      await streamChat({
        messages: conversationRef.current,
        onDelta: (chunk) => {
          assistantSoFar += chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.id === assistantId) {
              return prev.map((m) => (m.id === assistantId ? { ...m, content: assistantSoFar } : m));
            }
            return [...prev, { id: assistantId, role: "assistant" as const, content: assistantSoFar }];
          });
        },
        onDone: async () => {
          conversationRef.current.push({ role: "assistant", content: assistantSoFar });
          await saveMessage(convId!, "assistant", assistantSoFar);
          await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId!);
          setIsLoading(false);

          if (content.toLowerCase().includes("summar") || content.toLowerCase().includes("note")) {
            const newNote: Note = {
              id: generateId(),
              title: content.slice(0, 40) || "AI Notes",
              content: assistantSoFar.slice(0, 500),
              createdAt: new Date(),
              type: content.toLowerCase().includes("summar") ? "summary" : "notes",
            };
            setNotes((prev) => [newNote, ...prev]);
          }
        },
        onError: (error) => { toast.error(error); setIsLoading(false); },
      });
    } catch {
      toast.error("Failed to connect to Pylo. Please try again.");
      setIsLoading(false);
    }
  };

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const openStudyRooms = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const url = `${CHATROOM_URL}#access_token=${session.access_token}&refresh_token=${session.refresh_token}&token_type=bearer&expires_in=3600`;
      window.open(url, "_blank");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const chatContext = conversationRef.current.slice(-6).map((m) => `${m.role}: ${m.content}`).join("\n");

  const tabs: { id: Tab; label: string; icon: typeof MessageCircle }[] = [
    { id: "chat", label: "Chat", icon: MessageCircle },
    { id: "quiz", label: "Quiz", icon: Brain },
    { id: "dashboard", label: "Progress", icon: BarChart3 },
    { id: "notes", label: "Notes", icon: FileText },
  ];

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* Top Nav */}
      <header className="h-12 sm:h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-3 sm:px-4 gap-2 sm:gap-3 flex-shrink-0">
        <button onClick={() => setChatSidebarOpen(!chatSidebarOpen)} className="p-1.5 sm:p-2 rounded-xl hover:bg-secondary transition-colors">
          {chatSidebarOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>
        <img src={mascot} alt="Pylo" className="w-6 h-6 sm:w-8 sm:h-8 object-contain pylo-idle" />
        <div className="flex items-baseline gap-0.5">
          <span className="font-display font-black text-primary text-base sm:text-lg">Py</span>
          <span className="font-display font-black text-coral text-base sm:text-lg">studier</span>
        </div>
        <div className="ml-auto" />
      </header>

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

        {/* Chat sidebar overlay */}
        <AnimatePresence>
          {chatSidebarOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setChatSidebarOpen(false)} className="fixed inset-0 bg-foreground/20 z-40" />
              <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} className="fixed left-0 top-12 sm:top-14 bottom-0 w-72 sm:w-80 bg-card border-r border-border z-50">
                <ConversationSidebar
                  conversations={conversations}
                  activeConversationId={activeConversationId}
                  onSelectConversation={handleSelectConversation}
                  onNewConversation={handleNewConversation}
                  onRenameConversation={handleRenameConversation}
                  onDeleteConversation={handleDeleteConversation}
                  userName={userName}
                  onSignOut={handleLogout}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden pb-12 lg:pb-0">
          <div className={`flex-1 ${activeTab === "chat" ? "flex" : "hidden lg:hidden"} flex-col min-w-0`}>
            <ChatPanel userName={userName} messages={messages} onSendMessage={handleSendMessage} onEditMessage={handleEditMessage} isLoading={isLoading} />
          </div>
          <div className={`flex-1 ${activeTab === "quiz" ? "flex" : "hidden"} flex-col min-w-0`}>
            <QuizPanel userName={userName} chatContext={chatContext} />
          </div>
          <div className={`flex-1 ${activeTab === "dashboard" ? "flex" : "hidden"} flex-col min-w-0`}>
            <ProgressDashboard userId={userId} />
          </div>
          <div className={`${activeTab === "notes" ? "flex flex-1 lg:flex lg:w-80 lg:flex-none" : "hidden lg:flex lg:w-80"} border-l border-border flex-col min-w-0`}>
            <NotesPanel notes={notes} onDeleteNote={handleDeleteNote} />
          </div>
        </div>

        {/* Mobile bottom tabs */}
        <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border flex lg:hidden z-30">
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
