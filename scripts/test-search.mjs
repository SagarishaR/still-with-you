import { searchMemories } from "../src/memory/searchMemories.mjs";

const legacyId = "3f6b28cc-d33c-4e69-b17f-a4c410aee784";

const results = await searchMemories({
  legacyId,
  queryText:
    "What advice did she give when someone was worried about making an important decision?",
  limit: 5,
});

console.log("\nSemantic search results:");
console.dir(results, { depth: null });
