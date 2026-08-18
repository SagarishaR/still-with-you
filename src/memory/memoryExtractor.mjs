import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function extractMemory(contribution) {
  if (!contribution || !contribution.trim()) {
    throw new Error("Contribution is required.");
  }

  const response = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",

    messages: [
      {
        role: "system",
        content: `
You are the memory extraction component of Still With You.

Your job is NOT to rewrite the person's words.
Your job is to understand what information may be meaningful for their
future Legacy and classify it.

Extract only information supported by the contribution.
Never invent facts.
Do not diagnose the person.
Do not turn temporary emotions into permanent personality traits.

Classify the contribution using one of these memory types:
- event
- relationship
- preference
- belief
- habit
- story
- advice
- fact
- emotion
- other

If a date or time is explicitly present, extract it.
If no date or time is present, return null.

Identify possible long-term traits only when the contribution provides
actual evidence for them. These are candidates, not confirmed traits.
        `,
      },
      {
        role: "user",
        content: contribution,
      },
    ],

    response_format: {
      type: "json_schema",
      json_schema: {
        name: "memory_extraction",
        strict: true,
        schema: {
          type: "object",
          properties: {
            memoryType: {
              type: "string",
              enum: [
                "event",
                "relationship",
                "preference",
                "belief",
                "habit",
                "story",
                "advice",
                "fact",
                "emotion",
                "other",
              ],
            },
            occurredAt: {
              type: ["string", "null"],
            },
            importance: {
              type: "string",
              enum: ["low", "medium", "high"],
            },
            emotionalContext: {
              type: "string",
            },
            traitCandidates: {
              type: "array",
              items: {
                type: "string",
              },
            },
          },
          required: [
            "memoryType",
            "occurredAt",
            "importance",
            "emotionalContext",
            "traitCandidates",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  return JSON.parse(response.choices[0].message.content);
}
