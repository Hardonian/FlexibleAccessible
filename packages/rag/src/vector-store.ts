import type { WcagChunk } from "./chunker";

export interface SearchResult {
  chunk: WcagChunk;
  score: number;
}

/**
 * In-memory vector store with cosine similarity search.
 * For production, swap with pgvector, Pinecone, or Qdrant.
 */
class InMemoryVectorStore {
  private chunks: WcagChunk[] = [];

  upsert(chunks: WcagChunk[]): void {
    for (const chunk of chunks) {
      const existing = this.chunks.findIndex((c) => c.id === chunk.id);
      if (existing >= 0) {
        this.chunks[existing] = chunk;
      } else {
        this.chunks.push(chunk);
      }
    }
  }

  search(queryEmbedding: number[], topK = 5, threshold = 0.3): SearchResult[] {
    const scored = this.chunks
      .filter((c) => c.embedding && c.embedding.length > 0)
      .map((chunk) => ({
        chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding!),
      }))
      .filter((r) => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored;
  }

  getByCriterion(criterionId: string): WcagChunk[] {
    return this.chunks.filter((c) => c.metadata.criterionId === criterionId);
  }

  getByRuleId(ruleId: string): WcagChunk[] {
    const ruleToWcag: Record<string, string[]> = {
      "image-alt": ["wcag111"],
      "button-name": ["wcag412"],
      "link-name": ["wcag244", "wcag412"],
      label: ["wcag131", "wcag332", "wcag412"],
      "color-contrast": ["wcag143"],
      "heading-order": ["wcag131", "wcag246"],
      "html-has-lang": ["wcag311"],
      "document-title": ["wcag242"],
      region: ["wcag131", "wcag241"],
      "aria-allowed-attr": ["wcag412"],
      "aria-valid-attr": ["wcag412"],
      "aria-valid-attr-value": ["wcag412"],
    };

    const criteria = ruleToWcag[ruleId] ?? [];
    return criteria.flatMap((c) => this.getByCriterion(c));
  }

  size(): number {
    return this.chunks.length;
  }

  clear(): void {
    this.chunks = [];
  }
}

let globalStore: InMemoryVectorStore | null = null;

function getStore(): InMemoryVectorStore {
  if (!globalStore) {
    globalStore = new InMemoryVectorStore();
  }
  return globalStore;
}

/**
 * Generate a simple TF-IDF-style embedding for text.
 * For production, swap with OpenAI text-embedding-3-small or similar.
 */
function simpleEmbed(text: string): number[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/);
  const vocab = new Map<string, number>();
  for (const w of words) {
    vocab.set(w, (vocab.get(w) ?? 0) + 1);
  }
  // Create a fixed-size vector (256 dims) using hash-based positioning
  const dims = 256;
  const vec = new Float64Array(dims);
  for (const [word, count] of vocab) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % dims;
    vec[idx] += Math.log(1 + count);
  }
  // Normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < dims; i++) vec[i] /= norm;
  }
  return Array.from(vec);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

/**
 * Embed chunks and store them in the vector store.
 */
export async function embedAndStore(chunks: WcagChunk[]): Promise<void> {
  const store = getStore();
  for (const chunk of chunks) {
    chunk.embedding = simpleEmbed(chunk.text);
  }
  store.upsert(chunks);
}

/**
 * Search the knowledge base for relevant WCAG documentation.
 */
export function searchKnowledge(
  query: string,
  topK = 5,
  threshold = 0.3,
): SearchResult[] {
  const store = getStore();
  const queryEmbedding = simpleEmbed(query);
  return store.search(queryEmbedding, topK, threshold);
}

/**
 * Get all chunks related to a specific axe-core rule ID.
 */
export function getKnowledgeForRule(ruleId: string): WcagChunk[] {
  const store = getStore();
  return store.getByRuleId(ruleId);
}

/**
 * Get the vector store stats.
 */
export function getStoreStats(): { totalChunks: number } {
  return { totalChunks: getStore().size() };
}
