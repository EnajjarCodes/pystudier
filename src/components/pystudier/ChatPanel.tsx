import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ImagePlus, FileText, Sparkles, Loader2, Wifi, Copy, Check, Pencil, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { toast } from "sonner";
import mascot from "@/assets/mascot.png";
import mascotThinking from "@/assets/mascot-thinking.png";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[];
  fileName?: string;
}

interface ChatPanelProps {
  userName: string;
  messages: Message[];
  onSendMessage: (content: string, images?: string[], file?: File | null) => void;
  onEditMessage?: (messageIndex: number, newContent: string) => void;
  isLoading: boolean;
}

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary transition-all" title="Copy">
      {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
    </button>
  );
};

const ChatPanel = ({ userName, messages, onSendMessage, onEditMessage, isLoading }: ChatPanelProps) => {
  const [input, setInput] = useState("");
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [editingMessageIdx, setEditingMessageIdx] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && attachedImages.length === 0 && !attachedFile) return;
    onSendMessage(input, attachedImages.length > 0 ? attachedImages : undefined, attachedFile);
    setInput("");
    setAttachedImages([]);
    setAttachedFile(null);
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
    const file = e.target.files?.[0];
    if (file) setAttachedFile(file);
    e.target.value = "";
  };

  const startEdit = (idx: number, content: string) => {
    setEditingMessageIdx(idx);
    setEditContent(content);
  };

  const submitEdit = () => {
    if (editingMessageIdx !== null && editContent.trim() && onEditMessage) {
      onEditMessage(editingMessageIdx, editContent.trim());
      setEditingMessageIdx(null);
      setEditContent("");
    }
  };

  const quickPrompts = [
    { label: "Summarize this", icon: Sparkles, prompt: "Please summarize the key points from what we've discussed." },
    { label: "Make notes", icon: FileText, prompt: "Create organized study notes from our conversation." },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-3 sm:p-4 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
        <img src={mascot} alt="Pylo" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
        <div>
          <h2 className="font-display font-bold text-foreground text-sm sm:text-base">Pylo</h2>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Your AI Study Buddy</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Wifi className="w-3 h-3 text-primary" />
          <span className="text-[10px] sm:text-xs text-muted-foreground">Online</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center h-full gap-3 sm:gap-4 text-center px-2">
            <img src={mascot} alt="Pylo" className="w-16 h-16 sm:w-24 sm:h-24 object-contain animate-float" />
            <div>
              <h3 className="font-display font-bold text-base sm:text-lg text-foreground">Hey {userName}! Ready to study?</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1">Send a message, upload an image, or share a document</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {quickPrompts.map((qp) => (
                <motion.button key={qp.label} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => onSendMessage(qp.prompt)}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-secondary text-secondary-foreground font-body font-semibold text-xs sm:text-sm shadow-card hover:shadow-soft transition-all">
                  <qp.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />{qp.label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {messages.map((msg, idx) => (
          <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""} group`}>
            {msg.role === "assistant" && (
              <img src={mascot} alt="Pylo" className="w-6 h-6 sm:w-8 sm:h-8 object-contain flex-shrink-0 mt-1" />
            )}
            <div className="max-w-[85%] sm:max-w-[80%]">
              <div className={`rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 ${
                msg.role === "user"
                  ? "gradient-primary text-primary-foreground rounded-br-md"
                  : "bg-card shadow-card text-card-foreground rounded-bl-md"
              }`}>
                {msg.fileName && (
                  <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 rounded-lg bg-secondary/50 text-xs sm:text-sm">
                    <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-coral" />
                    <span className="font-semibold truncate">{msg.fileName}</span>
                  </div>
                )}
                {msg.images && msg.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {msg.images.map((img, i) => (
                      <img key={i} src={img} alt="Uploaded" className="max-w-[150px] sm:max-w-[200px] rounded-lg" />
                    ))}
                  </div>
                )}
                {editingMessageIdx === idx ? (
                  <div className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      autoFocus
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-body text-xs sm:text-sm focus:outline-none focus:border-primary min-h-[60px] resize-none"
                    />
                    <div className="flex gap-1.5">
                      <button onClick={submitEdit} className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold">Save</button>
                      <button onClick={() => setEditingMessageIdx(null)} className="px-3 py-1 rounded-lg bg-secondary text-foreground text-xs font-bold">Cancel</button>
                    </div>
                  </div>
                ) : msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none text-card-foreground [&_p]:text-card-foreground [&_li]:text-card-foreground [&_strong]:text-foreground [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_code]:bg-secondary [&_code]:px-1 [&_code]:rounded text-xs sm:text-sm">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm font-body">{msg.content}</p>
                )}
              </div>
              {/* Action buttons below message */}
              {editingMessageIdx !== idx && (
                <div className="flex gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <CopyButton text={msg.content} />
                  {msg.role === "user" && onEditMessage && (
                    <button onClick={() => startEdit(idx, msg.content)} className="p-1 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary transition-all" title="Edit">
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 sm:gap-3">
            <img src={mascotThinking} alt="Pylo thinking" className="w-6 h-6 sm:w-8 sm:h-8 object-contain animate-bounce-gentle" />
            <div className="bg-card shadow-card rounded-2xl rounded-bl-md px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-primary" />
              <span className="text-xs sm:text-sm text-muted-foreground font-body">Pylo is thinking...</span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <AnimatePresence>
        {(attachedImages.length > 0 || attachedFile) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-3 sm:px-4 border-t border-border bg-secondary/30 flex-shrink-0">
            <div className="flex gap-2 py-2 overflow-x-auto">
              {attachedImages.map((img, i) => (
                <div key={i} className="relative group/att flex-shrink-0">
                  <img src={img} alt="" className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg" />
                  <button onClick={() => setAttachedImages((prev) => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center opacity-0 group-hover/att:opacity-100 transition-opacity">×</button>
                </div>
              ))}
              {attachedFile && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-card shadow-card flex-shrink-0">
                  <FileText className="w-4 h-4 text-coral" />
                  <span className="text-xs font-semibold truncate max-w-[80px] sm:max-w-[100px]">{attachedFile.name}</span>
                  <button onClick={() => setAttachedFile(null)} className="text-destructive text-xs font-bold">×</button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="p-3 sm:p-4 border-t border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-end gap-1.5 sm:gap-2">
          <div className="flex gap-0.5 sm:gap-1 flex-shrink-0">
            <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={handleImageUpload} />
            <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.csv" hidden onChange={handleFileUpload} />
            <motion.button type="button" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => imageInputRef.current?.click()} className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-secondary transition-all" title="Upload image">
              <ImagePlus className="w-4 h-4 sm:w-5 sm:h-5" />
            </motion.button>
            <motion.button type="button" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => fileInputRef.current?.click()} className="p-2 rounded-xl text-muted-foreground hover:text-coral hover:bg-secondary transition-all" title="Upload PDF/document">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </motion.button>
          </div>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Pylo anything..."
            className="flex-1 min-w-0 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-border bg-background text-foreground font-body text-xs sm:text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground" />
          <motion.button type="submit" disabled={isLoading || (!input.trim() && attachedImages.length === 0 && !attachedFile)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="p-2.5 sm:p-3 rounded-xl gradient-primary text-primary-foreground shadow-soft disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0">
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          </motion.button>
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;
