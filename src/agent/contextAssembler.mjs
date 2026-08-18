import { getLegacyAccess } from "../access/accessService.mjs";
import { searchMemories } from "../memory/searchMemories.mjs";
import { getRecentMessages } from "../conversation/conversationService.mjs";
import { pool } from "../db/db.mjs";

export async function assembleLegacyContext({
  legacyId,
  userId,
  queryText,
  conversationId,
  memoryLimit = 5,
  messageLimit = 20,
}) {
  if (!legacyId) {
    throw new Error("legacyId is required.");
  }

  if (!userId) {
    throw new Error("userId is required.");
  }

  if (!queryText || !queryText.trim()) {
    throw new Error("queryText is required.");
  }

  // 1. Verify that this user can access this Legacy.
  const access = await getLegacyAccess({
    legacyId,
    userId,
  });

  if (!access) {
    throw new Error("User is not authorized to access this Legacy.");
  }

  // 2. Retrieve memories relevant to the current question.
  const memories = await searchMemories({
    legacyId,
    queryText,
    limit: memoryLimit,
  });

  // 3. Retrieve established traits for this Legacy.
  const traitsResult = await pool.query(
    `
    SELECT
      id,
      trait,
      category,
      confidence,
      evidence_count
    FROM derived_traits
    WHERE legacy_id = $1
    ORDER BY confidence DESC, evidence_count DESC
    LIMIT 20;
    `,
    [legacyId]
  );

  // 4. Retrieve recent conversation context.
  let recentMessages = [];

  if (conversationId) {
    recentMessages = await getRecentMessages({
      conversationId,
      limit: messageLimit,
    });
  }

  return {
    legacy: {
      id: access.legacy_id,
      name: access.legacy_name,
      ownerUserId: access.owner_user_id,
    },

    viewer: {
      userId,
      accessLevel: access.access_level,
      relationship: access.relationship_type,
    },

    memories,

    traits: traitsResult.rows,

    recentMessages,
  };
}
