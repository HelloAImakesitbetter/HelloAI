type CharacterInput = { name?: string; avatarId?: string; voiceId?: string };

type DialogueLine = { speaker: string; text: string };

function parseDialogue(script: string): DialogueLine[] {
  return script
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([^:]{1,40})\s*:\s*(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({ speaker: match[1].trim(), text: match[2].trim() }))
    .filter((line) => line.text.length > 0);
}

export async function POST(req: Request) {
  try {
    const { script, characters } = (await req.json()) as { script?: string; characters?: CharacterInput[] };
    if (!script || typeof script !== "string") return Response.json({ error: "A script is required" }, { status: 400 });

    const heygenKey = process.env.HEYGEN_API_KEY;
    const dialogue = parseDialogue(script);
    const savedCharacters = Array.isArray(characters) ? characters : [];
    if (!heygenKey) throw new Error("HEYGEN_API_KEY is not configured. Add it in Vercel.");
    if (dialogue.length === 0) throw new Error("The script must contain dialogue in the format Character: spoken line.");
    if (savedCharacters.length === 0) throw new Error("Add at least one character with an avatar and voice before generating the video.");

    const videoInputs = dialogue.map((line) => {
      const character = savedCharacters.find((item) => item.name?.toLowerCase() === line.speaker.toLowerCase());
      if (!character?.avatarId || !character.voiceId) {
        throw new Error(`Add a HeyGen avatar and voice for "${line.speaker}" on the Characters page.`);
      }
      return {
        character: { type: "avatar", avatar_id: character.avatarId },
        voice: { type: "text", input_text: line.text, voice_id: character.voiceId },
      };
    });

    const response = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: { "X-Api-Key": heygenKey, "Content-Type": "application/json" },
      body: JSON.stringify({ video_inputs: videoInputs, dimension: { width: 1280, height: 720 }, caption: false }),
    });
    const data = await response.json();
    if (!response.ok || !data?.data?.video_id) {
      throw new Error(data?.error?.message || data?.message || "HeyGen video generation failed");
    }

    return Response.json({ provider: "heygen", ids: [data.data.video_id], status: "queued", progress: 0 });
  } catch (error) {
    console.error("Runway cinematic generation failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to generate cinematic video" }, { status: 500 });
  }
}
