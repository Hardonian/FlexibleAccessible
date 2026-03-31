export interface WcagChunk {
  id: string;
  text: string;
  metadata: {
    criterionId?: string;
    criterionName?: string;
    level?: "A" | "AA" | "AAA";
    principle?: string;
    techniqueId?: string;
    techniqueType?: "sufficient" | "advisory" | "failure";
    source: string;
    section?: string;
  };
  embedding?: number[];
}

export interface WcagDocument {
  id: string;
  title: string;
  content: string;
  source: string;
  metadata: Record<string, string>;
}

/**
 * Chunks WCAG documentation into semantically meaningful pieces for embedding.
 * Each chunk preserves metadata about its source criterion and technique type.
 */
export function chunkWcagDocument(
  doc: WcagDocument,
  maxChunkSize = 1000,
): WcagChunk[] {
  const chunks: WcagChunk[] = [];

  // Split by sections (## or ### headers)
  const sections = doc.content.split(/(?=^#{2,3}\s)/m);

  for (const section of sections) {
    const lines = section.trim().split("\n");
    if (lines.length === 0) continue;

    const headerLine = lines[0];
    const headerMatch = headerLine.match(/^#+\s+(.+)/);
    const sectionTitle = headerMatch?.[1] ?? "Untitled";
    const body = lines.slice(1).join("\n").trim();

    if (!body) continue;

    // If section is small enough, keep as single chunk
    if (body.length <= maxChunkSize) {
      chunks.push({
        id: `${doc.id}::${slugify(sectionTitle)}`,
        text: `${sectionTitle}\n\n${body}`,
        metadata: {
          criterionId: doc.metadata.criterionId,
          criterionName: doc.metadata.criterionName,
          level: doc.metadata.level as "A" | "AA" | "AAA" | undefined,
          principle: doc.metadata.principle,
          source: doc.source,
          section: sectionTitle,
        },
      });
    } else {
      // Split large sections by paragraphs
      const paragraphs = body.split(/\n\n+/);
      let currentChunk = "";
      let chunkIndex = 0;

      for (const para of paragraphs) {
        if (currentChunk.length + para.length > maxChunkSize && currentChunk) {
          chunks.push({
            id: `${doc.id}::${slugify(sectionTitle)}::${chunkIndex}`,
            text: `${sectionTitle} (part ${chunkIndex + 1})\n\n${currentChunk.trim()}`,
            metadata: {
              criterionId: doc.metadata.criterionId,
              criterionName: doc.metadata.criterionName,
              level: doc.metadata.level as "A" | "AA" | "AAA" | undefined,
              principle: doc.metadata.principle,
              source: doc.source,
              section: sectionTitle,
            },
          });
          currentChunk = "";
          chunkIndex++;
        }
        currentChunk += (currentChunk ? "\n\n" : "") + para;
      }

      if (currentChunk.trim()) {
        chunks.push({
          id: `${doc.id}::${slugify(sectionTitle)}::${chunkIndex}`,
          text: `${sectionTitle}${chunkIndex > 0 ? ` (part ${chunkIndex + 1})` : ""}\n\n${currentChunk.trim()}`,
          metadata: {
            criterionId: doc.metadata.criterionId,
            criterionName: doc.metadata.criterionName,
            level: doc.metadata.level as "A" | "AA" | "AAA" | undefined,
            principle: doc.metadata.principle,
            source: doc.source,
            section: sectionTitle,
          },
        });
      }
    }
  }

  return chunks;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}
