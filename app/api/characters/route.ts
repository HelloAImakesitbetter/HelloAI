type HeyGenItem = { id?: string; name?: string; preview_image_url?: string; image_url?: string; gender?: string; language?: string };

export async function GET() {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) throw new Error("HEYGEN_API_KEY is not configured");
    const headers = { "X-Api-Key": apiKey };
    const [avatarResponse, voiceResponse] = await Promise.all([
      fetch("https://api.heygen.com/v2/avatars", { headers }),
      fetch("https://api.heygen.com/v2/voices", { headers }),
    ]);
    const avatarsData = await avatarResponse.json();
    const voicesData = await voiceResponse.json();
    if (!avatarResponse.ok) throw new Error(avatarsData?.error?.message || "Failed to load HeyGen avatars");
    if (!voiceResponse.ok) throw new Error(voicesData?.error?.message || "Failed to load HeyGen voices");
    const avatars = ((avatarsData?.data?.avatars || []) as HeyGenItem[]).filter((item) => item.id).map((item) => ({ id: item.id, name: item.name || item.id, previewUrl: item.preview_image_url || item.image_url || "", gender: item.gender || "" }));
    const voices = ((voicesData?.data?.voices || []) as HeyGenItem[]).filter((item) => item.id).map((item) => ({ id: item.id, name: item.name || item.id, gender: item.gender || "", language: item.language || "" }));
    return Response.json({ avatars, voices });
  } catch (error) {
    console.error("Character catalog failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to load characters" }, { status: 500 });
  }
}
