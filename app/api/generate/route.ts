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

Write a 60-second marketing video dialogue for five distinct characters: Maya, Jordan, Priya, Marcus, and Elena. Give each character a clear personality and a different role in the business or customer story. Use only this exact format, one spoken line per row:
Maya: ...
Jordan: ...
Priya: ...
Marcus: ...
Elena: ...

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