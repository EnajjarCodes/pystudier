import { supabase } from "@/integrations/supabase/client";

/**
 * Extract text content from a file (PDF, DOCX, PPTX, TXT, etc.)
 */
export async function extractFileContent(file: File): Promise<string> {
  // For plain text files, read directly
  const textExtensions = [".txt", ".md", ".csv", ".json", ".xml"];
  const fileName = file.name.toLowerCase();
  if (textExtensions.some((ext) => fileName.endsWith(ext))) {
    return await file.text();
  }

  // Check file size (max ~10MB for base64 to avoid payload issues)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File too large. Please use files under 10MB.");
  }

  // For PDFs and other documents, send to edge function for extraction
  const base64 = await fileToBase64(file);

  const { data, error } = await supabase.functions.invoke("extract-content", {
    body: {
      fileData: base64,
      fileName: file.name,
      mimeType: file.type,
    },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  return data?.text || "";
}

/**
 * Extract text from an image using OCR via AI
 */
export async function extractImageContent(imageDataUrl: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("extract-content", {
    body: {
      imageData: imageDataUrl,
      mimeType: "image",
    },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  return data?.text || "";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
