import { extractMemory } from "./memoryExtractor.mjs";
import { createMemory } from "./createMemory.mjs";
import { recordTraitEvidence } from "./traitService.mjs";

export async function ingestContribution({
  legacyId,
  content,
  source = "legacy_contribution",
  sensitivity = "normal",
}) {
  if (!legacyId) {
    throw new Error("legacyId is required.");
  }

  if (!content || !content.trim()) {
    throw new Error("Contribution is required.");
  }

  // Step 1: Understand the contribution
  const extracted = await extractMemory(content);

  // Step 2: Store the original contribution + embedding
  const memory = await createMemory({
    legacyId,
    content,
    memoryType: extracted.memoryType,
    source,
    sensitivity,
  });

  // Step 3: Convert extracted traits into persistent evidence
  const traitResults = [];

  for (const trait of extracted.traitCandidates ?? []) {
    const result = await recordTraitEvidence({
      legacyId,
      memoryId: memory.id,
      trait,
      category: "behavioral",
    });

    traitResults.push(result);
  }

  return {
    memory,
    extracted,
    traits: traitResults,
  };
}
