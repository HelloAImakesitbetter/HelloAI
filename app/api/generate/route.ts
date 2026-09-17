import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const openai = new OpenAI({ apiKey });
    const { businessName, description } = await req.json();

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `
Business Name: ${businessName}

Description:
${description}

Write a 60-second marketing video dialogue for up to five distinct characters. If the customer provided character names in the request, use those exact names. If no names were provided, choose natural names that fit the characters. Give each character a clear personality and role in the business or customer story. Use only this exact format, one spoken line per row:
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