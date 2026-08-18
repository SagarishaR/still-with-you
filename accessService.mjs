import { pool } from "../db/db.mjs";

export async function getLegacyAccess({
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
    SELECT
      lp.id AS legacy_id,
      lp.display_name AS legacy_name,
      lp.owner_user_id,

      CASE
        WHEN lp.owner_user_id = $2 THEN 'owner'
        ELSE ap.access_level
      END AS access_level,

      r.relationship_type

    FROM legacy_profiles lp

    LEFT JOIN authorized_people ap
      ON ap.legacy_id = lp.id
      AND ap.user_id = $2

    LEFT JOIN relationships r
      ON r.legacy_id = lp.id
      AND r.related_user_id = $2

    WHERE lp.id = $1
      AND (
        lp.owner_user_id = $2
        OR ap.user_id IS NOT NULL
      )

    LIMIT 1;
    `,
    [legacyId, userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}
