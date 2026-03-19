import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, MessageCircle, Trash2, Pencil, Check, X, LogOut, User, Settings, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
  userName: string;
  onSignOut: () => void;
}

const ConversationSidebar = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  userName,
  onSignOut,
}: ConversationSidebarProps) => {
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const startRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const confirmRename = () => {
    if (editingId && editTitle.trim()) {
      onRenameConversation(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* New Chat button at top */}
      <div className="p-3 border-b border-border">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-primary/40 text-primary font-display font-bold text-xs sm:text-sm hover:bg-primary/5 transition-all"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </motion.button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageCircle className="w-8 h-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">No conversations yet</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <motion.div
              key={conv.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`group relative flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all ${
                activeConversationId === conv.id
                  ? "bg-primary/10 border border-primary/20"
                  : "hover:bg-secondary"
              }`}
              onClick={() => editingId !== conv.id && onSelectConversation(conv.id)}
            >
              <MessageCircle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {editingId === conv.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && confirmRename()}
                      className="flex-1 min-w-0 text-xs bg-background border border-border rounded-lg px-2 py-1 focus:outline-none focus:border-primary"
                    />
                    <button onClick={confirmRename} className="text-primary p-0.5"><Check className="w-3 h-3" /></button>
                    <button onClick={() => setEditingId(null)} className="text-muted-foreground p-0.5"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-display font-bold text-foreground truncate">{conv.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(conv.updated_at), "MMM d, h:mm a")}
                    </p>
                  </>
                )}
              </div>
              {editingId !== conv.id && (
                <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); startRename(conv.id, conv.title); }}
                    className="p-1 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }}
                    className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* User menu at bottom */}
      <div className="border-t border-border relative">
        <AnimatePresence>
          {userMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-0 right-0 bg-card border border-border rounded-t-xl shadow-elevated overflow-hidden"
            >
              {showSignOutConfirm ? (
                <div className="p-3 space-y-2">
                  <p className="text-xs text-center font-display font-bold text-foreground">Sign out?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowSignOutConfirm(false); setUserMenuOpen(false); }}
                      className="flex-1 py-2 rounded-xl border border-border text-xs font-display font-bold text-muted-foreground hover:bg-secondary transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={onSignOut}
                      className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-display font-bold hover:bg-destructive/90 transition-all"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-1">
                  <button
                    onClick={() => { navigate("/settings"); setUserMenuOpen(false); }}
                    className="w-full px-4 py-2.5 text-left text-xs font-display font-bold text-foreground hover:bg-secondary transition-colors flex items-center gap-2"
                  >
                    <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                    Settings
                  </button>
                  <button
                    onClick={() => setShowSignOutConfirm(true)}
                    className="w-full px-4 py-2.5 text-left text-xs font-display font-bold text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => { setUserMenuOpen(!userMenuOpen); setShowSignOutConfirm(false); }}
          className="w-full p-3 flex items-center gap-2 hover:bg-secondary transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-xs font-display font-bold text-foreground truncate flex-1 text-left">{userName}</span>
          <ChevronUp className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${userMenuOpen ? "" : "rotate-180"}`} />
        </button>
      </div>
    </div>
  );
};

export default ConversationSidebar;
