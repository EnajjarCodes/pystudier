import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a chat title generator. Given the user's first message, generate a short, descriptive title (2-5 words) for the conversation. The title should capture the main topic or intent. Examples:
- "Teach me algebra" → "Algebra Explained"
- "What is photosynthesis?" → "Photosynthesis Basics"
- "Help me with my Python homework" → "Python Homework Help"
- "Summarize World War 2" → "WW2 Summary"
Respond with ONLY the title, nothing else.`,
          },
          { role: "user", content: message },
        ],
      }),
    });

    if (!response.ok) {
      // Fallback: use first few words
      const fallback = message.slice(0, 40).trim() || "New Chat";
      return new Response(JSON.stringify({ title: fallback }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const title = (data.choices?.[0]?.message?.content || "").trim().replace(/^["']|["']$/g, "") || message.slice(0, 40);
    
    return new Response(JSON.stringify({ title }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-title error:", e);
    return new Response(JSON.stringify({ title: "New Chat" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
