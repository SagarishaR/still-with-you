import { pool } from "../db/db.mjs";
import { generateEmbedding } from "./embeddingService.mjs";

export async function searchMemories({
  legacyId,
  queryText,
  limit = 5,
}) {
  if (!legacyId) {
    throw new Error("legacyId is required.");
  }

  if (!queryText || !queryText.trim()) {
    throw new Error("queryText is required.");
  }

  const queryEmbedding = await generateEmbedding(queryText);

  const sql = `
    SELECT
      id,
      legacy_id,
      content,
      memory_type,
      source,
      occurred_at,
      sensitivity,
      embedding <=> $2::VECTOR AS distance
    FROM memories
    WHERE legacy_id = $1
    ORDER BY embedding <=> $2::VECTOR
    LIMIT $3;
  `;

  const result = await pool.query(sql, [
    legacyId,
    `[${queryEmbedding.join(",")}]`,
    limit,
  ]);

  return result.rows;
}
