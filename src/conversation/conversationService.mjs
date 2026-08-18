import { pool } from "../db/db.mjs";

export async function createConversation({
  legacyId,
  userId,
}) {
  if (!legacyId) {
    throw new Error("legacyId is required.");
  }

  if (!userId) {
    throw new Error("userId is required.");
  }

  const result = await pool.query(
    `
    INSERT INTO conversations (
      legacy_id,
      user_id
    )
    VALUES ($1, $2)
    RETURNING
      id,
      legacy_id,
      user_id,
      created_at,
      updated_at;
    `,
    [legacyId, userId]
  );

  return result.rows[0];
}


export async function addMessage({
  conversationId,
  role,
  content,
}) {
  if (!conversationId) {
    throw new Error("conversationId is required.");
  }

  if (!role) {
    throw new Error("role is required.");
  }

  if (!content || !content.trim()) {
    throw new Error("content is required.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const messageResult = await client.query(
      `
      INSERT INTO conversation_messages (
        conversation_id,
        "role",
        content
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        conversation_id,
        "role",
        content,
        created_at;
      `,
      [conversationId, role, content.trim()]
    );

    await client.query(
      `
      UPDATE conversations
      SET updated_at = now()
      WHERE id = $1;
      `,
      [conversationId]
    );

    await client.query("COMMIT");

    return messageResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}


export async function getRecentMessages({
  conversationId,
  limit = 20,
}) {
  if (!conversationId) {
    throw new Error("conversationId is required.");
  }

  const result = await pool.query(
    `
    SELECT
      id,
      conversation_id,
      "role",
      content,
      created_at
    FROM conversation_messages
    WHERE conversation_id = $1
    ORDER BY created_at DESC
    LIMIT $2;
    `,
    [conversationId, limit]
  );

  return result.rows.reverse();
}
