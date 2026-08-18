import { pool } from "../db/db.mjs";
import { hashPassword } from "../auth/authService.mjs";

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


// ==========================================
// FIND THE LEGACY A USER CAN ACCESS
// (owner OR authorized family member)
// ==========================================

export async function getLegacyForUser({ userId }) {
  if (!userId) {
    throw new Error("userId is required.");
  }

  const result = await pool.query(
    `
    SELECT
      lp.id,
      lp.owner_user_id,
      lp.display_name,
      lp.created_at,

      CASE
        WHEN lp.owner_user_id = $1 THEN 'owner'
        ELSE ap.access_level
      END AS access_level,

      r.relationship_type

    FROM legacy_profiles lp

    LEFT JOIN authorized_people ap
      ON ap.legacy_id = lp.id
      AND ap.user_id = $1

    LEFT JOIN relationships r
      ON r.legacy_id = lp.id
      AND r.related_user_id = $1

    WHERE
      lp.owner_user_id = $1
      OR ap.user_id = $1

    ORDER BY lp.created_at ASC
    LIMIT 1;
    `,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}


// ==========================================
// ADD A FAMILY MEMBER TO A LEGACY
// Only the Legacy owner may do this.
// If the person already has an account
// (matched by email), we link that existing
// account instead of creating a new one.
// ==========================================

export async function addAuthorizedPerson({
  legacyId,
  ownerUserId,
  displayName,
  email,
  password,
  relationshipType,
  accessLevel = "standard",
}) {
  if (!legacyId) {
    throw new Error("legacyId is required.");
  }

  if (!ownerUserId) {
    throw new Error("ownerUserId is required.");
  }

  if (!email || !email.trim()) {
    throw new Error("Email is required.");
  }

  if (!relationshipType || !relationshipType.trim()) {
    throw new Error("Relationship is required.");
  }

  const normalizedEmail = email.trim().toLowerCase();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Confirm the requester actually owns this Legacy.
    const legacyResult = await client.query(
      `
      SELECT id
      FROM legacy_profiles
      WHERE id = $1
        AND owner_user_id = $2
      LIMIT 1;
      `,
      [legacyId, ownerUserId]
    );

    if (legacyResult.rows.length === 0) {
      throw new Error(
        "Only the Legacy owner can add family members."
      );
    }

    // 2. Find or create the user for this email.
    const existingUserResult = await client.query(
      `
      SELECT id, email, display_name
      FROM users
      WHERE email = $1
      LIMIT 1;
      `,
      [normalizedEmail]
    );

    let user;

    if (existingUserResult.rows.length > 0) {
      // Person already has a Still With You account.
      // Link them — do not touch their password.
      user = existingUserResult.rows[0];

    } else {
      // Brand new person — create their login.
      if (!displayName || !displayName.trim()) {
        throw new Error(
          "Name is required for a new family member."
        );
      }

      if (!password || password.length < 8) {
        throw new Error(
          "Password must be at least 8 characters."
        );
      }

      const passwordHash = hashPassword(password);

      const newUserResult = await client.query(
        `
        INSERT INTO users (
          email,
          display_name,
          password_hash
        )
        VALUES ($1, $2, $3)
        RETURNING id, email, display_name;
        `,
        [normalizedEmail, displayName.trim(), passwordHash]
      );

      user = newUserResult.rows[0];
    }

    // 3. Grant access to the Legacy.
    await client.query(
      `
      INSERT INTO authorized_people (
        legacy_id,
        user_id,
        access_level
      )
      VALUES ($1, $2, $3);
      `,
      [legacyId, user.id, accessLevel]
    );

    // 4. Record the relationship (e.g. "Daughter").
    await client.query(
      `
      INSERT INTO relationships (
        legacy_id,
        related_user_id,
        relationship_type
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (legacy_id, related_user_id)
      DO UPDATE SET
        relationship_type = excluded.relationship_type,
        updated_at = now();
      `,
      [legacyId, user.id, relationshipType.trim()]
    );

    await client.query("COMMIT");

    return {
      user,
      accessLevel,
      relationshipType: relationshipType.trim(),
    };

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;

  } finally {
    client.release();
  }
}


// ==========================================
// LIST EVERYONE WHO CAN ACCESS THIS LEGACY
// (owner + all authorized family members)
// ==========================================

export async function getLegacyMembers({ legacyId }) {
  if (!legacyId) {
    throw new Error("legacyId is required.");
  }

  const result = await pool.query(
    `
    SELECT
      u.id,
      u.email,
      u.display_name,

      CASE
        WHEN lp.owner_user_id = u.id THEN 'owner'
        ELSE ap.access_level
      END AS access_level,

      r.relationship_type,

      COALESCE(ap.created_at, lp.created_at) AS added_at

    FROM legacy_profiles lp

    JOIN users u
      ON u.id = lp.owner_user_id

    LEFT JOIN authorized_people ap
      ON ap.legacy_id = lp.id

    LEFT JOIN relationships r
      ON r.legacy_id = lp.id
      AND r.related_user_id = u.id

    WHERE lp.id = $1

    UNION

    SELECT
      u.id,
      u.email,
      u.display_name,
      ap.access_level,
      r.relationship_type,
      ap.created_at AS added_at

    FROM authorized_people ap

    JOIN users u
      ON u.id = ap.user_id

    LEFT JOIN relationships r
      ON r.legacy_id = ap.legacy_id
      AND r.related_user_id = ap.user_id

    WHERE ap.legacy_id = $1

    ORDER BY added_at ASC;
    `,
    [legacyId]
  );

  return result.rows;
}


// ==========================================
// INVITE SOMEONE TO A LEGACY
// (they don't need an account yet — they
// get linked automatically when they sign up
// with this email)
// ==========================================

export async function createLegacyInvite({
  legacyId,
  ownerUserId,
  email,
  relationshipType,
}) {
  if (!legacyId) {
    throw new Error("legacyId is required.");
  }

  if (!ownerUserId) {
    throw new Error("ownerUserId is required.");
  }

  if (!email || !email.trim()) {
    throw new Error("Email is required.");
  }

  if (!relationshipType || !relationshipType.trim()) {
    throw new Error("Relationship is required.");
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Confirm the requester actually owns this Legacy.
  const legacyResult = await pool.query(
    `
    SELECT id
    FROM legacy_profiles
    WHERE id = $1
      AND owner_user_id = $2
    LIMIT 1;
    `,
    [legacyId, ownerUserId]
  );

  if (legacyResult.rows.length === 0) {
    throw new Error(
      "Only the Legacy owner can invite family members."
    );
  }

  // If this email already has an account,
  // link them right away instead of waiting
  // for a signup that will never happen.
  const existingUserResult = await pool.query(
    `SELECT id FROM users WHERE email = $1 LIMIT 1;`,
    [normalizedEmail]
  );

  if (existingUserResult.rows.length > 0) {
    const existingUserId = existingUserResult.rows[0].id;

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `
        INSERT INTO authorized_people (legacy_id, user_id, access_level)
        VALUES ($1, $2, 'standard')
        ON CONFLICT (legacy_id, user_id) DO NOTHING;
        `,
        [legacyId, existingUserId]
      );

      await client.query(
        `
        INSERT INTO relationships (legacy_id, related_user_id, relationship_type)
        VALUES ($1, $2, $3)
        ON CONFLICT (legacy_id, related_user_id)
        DO UPDATE SET relationship_type = excluded.relationship_type, updated_at = now();
        `,
        [legacyId, existingUserId, relationshipType.trim()]
      );

      await client.query("COMMIT");

    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return { status: "linked_existing_account", email: normalizedEmail };
  }

  // No account yet — store the invite for later.
  await pool.query(
    `
    INSERT INTO legacy_invites (
      legacy_id, email, relationship_type, invited_by
    )
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (legacy_id, email)
    DO UPDATE SET
      relationship_type = excluded.relationship_type,
      status = 'pending',
      updated_at = now();
    `,
    [legacyId, normalizedEmail, relationshipType.trim(), ownerUserId]
  );

  return { status: "invited", email: normalizedEmail };
}


// ==========================================
// LIST PENDING INVITES FOR A LEGACY
// ==========================================

export async function getLegacyInvites({ legacyId }) {
  if (!legacyId) {
    throw new Error("legacyId is required.");
  }

  const result = await pool.query(
    `
    SELECT id, email, relationship_type, status, created_at
    FROM legacy_invites
    WHERE legacy_id = $1
    ORDER BY created_at ASC;
    `,
    [legacyId]
  );

  return result.rows;
}
