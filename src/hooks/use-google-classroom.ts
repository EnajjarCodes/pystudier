import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ClassroomItem {
  id: string;
  courseId: string;
  courseName: string;
  teacherName: string;
  title: string;
  description: string;
  attachmentContent: string;
  dueDate: string | null;
}

export function useGoogleClassroom(userId: string) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ClassroomItem[]>([]);

  const REDIRECT_URI = `${window.location.origin}/classroom-callback`;

  const connect = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await supabase.functions.invoke("google-classroom", {
        body: { action: "get-auth-url", redirect_uri: REDIRECT_URI },
      });

      if (res.data?.url) {
        // Store callback info
        sessionStorage.setItem("gc_redirect", window.location.href);
        window.location.href = res.data.url;
      } else {
        toast.error("Could not start Google Classroom connection");
      }
    } catch (e) {
      toast.error("Connection failed");
    } finally {
      setLoading(false);
    }
  }, [REDIRECT_URI]);

  const exchangeCode = useCallback(async (code: string) => {
    setLoading(true);
    try {
      const res = await supabase.functions.invoke("google-classroom", {
        body: { action: "exchange-code", code, redirect_uri: REDIRECT_URI },
      });
      if (res.data?.success) {
        setConnected(true);
        toast.success("Google Classroom connected!");
        return true;
      } else {
        toast.error("Failed to connect Google Classroom");
        return false;
      }
    } catch {
      toast.error("Connection failed");
      return false;
    } finally {
      setLoading(false);
    }
  }, [REDIRECT_URI]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supabase.functions.invoke("google-classroom", {
        body: { action: "fetch-data" },
      });
      if (res.data?.connected) {
        setConnected(true);
        setItems(res.data.items || []);
      } else {
        setConnected(false);
        setItems([]);
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setLoading(true);
    try {
      await supabase.functions.invoke("google-classroom", {
        body: { action: "disconnect" },
      });
      setConnected(false);
      setItems([]);
      toast.success("Google Classroom disconnected");
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setLoading(false);
    }
  }, []);

  return { connected, loading, items, connect, exchangeCode, fetchItems, disconnect };
}
