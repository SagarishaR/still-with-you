import { pool } from "../db/db.mjs";
import { hashPassword } from "../auth/authService.mjs";

export async function createUserWithLegacy({
  email,
  displayName,
  password,
}) {
  if (!email || !email.trim()) {
    throw new Error("Email is required.");
  }

  if (!displayName || !displayName.trim()) {
    throw new Error("Display name is required.");
  }

  if (!password || password.length < 8) {
    throw new Error(
      "Password must be at least 8 characters."
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const normalizedEmail =
      email.trim().toLowerCase();

    const passwordHash =
      hashPassword(password);

    // --------------------------------
    // Create user
    // --------------------------------

    const userResult = await client.query(
      `
      INSERT INTO users (
        email,
        display_name,
        password_hash
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        email,
        display_name,
        created_at,
        updated_at;
      `,
      [
        normalizedEmail,
        displayName.trim(),
        passwordHash,
      ]
    );

    const user =
      userResult.rows[0];

    // --------------------------------
    // Create this person's own Legacy.
    // The account owner IS the person
    // being preserved, so the Legacy
    // is named after them.
    // --------------------------------

    const legacyResult = await client.query(
      `
      INSERT INTO legacy_profiles (
        owner_user_id,
        display_name
      )
      VALUES ($1, $2)
      RETURNING
        id,
        owner_user_id,
        display_name,
        created_at;
      `,
      [
        user.id,
        displayName.trim(),
      ]
    );

    const legacy =
      legacyResult.rows[0];

    // --------------------------------
    // Check if someone already invited
    // this email address to a Legacy
    // (e.g. Helen invited her daughter
    // before the daughter had signed up).
    // If so, grant access now.
    // --------------------------------

    const pendingInvitesResult = await client.query(
      `
      SELECT id, legacy_id, relationship_type
      FROM legacy_invites
      WHERE email = $1
        AND status = 'pending';
      `,
      [normalizedEmail]
    );

    for (const invite of pendingInvitesResult.rows) {

      await client.query(
        `
        INSERT INTO authorized_people (
          legacy_id,
          user_id,
          access_level
        )
        VALUES ($1, $2, 'standard')
        ON CONFLICT (legacy_id, user_id) DO NOTHING;
        `,
        [invite.legacy_id, user.id]
      );

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
        [invite.legacy_id, user.id, invite.relationship_type]
      );

      await client.query(
        `
        UPDATE legacy_invites
        SET status = 'accepted', updated_at = now()
        WHERE id = $1;
        `,
        [invite.id]
      );
    }

    await client.query("COMMIT");

    return {
      user,
      legacy,
      grantedAccessCount: pendingInvitesResult.rows.length,
    };

  } catch (error) {

    await client.query("ROLLBACK");

    throw error;

  } finally {

    client.release();

  }
}
