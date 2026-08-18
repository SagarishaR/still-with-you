
import { ingestContribution } from "../src/memory/ingestContribution.mjs";

const legacyId = "3f6b28cc-d33c-4e69-b17f-a4c410aee784";

const result = await ingestContribution({
  legacyId,
  content:
    "Whenever someone in the family felt worried about an important decision, she would tell them to slow down, think carefully, and choose what felt right rather than making a decision out of fear.",
  source: "demo_contribution",
  sensitivity: "normal",
});

console.log("\nMemory ingestion result:");
console.dir(result, { depth: null });
