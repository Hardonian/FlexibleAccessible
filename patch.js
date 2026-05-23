const fs = require('fs');
const content = fs.readFileSync('packages/agents/src/visual-reviewer.ts', 'utf-8');

const search = `      // Process screen reader findings (missing landmarks)
      for (const landmark of screenReaderResult.missing_landmarks) {
        await prisma.aiVisualFinding.create({
          data: {
            reviewRunId,
            siteId,
            pageId,
            criterionId: "1.3.1",
            criterionName: "Info and Relationships",
            level: "A",
            status: "fail",
            confidence: 0.85,
            severity: "moderate",
            description: \`Missing \${landmark} landmark region\`,
            source: "screen_reader",
            action: "auto_create",
            metadata: { landmark },
          },
        });
        findingsCreated++;
        highConfidence++;
      }`;

const replace = `      // Process screen reader findings (missing landmarks)
      if (screenReaderResult.missing_landmarks && screenReaderResult.missing_landmarks.length > 0) {
        const landmarkFindings = screenReaderResult.missing_landmarks.map((landmark) => ({
          reviewRunId,
          siteId,
          pageId,
          criterionId: "1.3.1",
          criterionName: "Info and Relationships",
          level: "A",
          status: "fail",
          confidence: 0.85,
          severity: "moderate",
          description: \`Missing \${landmark} landmark region\`,
          source: "screen_reader",
          action: "auto_create",
          metadata: { landmark },
        }));

        await prisma.aiVisualFinding.createMany({
          data: landmarkFindings,
        });

        const count = screenReaderResult.missing_landmarks.length;
        findingsCreated += count;
        highConfidence += count;
      }`;

if (content.includes(search)) {
  fs.writeFileSync('packages/agents/src/visual-reviewer.ts', content.replace(search, replace));
  console.log("Successfully replaced.");
} else {
  console.log("Search string not found!");
}
