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

    const safeMessages = messages
      .filter(
        (message) =>
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim().length > 0
      )
      .slice(-12);

    if (safeMessages.length === 0) {
      return Response.json({ error: "A valid message is required" }, { status: 400 });
    }

    const currentStage = progress || "brief only";
    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      model: process.env.HELLOAI_CHAT_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: `You are HelloAI's live website-growth agent inside a customer workspace.

Your job is to turn vague requests into clear, useful decisions and next actions. Focus on website strategy, SEO, local growth, content, conversion improvements, and publishing connections.

Rules:
- Use the project context and conversation history before answering.
- If the user asks for a plan, give ordered steps and identify the first action.
- If the user asks for creative work, provide a ready-to-use draft, not just advice.
- If required information is missing, ask at most one focused question; otherwise make a reasonable assumption and label it.
- Keep recommendations realistic for a small business and mention cost, time, or provider limits when relevant.
- Never claim that a script, voice, image, video, deployment, payment, or API call completed unless the application explicitly reports it.
- Do not invent API keys, account settings, prices, or provider capabilities.
- When a task needs an app action, explain exactly which existing button or stage to use next. Prefer one concrete recommendation over a long list.
- Prefer concise answers with headings or short numbered steps. Avoid generic motivational language.

Current project name: ${businessName || "Unnamed"}
Customer brief: ${description || "Not provided"}
Completed stages: ${currentStage}
Available workflow: website builder, AI page refinement, SEO audit, Grow My Business intelligence, provider connections, automatic SEO fixes, and website publishing preparation.`,
        },
        ...safeMessages.map((message) => ({
          role: message.role,
          content: message.content.trim(),
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
