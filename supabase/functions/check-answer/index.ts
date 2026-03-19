import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userAnswer, correctAnswer, question } = await req.json();
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
            content: `You are an answer checker for a study quiz. Compare the student's answer to the correct answer. 
Determine if they are equivalent — ignoring differences in:
- Spacing, capitalization, punctuation
- Mathematical notation (e.g., "x^2" vs "x²" vs "x squared")
- Phrasing (e.g., "the mitochondria is the powerhouse of the cell" vs "mitochondria - powerhouse of cell")
- Units written differently (e.g., "5 m/s" vs "5 meters per second")
- Equivalent mathematical expressions (e.g., "2/4" vs "0.5" vs "1/2")

Respond with ONLY a JSON object: {"correct": true/false, "explanation": "brief reason if incorrect"}
If the answer is correct, set explanation to empty string.`,
          },
          {
            role: "user",
            content: `Question: ${question}\nStudent's answer: "${userAnswer}"\nCorrect answer: "${correctAnswer}"`,
          },
        ],
      }),
    });

    if (!response.ok) {
      // Fallback to simple comparison
      const simple = userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
      return new Response(JSON.stringify({ correct: simple, explanation: simple ? "" : "Your answer doesn't match the expected answer." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return new Response(JSON.stringify({ correct: !!result.correct, explanation: result.explanation || "" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch {}

    // Fallback
    const simple = userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    return new Response(JSON.stringify({ correct: simple, explanation: "" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-answer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
