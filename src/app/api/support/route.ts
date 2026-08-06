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

    const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;
    if (!vectorStoreId) {
      return NextResponse.json({ error: "Vector store ID not configured" }, { status: 500 });
    }

    // Extract the latest user message
    const lastMessage = messages[messages.length - 1].content;

    // Use OpenAI's Responses API with native file search and your vector store
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      instructions: "You are the official 24/7 AI support assistant for RoadEcho. Answer customer inquiries strictly using the uploaded platform documentation (DPPA compliance, zero-knowledge SHA-256 hashing, Section 230 safe harbor, vault pricing, and GDPR rights). Maintain a professional, concise, and helpful tone.",
      input: lastMessage,
      tools: [
        {
          type: "file_search",
          vector_store_ids: [vectorStoreId],
        },
      ],
    });

    const reply = response.output_text || "No response generated.";

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("Support Assistant API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate support response." },
      { status: 500 }
    );
  }
}
