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

  // 1. Understand the contribution
  const extracted = await extractMemory(content);

  // 2. Store the original contribution + embedding
  const memory = await createMemory({
    legacyId,
    content,
    memoryType: extracted.memoryType,
    source,
    sensitivity,
  });

  // 3. Record trait candidates as evidence
  const traits = [];

  for (const traitCandidate of extracted.traitCandidates) {
    const result = await recordTraitEvidence({
      legacyId,
      memoryId: memory.id,
      trait: traitCandidate,
      category: "behavioral",
    });

    traits.push(result);
  }

  return {
    memory,
    extracted,
    traits,
  };
}
