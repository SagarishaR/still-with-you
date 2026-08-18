import { generateLegacyResponse } from "../src/agent/legacyAgent.mjs";

const result = await generateLegacyResponse({
  legacyId: "3f6b28cc-d33c-4e69-b17f-a4c410aee784",
  userId: "23d9a724-cdf7-43c1-8850-bf43a3c712d3",
  queryText:
    "I'm really worried about an important decision. What would you tell me?",
});

console.log("\nLegacy Agent response:\n");
console.log(result.response);

console.log("\nMemories supplied to the agent:");
console.dir(result.context.memories, { depth: null });

console.log("\nTraits supplied to the agent:");
console.dir(result.context.traits, { depth: null });
