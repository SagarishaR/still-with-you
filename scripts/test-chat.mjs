import { chatWithLegacy } from "../src/conversation/chatService.mjs";

const result = await chatWithLegacy({
  legacyId: "3f6b28cc-d33c-4e69-b17f-a4c410aee784",
  userId: "23d9a724-cdf7-43c1-8850-bf43a3c712d3",
  message: "I'm feeling worried about an important decision. What advice would she give?",
});

console.log("\nConversation result:");
console.dir(result, { depth: null });
