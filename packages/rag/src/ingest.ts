import { WcagKnowledgeBase } from "./knowledge-base";
import { chunkWcagDocument } from "./chunker";
import { embedAndStore, getStoreStats } from "./vector-store";

async function ingest() {
  console.log("[RAG] Starting WCAG knowledge ingestion...");

  const kb = new WcagKnowledgeBase();
  const docs = kb.getDocuments();

  console.log(`[RAG] Loaded ${docs.length} WCAG criteria documents`);

  let totalChunks = 0;
  for (const doc of docs) {
    const chunks = chunkWcagDocument(doc);
    await embedAndStore(chunks);
    totalChunks += chunks.length;
  }

  const stats = getStoreStats();
  console.log(
    `[RAG] Ingestion complete: ${totalChunks} chunks created, ${stats.totalChunks} total in store`,
  );
}

ingest().catch(console.error);
