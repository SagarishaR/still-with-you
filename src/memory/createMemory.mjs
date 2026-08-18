import { pool } from "../db/db.mjs";
import { generateEmbedding } from "./embeddingService.mjs";

export async function createMemory({
  legacyId,
  content,
  memoryType,
  source,
  occurredAt = null,
  sensitivity = "normal",
}) {
  if (!legacyId) {
    throw new Error("legacyId is required.");
  }

  if (!content || !content.trim()) {
    throw new Error("Memory content is required.");
  }

  if (!memoryType) {
    throw new Error("memoryType is required.");
  }

  if (!source) {
    throw new Error("Memory source is required.");
  }

  // 1. Generate semantic embedding
  const embedding = await generateEmbedding(content);

  // 2. Store original memory + embedding
  const query = `
    INSERT INTO memories (
      legacy_id,
      content,
      memory_type,
      source,
      occurred_at,
      sensitivity,
      embedding
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING
      id,
      legacy_id,
      content,
      memory_type,
      source,
      occurred_at,
      recorded_at,
      sensitivity,
      created_at;
  `;

  const values = [
    legacyId,
    content,
    memoryType,
    source,
    occurredAt,
    sensitivity,
    `[${embedding.join(",")}]`,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}
