import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { action, code, redirect_uri } = await req.json();

    const CLIENT_ID = Deno.env.get("GOOGLE_CLASSROOM_CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("GOOGLE_CLASSROOM_CLIENT_SECRET");

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return new Response(JSON.stringify({ error: "Google Classroom not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: get-auth-url
    if (action === "get-auth-url") {
      const scopes = [
        "https://www.googleapis.com/auth/classroom.courses.readonly",
        "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
        "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
      ];
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", CLIENT_ID);
      url.searchParams.set("redirect_uri", redirect_uri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", scopes.join(" "));
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      url.searchParams.set("state", userId);

      return new Response(JSON.stringify({ url: url.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: exchange-code
    if (action === "exchange-code") {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri,
          grant_type: "authorization_code",
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        return new Response(JSON.stringify({ error: "Token exchange failed", details: tokenData }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Store tokens in user metadata (profiles table)
      const serviceClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await serviceClient.from("profiles").update({
        google_classroom_token: JSON.stringify({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: Date.now() + (tokenData.expires_in * 1000),
        }),
      }).eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: fetch-data — get courses + coursework
    if (action === "fetch-data") {
      const serviceClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("google_classroom_token")
        .eq("user_id", userId)
        .single();

      if (!profile?.google_classroom_token) {
        return new Response(JSON.stringify({ error: "Not connected", connected: false }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let tokens = JSON.parse(profile.google_classroom_token as string);

      // Refresh if expired
      if (Date.now() >= tokens.expires_at - 60000) {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token: tokens.refresh_token,
            grant_type: "refresh_token",
          }),
        });
        const refreshData = await refreshRes.json();
        if (refreshRes.ok) {
          tokens.access_token = refreshData.access_token;
          tokens.expires_at = Date.now() + (refreshData.expires_in * 1000);
          await serviceClient.from("profiles").update({
            google_classroom_token: JSON.stringify(tokens),
          }).eq("user_id", userId);
        } else {
          return new Response(JSON.stringify({ error: "Token refresh failed", connected: false }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const accessToken = tokens.access_token;
      const headers = { Authorization: `Bearer ${accessToken}` };

      // Fetch courses
      const coursesRes = await fetch("https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=10", { headers });
      const coursesData = await coursesRes.json();
      if (!coursesRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch courses", connected: false }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const courses = coursesData.courses || [];
      const items: any[] = [];

      // Fetch coursework for each course (limit to 5 items total)
      for (const course of courses.slice(0, 5)) {
        try {
          const cwRes = await fetch(
            `https://classroom.googleapis.com/v1/courses/${course.id}/courseWork?pageSize=3&orderBy=dueDate desc`,
            { headers }
          );
          const cwData = await cwRes.json();
          const works = cwData.courseWork || [];

          for (const work of works.slice(0, 2)) {
            if (items.length >= 5) break;

            // Try to get teacher name
            let teacherName = "";
            try {
              const teachersRes = await fetch(
                `https://classroom.googleapis.com/v1/courses/${course.id}/teachers?pageSize=1`,
                { headers }
              );
              const teachersData = await teachersRes.json();
              teacherName = teachersData.teachers?.[0]?.profile?.name?.fullName || "";
            } catch {}

            // Try to extract attachment content
            let attachmentContent = "";
            if (work.materials) {
              for (const mat of work.materials.slice(0, 2)) {
                if (mat.driveFile?.driveFile?.id) {
                  try {
                    const driveRes = await fetch(
                      `https://www.googleapis.com/drive/v3/files/${mat.driveFile.driveFile.id}/export?mimeType=text/plain`,
                      { headers }
                    );
                    if (driveRes.ok) {
                      const text = await driveRes.text();
                      attachmentContent += `\n${text.substring(0, 2000)}`;
                    }
                  } catch {}
                }
                if (mat.link?.url) {
                  attachmentContent += `\nLink: ${mat.link.url}`;
                }
              }
            }

            items.push({
              id: work.id,
              courseId: course.id,
              courseName: course.name || "Unknown Course",
              teacherName,
              title: work.title || "Untitled",
              description: work.description || "",
              attachmentContent: attachmentContent.trim(),
              dueDate: work.dueDate ? `${work.dueDate.year}-${work.dueDate.month}-${work.dueDate.day}` : null,
            });
          }
        } catch {}
        if (items.length >= 5) break;
      }

      return new Response(JSON.stringify({ connected: true, items }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: disconnect
    if (action === "disconnect") {
      const serviceClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await serviceClient.from("profiles").update({
        google_classroom_token: null,
      }).eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Google Classroom error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
