import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const openai = new OpenAI({ apiKey });
    const { businessName, description } = await req.json();
    const configuredCharacters = Object.keys(process.env)
      .filter((key) => key.startsWith("HEYGEN_") && key.endsWith("_AVATAR_ID"))
      .map((key) => key.replace(/^HEYGEN_/, "").replace(/_AVATAR_ID$/, "").replace(/_/g, " "))
      .filter(Boolean);
    const characterRoster = configuredCharacters.length
      ? `The only available characters are: ${configuredCharacters.join(", ")}. Use these exact names and no others.`
      : "Use customer-provided names, or choose names if none were provided.";

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `
Business Name: ${businessName}

Description:
${description}

Write a 60-second marketing video dialogue for up to five distinct characters. ${characterRoster} Give each character a clear personality and role in the business or customer story. Use only this exact format, one spoken line per row:
Character name: spoken line

Every character must speak at least once. Do not include a narrator, voiceover label, stage directions, scene descriptions, bracketed text, subtitles, logos, or on-screen text. Return only spoken dialogue rows.
      `,
    });

    return Response.json({
      script: response.output_text,
    });
  } catch (error) {
    console.error("Script generation failed:", error);

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate script",
      },
      { status: 500 }
    );
  }
}