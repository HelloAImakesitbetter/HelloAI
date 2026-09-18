type HeyGenItem = { id?: string; avatar_id?: string; voice_id?: string; name?: string; preview_image_url?: string; image_url?: string; gender?: string; language?: string };

export async function GET() {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) throw new Error("HEYGEN_API_KEY is not configured");
    const headers = { "X-Api-Key": apiKey };
    const [avatarResponse, voiceResponse] = await Promise.all([
      fetch("https://api.heygen.com/v2/avatars", { headers }),
      fetch("https://api.heygen.com/v3/voices?limit=100", { headers }),
    ]);
    const avatarsData = await avatarResponse.json();
    const voicesData = await voiceResponse.json();
    if (!avatarResponse.ok) throw new Error(avatarsData?.error?.message || "Failed to load HeyGen avatars");
    if (!voiceResponse.ok) throw new Error(voicesData?.error?.message || "Failed to load HeyGen voices");
    const rawAvatars = (avatarsData?.data?.avatars || avatarsData?.data || []) as HeyGenItem[];
    const rawVoices = (voicesData?.data?.voices || voicesData?.data || []) as HeyGenItem[];
    const avatars = rawAvatars.map((item) => ({ id: item.id || item.avatar_id, name: item.name || item.id || item.avatar_id, previewUrl: item.preview_image_url || item.image_url || "", gender: item.gender || "" })).filter((item) => item.id);
    const voices = rawVoices.map((item) => ({ id: item.id || item.voice_id, name: item.name || item.id || item.voice_id, gender: item.gender || "", language: item.language || "" })).filter((item) => item.id);
    return Response.json({ avatars, voices });
  } catch (error) {
    console.error("Character catalog failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to load characters" }, { status: 500 });
  }
}
