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

    // 2. Define clean documentation content for serverless execution
    const termsText = `
      RoadEcho Terms of Service:
      - RoadEcho is a privacy-first cryptographic vehicle messaging platform.
      - We use SHA-256 cryptographic hashing and server-side salts. Raw plate strings are never saved in plain text.
      - Messages pass through automated AI pre-moderation to prevent abuse or harassment.
      - Vault passes, active subscriptions, or secure checkouts unlock received messages.
    `;

    const privacyText = `
      RoadEcho Privacy Policy:
      - Zero-knowledge architecture ensuring sender and receiver anonymity.
      - No physical registration documents, ID uploads, or PII are required to claim an inbox.
      - Inbox access is verified securely via email magic links.
      - Full compliance with DPPA and GDPR data rights.
    `;

    // 3. Write files to the writable Vercel /tmp directory
    const termsTmpPath = path.join("/tmp", "terms.txt");
    const privacyTmpPath = path.join("/tmp", "privacy.txt");

    fs.writeFileSync(termsTmpPath, termsText);
    fs.writeFileSync(privacyTmpPath, privacyText);

    // 4. Upload files to OpenAI
    const termsFile = await openai.files.create({
      file: fs.createReadStream(termsTmpPath),
      purpose: "assistants",
    });

    const privacyFile = await openai.files.create({
      file: fs.createReadStream(privacyTmpPath),
      purpose: "assistants",
    });

    // 5. Attach files to the vector store
    await openai.vectorStores.files.createAndPoll(vectorStore.id, {
      file_id: termsFile.id,
    });

    await openai.vectorStores.files.createAndPoll(vectorStore.id, {
      file_id: privacyFile.id,
    });

    return NextResponse.json({
      success: true,
      vectorStoreId: vectorStore.id,
      message: "Success! Copy the vectorStoreId above and add it to your Vercel Environment Variables as OPENAI_VECTOR_STORE_ID",
    });
  } catch (error: any) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
