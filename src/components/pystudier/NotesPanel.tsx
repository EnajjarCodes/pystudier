import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Trash2, Clock, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  type: "summary" | "notes" | "custom";
}

interface NotesPanelProps {
  notes: Note[];
  onDeleteNote: (id: string) => void;
}

const CopyNoteButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Note copied!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={(e) => { e.stopPropagation(); handleCopy(); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all" title="Copy note">
      {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

const NotesPanel = ({ notes, onDeleteNote }: NotesPanelProps) => {
  const [selectedNote, setSelectedNote] = useState<string | null>(null);

  const typeColors: Record<string, string> = {
    summary: "bg-coral/10 text-coral",
    notes: "bg-primary/10 text-primary",
    custom: "bg-lavender text-foreground",
  };

  const activeNote = notes.find((n) => n.id === selectedNote);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border bg-card/80 backdrop-blur-sm">
        <h2 className="font-display font-bold text-foreground flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          My Notes
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {notes.length} note{notes.length !== 1 ? "s" : ""} saved
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-display font-bold text-foreground">No notes yet!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ask Pylo to summarize or create notes from your study materials.
            </p>
          </div>
        ) : activeNote ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setSelectedNote(null)} className="text-sm text-primary font-semibold hover:underline">
                ← Back to all notes
              </button>
              <CopyNoteButton text={activeNote.content} />
            </div>
            <h3 className="font-display font-bold text-lg text-foreground mb-2">{activeNote.title}</h3>
            <div className="flex items-center gap-2 mb-4">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${typeColors[activeNote.type]}`}>
                {activeNote.type}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {activeNote.createdAt.toLocaleDateString()}
              </span>
            </div>
            <div className="prose prose-sm max-w-none text-foreground bg-secondary/30 rounded-xl p-4 whitespace-pre-wrap font-body">
              {activeNote.content}
            </div>
          </motion.div>
        ) : (
          <div className="p-3 space-y-2">
            {notes.map((note, i) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedNote(note.id)}
                className="p-3 rounded-xl bg-card shadow-card hover:shadow-soft cursor-pointer transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-display font-bold text-sm text-foreground truncate">{note.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{note.content}</p>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <CopyNoteButton text={note.content} />
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeColors[note.type]}`}>
                    {note.type}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {note.createdAt.toLocaleDateString()}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesPanel;
