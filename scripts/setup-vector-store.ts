import OpenAI from "openai";
import fs from "fs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function setupKnowledgeBase() {
  try {
    console.log("Creating OpenAI Vector Store...");
    const vectorStore = await openai.vectorStores.create({
      name: "RoadEcho Support Knowledge Base",
    });
    console.log(`Vector Store ID created: ${vectorStore.id}`);

    // Customer-facing documentation files to index
    const filePaths = [
      "./src/app/terms/page.tsx",
      "./src/app/privacy/page.tsx",
    ];

    const fileStreams = filePaths.map((path) => fs.createReadStream(path));

    console.log("Uploading and polling files for vector indexing...");
    const fileBatch = await openai.vectorStores.fileBatches.uploadAndPoll(
      vectorStore.id,
      { files: fileStreams }
    );

    console.log("File batch processing complete!");
    console.log("Status:", fileBatch.status);
    console.log("File counts:", fileBatch.file_counts);
    console.log(`\n👉 Add this variable to your .env.local file:\nOPENAI_VECTOR_STORE_ID=${vectorStore.id}\n`);
  } catch (error) {
    console.error("Error setting up vector store:", error);
  }
}

setupKnowledgeBase();
