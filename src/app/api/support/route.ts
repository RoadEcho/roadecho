import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid messages payload" }, { status: 400 });
    }

    const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;
    if (!vectorStoreId) {
      return NextResponse.json({ error: "Vector store ID not configured" }, { status: 500 });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are the official 24/7 AI support assistant for RoadEcho. Answer customer inquiries strictly using the uploaded platform documentation (DPPA compliance, zero-knowledge SHA-256 hashing, Section 230 safe harbor, vault pricing, and GDPR rights). Maintain a professional, concise, and helpful tone.",
        },
        ...messages,
      ],
      tools: [
        {
          type: "file_search" as any,
          vector_store_ids: [vectorStoreId],
        } as any,
      ],
    });

    const reply = response.choices[0].message.content;

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("Support Assistant API Error:", error);
    return NextResponse.json(
      { error: "Failed to generate support response." },
      { status: 500 }
    );
  }
}
