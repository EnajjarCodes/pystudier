import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fileData, imageData, fileName, mimeType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let contentParts: any[];

    if (imageData) {
      // OCR for images
      contentParts = [
        {
          type: "text",
          text: "Extract ALL text content from this image. Perform OCR and return every piece of text you can read, preserving the structure and formatting as much as possible. If there are tables, format them clearly. If there's no text, describe the image contents in detail.",
        },
        {
          type: "image_url",
          image_url: { url: imageData },
        },
      ];
    } else if (fileData) {
      // For PDFs and documents: Gemini supports PDF via inline_data
      const lowerName = (fileName || "").toLowerCase();
      const isPdf = lowerName.endsWith(".pdf") || mimeType === "application/pdf";

      if (isPdf) {
        // Extract the raw base64 from data URL
        const base64Match = fileData.match(/^data:[^;]+;base64,(.+)$/);
        if (!base64Match) {
          return new Response(JSON.stringify({ error: "Invalid PDF data format" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        contentParts = [
          {
            type: "text",
            text: `Extract ALL text content from this PDF document (${fileName || "document.pdf"}). Return every piece of text preserving structure, headings, lists, tables, and formatting. Be thorough and complete. Include ALL pages.`,
          },
          {
            type: "image_url",
            image_url: { url: fileData },
          },
        ];
      } else {
        // For other documents (docx, pptx, etc.) - send as image_url with data URI
        contentParts = [
          {
            type: "text",
            text: `Extract ALL text content from this uploaded document (${fileName || "document"}). Return every piece of text preserving structure, headings, lists, tables, and formatting. Be thorough and complete.`,
          },
          {
            type: "image_url",
            image_url: { url: fileData },
          },
        ];
      }
    } else {
      return new Response(JSON.stringify({ error: "No file or image data provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: contentParts,
          },
        ],
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: `Content extraction failed (${response.status})` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-content error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
