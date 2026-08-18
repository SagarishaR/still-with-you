import { pool } from "../db/db.mjs";

export async function saveMemory({
  legacyId,
  content,
  memoryType,
  source = "lyla",
  occurredAt = null,
  sensitivity = "normal",
}) {
  const query = `
    INSERT INTO memories (
      legacy_id,
      content,
      memory_type,
      source,
      occurred_at,
      sensitivity
    )
    VALUES ($1, $2, $3, $4, $5, $6)
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
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}


// ==========================================
// GET A FEATURED MEMORY
// Pulls one real preserved memory to surface
// on the conversation screen — never invents
// anything, only shows what was actually saved.
// Excludes sensitive memories from this
// lightweight, ambient display.
// ==========================================

export async function getFeaturedMemory({ legacyId }) {
  if (!legacyId) {
    throw new Error("legacyId is required.");
  }

  const result = await pool.query(
    `
    SELECT content, memory_type, created_at
    FROM memories
    WHERE legacy_id = $1
      AND sensitivity = 'normal'
    ORDER BY random()
    LIMIT 1;
    `,
    [legacyId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}
