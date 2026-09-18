type DialogueLine = { speaker: string; text: string };
type CharacterConfig = { avatarId: string; voiceId?: string };

function parseDialogue(script: string): DialogueLine[] {
  return script.split(/\r?\n/).map((line) => line.match(/^\s*([^:]{1,40})\s*:\s*(.+)$/)).filter((match): match is RegExpMatchArray => Boolean(match)).map((match) => ({ speaker: match[1].trim(), text: match[2].trim() })).filter((line) => !/^(narrator|voiceover|scene|director)$/i.test(line.speaker));
}

function characterConfig(speaker: string): CharacterConfig | null {
  const key = speaker.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const avatarId = process.env[`HEYGEN_${key}_AVATAR_ID`];
  const voiceId = process.env[`HEYGEN_${key}_VOICE_ID`];
  return avatarId ? { avatarId, ...(voiceId ? { voiceId } : {}) } : null;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    const { businessName, script, description } = (await req.json()) as { businessName?: string; script?: string; description?: string };

    if (!apiKey) throw new Error("HEYGEN_API_KEY is not configured");
    if (!script || typeof script !== "string") return Response.json({ error: "A script is required" }, { status: 400 });

    const dialogue = parseDialogue(script);
    const speakers = [...new Set(dialogue.map((line) => line.speaker))];
    const segments = speakers.map((speaker) => ({ speaker, text: dialogue.filter((line) => line.speaker === speaker).map((line) => line.text).join(" "), config: characterConfig(speaker) }));
    const missing = segments.filter((segment) => !segment.config).map((segment) => segment.speaker);

    if (missing.length > 0) {
      const key = missing[0].toUpperCase().replace(/[^A-Z0-9]+/g, "_");
      return Response.json({ error: `Missing HeyGen avatar mapping for ${missing.join(", ")}. Add HEYGEN_${key}_AVATAR_ID and matching voice ID.` }, { status: 400 });
    }

    const ids = await Promise.all(segments.map(async ({ speaker, text, config }) => {
      const response = await fetch("https://api.heygen.com/v3/videos", {
        method: "POST",
        headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "avatar", avatar_id: config!.avatarId, ...(config!.voiceId ? { voice_id: config!.voiceId } : {}), script: `Speak naturally as ${speaker}. Use clear facial expressions, eye contact, and accurate lip synchronization. Do not say your name aloud. Dialogue: ${text}`, title: `${businessName || "HelloAI"} - ${speaker}`, resolution: "720p", aspect_ratio: "16:9", motion_prompt: "Natural eye contact, expressive face, subtle hand gestures, calm confident delivery." }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || `${speaker} video request failed`);
      if (!data?.data?.video_id) throw new Error(`HeyGen did not return a video ID for ${speaker}`);
      return data.data.video_id as string;
    }));

    return Response.json({ ids, duration: description || "", status: "queued", progress: 0 });
  } catch (error) {
    console.error("HeyGen video generation failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to generate HeyGen video" }, { status: 500 });
  }
}
