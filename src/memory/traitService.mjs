import { pool } from "../db/db.mjs";

export async function recordTraitEvidence({
  legacyId,
  memoryId,
  trait,
  category = "behavioral",
}) {
  if (!legacyId) {
    throw new Error("legacyId is required.");
  }

  if (!memoryId) {
    throw new Error("memoryId is required.");
  }

  if (!trait || !trait.trim()) {
    throw new Error("Trait is required.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Find an existing trait belonging to this Legacy.
    const existingTrait = await client.query(
      `
      SELECT id, evidence_count
      FROM derived_traits
      WHERE legacy_id = $1
        AND trait = $2
      LIMIT 1
      FOR UPDATE;
      `,
      [legacyId, trait.trim()]
    );

    let traitId;
    let evidenceCount;

    if (existingTrait.rows.length === 0) {
      // First evidence for this trait.
      const traitResult = await client.query(
        `
        INSERT INTO derived_traits (
          legacy_id,
          trait,
          category,
          confidence,
          evidence_count
        )
        VALUES ($1, $2, $3, 0.4000, 0)
        RETURNING id, evidence_count;
        `,
        [legacyId, trait.trim(), category]
      );

      traitId = traitResult.rows[0].id;
      evidenceCount = traitResult.rows[0].evidence_count;
    } else {
      traitId = existingTrait.rows[0].id;
      evidenceCount = existingTrait.rows[0].evidence_count;
    }

    // Add this memory as evidence.
    const evidenceResult = await client.query(
      `
      INSERT INTO trait_evidence (
        trait_id,
        memory_id
      )
      VALUES ($1, $2)
      ON CONFLICT (trait_id, memory_id) DO NOTHING
      RETURNING id;
      `,
      [traitId, memoryId]
    );

    // Only strengthen the trait if this memory is new evidence.
    if (evidenceResult.rows.length > 0) {
      const newEvidenceCount = Number(evidenceCount) + 1;

      // Confidence grows with repeated evidence,
      // but never reaches absolute certainty.
      const newConfidence = Math.min(
        0.95,
        0.4 + newEvidenceCount * 0.1
      );

      const updatedTrait = await client.query(
        `
        UPDATE derived_traits
        SET
          evidence_count = $1,
          confidence = $2,
          updated_at = now()
        WHERE id = $3
        RETURNING
          id,
          legacy_id,
          trait,
          category,
          confidence,
          evidence_count,
          created_at,
          updated_at;
        `,
        [newEvidenceCount, newConfidence, traitId]
      );

      await client.query("COMMIT");

      return {
        trait: updatedTrait.rows[0],
        evidenceAdded: true,
      };
    }

    await client.query("COMMIT");

    const unchangedTrait = await client.query(
      `
      SELECT
        id,
        legacy_id,
        trait,
        category,
        confidence,
        evidence_count,
        created_at,
        updated_at
      FROM derived_traits
      WHERE id = $1;
      `,
      [traitId]
    );

    return {
      trait: unchangedTrait.rows[0],
      evidenceAdded: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
