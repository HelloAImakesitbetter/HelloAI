import OpenAI from "openai";
import { requireHelloAiApiKey } from "../../../../lib/helloai-api";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: Request) {
  const unauthorized = requireHelloAiApiKey(req);

  if (unauthorized) {
    return unauthorized;
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const { messages, businessName, description } = (await req.json()) as {
      messages?: ChatMessage[];
      businessName?: string;
      description?: string;
    };

    if (!apiKey) {
      throw new Error("AI provider is not configured");
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "A message is required" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: `You are the HelloAI business assistant. Be concise and practical. Business: ${businessName || "Unnamed"}. Brief: ${description || "Not provided"}.`,
        },
        ...messages.slice(-12),
      ],
    });

    return Response.json({ reply: response.output_text });
  } catch (error) {
    console.error("HelloAI API chat failed:", error);

    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to answer" },
      { status: 500 }
    );
  }
}
