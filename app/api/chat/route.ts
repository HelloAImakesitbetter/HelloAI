import OpenAI from "openai";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const { messages, businessName, description, progress } = (await req.json()) as {
      messages?: ChatMessage[];
      businessName?: string;
      description?: string;
      progress?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "A message is required" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: `You are the HelloAI project assistant. Help the user plan and execute business content projects. Be concise and practical. Explain what the next action should be, and never claim that a tool ran unless the application reports it. Current project: ${businessName || "Unnamed"}. Brief: ${description || "Not provided"}. Completed stages: ${progress || "None"}.`,
        },
        ...messages.slice(-12).map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
    });

    return Response.json({ reply: response.output_text });
  } catch (error) {
    console.error("Chat assistant failed:", error);

    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to answer" },
      { status: 500 }
    );
  }
}
