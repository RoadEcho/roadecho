import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Invalid messages payload" }, { status: 400 });
    }

    const assistantId = process.env.OPENAI_ASSISTANT_ID;
    if (!assistantId) {
      return NextResponse.json({ error: "OpenAI Assistant ID not configured" }, { status: 500 });
    }

    // Get the last user message from the array
    const lastMessage = messages[messages.length - 1].content;

    // 1. Create a thread
    const thread = await openai.beta.threads.create();

    // 2. Add the user's message to the thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: lastMessage,
    });

    // 3. Run the assistant using your Assistant ID (which has the vector store attached)
    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: assistantId,
    });

    if (run.status === "completed") {
      const threadMessages = await openai.beta.threads.messages.list(run.thread_id);
      const assistantMessage = threadMessages.data.find((m) => m.role === "assistant");
      
      const content = assistantMessage?.content[0];
      const reply = content && content.type === "text" ? content.text.value : "No response generated.";

      return NextResponse.json({ reply });
    } else {
      return NextResponse.json({ error: `Run ended with status: ${run.status}` }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Support Assistant API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate support response." },
      { status: 500 }
    );
  }
}
