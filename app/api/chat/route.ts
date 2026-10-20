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

    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 64_000) return Response.json({ error: "Conversation is too large. Start a new chat and try again." }, { status: 413 });
    const bodyText = await req.text();
    if (bodyText.length > 64_000) return Response.json({ error: "Conversation is too large. Start a new chat and try again." }, { status: 413 });
    const { messages, businessName, description, progress } = JSON.parse(bodyText) as {
      messages?: ChatMessage[];
      businessName?: string;
      description?: string;
      progress?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) {
      return Response.json({ error: "A message is required" }, { status: 400 });
    }

    if (messages.some((message) =>
      !message
      || (message.role !== "user" && message.role !== "assistant")
      || typeof message.content !== "string"
      || !message.content.trim()
      || message.content.length > 10_000
    )) {
      return Response.json({ error: "Messages must contain valid user or assistant text, up to 10,000 characters each" }, { status: 400 });
    }

    const currentStage = (progress || "brief only").slice(0, 240);
    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      model: process.env.HELLOAI_CHAT_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: `You are HelloAI, a capable, thoughtful general-purpose AI assistant in a customer workspace. Help with a broad range of topics: explain concepts, answer questions, brainstorm, write and edit, reason through decisions, plan, and have natural conversation. Do not assume every request is about websites or business.

Use the conversation to understand the user's intent. Answer the question they actually asked, in a natural and useful way. Be appropriately detailed, explain uncertainty honestly, and ask a focused follow-up only when needed. Do not default to a recommendation, sales pitch, workflow button, or website plan.

Rules:
- Treat the customer respectfully and adapt tone and detail to the request.
- When asked how to use HelloAI or its controls, answer from these actual features; do not give generic instructions about unknown menus or pretend to see customer projects. Saved chats are in the “Saved chats” section below the Home chat box. “Save conversation” and “New chat” are in the chat box's bottom bar when a conversation exists. Conversations are not automatically saved. The Website Builder and SEO Engine each have a “Delete / restart project” button in that page's header; deleting requires confirmation and clears that workspace's saved project.
- If the customer asks to delete a project, distinguish between website/SEO workspaces (Website Builder or SEO Engine) and saved conversations (Saved chats → Delete). Give these exact locations, and ask which project only if their meaning is unclear.
- For time-sensitive or unverifiable facts, say when you are uncertain rather than inventing current information.
- Follow safety requirements and do not provide instructions that facilitate harm.
- You may help prepare app work, but do not claim to have used app tools or changed data unless the application reports that action. Website draft generation remains a separate plan-and-approval workflow.

Current project name: ${(businessName || "Unnamed").slice(0, 160)}
Optional business context: ${(description || "Not provided").slice(0, 1600)}
Workspace context: ${currentStage}
Available HelloAI app workflows, when relevant: website builder, AI page refinement, SEO audit, growth intelligence, provider connections, and website publishing preparation.`,
        },
        ...messages.slice(-12).map((message) => ({
          role: message.role,
          content: message.content.trim(),
        })),
      ],
    });

    return Response.json({ reply: response.output_text });
  } catch (error) {
    console.error("Chat assistant failed:", error);

    const invalidJson = error instanceof SyntaxError;
    return Response.json(
      { error: invalidJson ? "Request body must be valid JSON" : error instanceof Error ? error.message : "Failed to answer" },
      { status: invalidJson ? 400 : 500 }
    );
  }
}
