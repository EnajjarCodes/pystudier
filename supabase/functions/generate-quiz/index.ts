import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, questionTypes, questionCount, context, difficulty } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const typeDescriptions = questionTypes.map((t: string) => {
      switch (t) {
        case "multiple_choice": return "Multiple Choice (4 options, one correct)";
        case "true_false": return "True/False";
        case "written": return "Written/Short Answer";
        case "matching": return "Matching (4 pairs to match)";
        default: return t;
      }
    }).join(", ");

    const difficultyInstructions = difficulty === "easy"
      ? "Make the questions EASY: straightforward, simple recall, no trick questions, minimal steps required."
      : difficulty === "hard"
      ? "Make the questions HARD: complex, multi-step reasoning, tricky distractors, deep understanding required."
      : "Make the questions NORMAL difficulty: balanced between simple recall and moderate reasoning.";

    const systemPrompt = `You are a quiz generator AI. Generate exactly ${questionCount} quiz questions about the given topic.

Question types to include: ${typeDescriptions}
Distribute question types as evenly as possible across the requested types.

DIFFICULTY: ${difficultyInstructions}
The difficulty setting OVERRIDES any difficulty mentioned in the user's topic. If the user says "easy algebra" but difficulty is "hard", generate HARD algebra questions.

You MUST respond by calling the generate_quiz function with the quiz data. Do not respond with plain text.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a quiz about: ${topic}${context ? `\n\nAdditional context from study materials:\n${context}` : ""}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_quiz",
              description: "Generate quiz questions with answers",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["multiple_choice", "true_false", "written", "matching"] },
                        question: { type: "string", description: "The question text" },
                        options: {
                          type: "array",
                          items: { type: "string" },
                          description: "For multiple_choice: 4 options. For true_false: ['True','False']. For matching: items to match (left side). For written: empty array."
                        },
                        correctAnswer: { type: "string", description: "For multiple_choice/true_false: the correct option text. For written: the expected answer. For matching: not used." },
                        matchPairs: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              left: { type: "string" },
                              right: { type: "string" }
                            },
                            required: ["left", "right"]
                          },
                          description: "Only for matching type: array of {left, right} pairs"
                        },
                        explanation: { type: "string", description: "Brief explanation of why the answer is correct" }
                      },
                      required: ["type", "question", "options", "correctAnswer", "explanation"]
                    }
                  }
                },
                required: ["questions"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_quiz" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Failed to generate quiz" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return quiz data" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const quizData = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(quizData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("quiz error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
