import { checkBoundary } from "../src/safety/boundaryService.mjs";

const tests = [
  "What advice did she give me when I was worried?",
  "I'm scared about moving abroad for my career.",
  "Did Mom leave the house to me?",
  "Should I take the medicine Mom used?",
];

for (const question of tests) {
  console.log("\nQuestion:", question);
  console.dir(checkBoundary(question), { depth: null });
}
