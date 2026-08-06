import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET() {
  try {
    // 1. Create the Vector Store
    const vectorStore = await openai.vectorStores.create({
      name: "RoadEcho Support Knowledge Base",
    });

    // 2. Locate your customer-facing documentation files on the server
    const termsPath = path.join(process.cwd(), "src/app/terms/page.tsx");
    const privacyPath = path.join(process.cwd(), "src/app/privacy/page.tsx");

    const fileStreams = [
      fs.createReadStream(termsPath),
      fs.createReadStream(privacyPath),
    ];

    // 3. Upload and poll files for indexing
    const fileBatch = await openai.vectorStores.fileBatches.uploadAndPoll(
      vectorStore.id,
      { files: fileStreams }
    );

    return NextResponse.json({
      success: true,
      vectorStoreId: vectorStore.id,
      status: fileBatch.status,
      fileCounts: fileBatch.file_counts,
      message: "Copy the vectorStoreId above and add it to your Vercel Environment Variables as OPENAI_VECTOR_STORE_ID",
    });
  } catch (error: any) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
