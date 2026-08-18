import { assembleLegacyContext } from "../src/agent/contextAssembler.mjs";

const result = await assembleLegacyContext({
  legacyId: "3f6b28cc-d33c-4e69-b17f-a4c410aee784",
  userId: "23d9a724-cdf7-43c1-8850-bf43a3c712d3",
  queryText:
    "What would she say if I was worried about making an important decision?",
});

console.dir(result, { depth: null });
