import { pool } from "../db/db.mjs";

import {
  addMessage,
  createConversation,
} from "./conversationService.mjs";

import { generateLegacyResponse } from "../agent/legacyAgent.mjs";
import { ingestContribution } from "../memory/ingestContribution.mjs";

export async function chatWithLegacy({
  legacyId,
  userId,
  conversationId = null,
  message,
}) {
  if (!legacyId) {
    throw new Error("legacyId is required.");
  }

  if (!userId) {
    throw new Error("userId is required.");
  }

  if (!message || !message.trim()) {
    throw new Error("message is required.");
  }

  // --------------------------------------------
  // Figure out who's talking: is this the Legacy
  // owner sharing a memory about themselves, or a
  // family member talking WITH the preserved Legacy?
  // --------------------------------------------

  const legacyResult = await pool.query(
    `SELECT owner_user_id FROM legacy_profiles WHERE id = $1 LIMIT 1;`,
    [legacyId]
  );

  if (legacyResult.rows.length === 0) {
    throw new Error("Legacy not found.");
  }

  const isOwnerContribution =
    legacyResult.rows[0].owner_user_id === userId;

  let activeConversationId = conversationId;

  if (!activeConversationId) {
    const conversation = await createConversation({
      legacyId,
      userId,
    });

    activeConversationId = conversation.id;
  }

  const userMessage = await addMessage({
    conversationId: activeConversationId,
    role: "user",
    content: message.trim(),
  });

  let responseText;

  if (isOwnerContribution) {

    // --------------------------------------------
    // OWNER MODE: this is the person being preserved,
    // sharing something about themselves. There is no
    // "conversation" — we just save it as a memory.
    // --------------------------------------------

    await ingestContribution({
      legacyId,
      content: message.trim(),
      source: "self_contribution",
    });

    responseText =
      "Saved. Thank you for sharing that — it's now part of what will be preserved.";

  } else {

    // --------------------------------------------
    // VISITOR MODE: someone with access is talking
    // WITH the Legacy. The agent responds as them,
    // grounded in what they've preserved.
    // --------------------------------------------

    const agentResult = await generateLegacyResponse({
      legacyId,
      userId,
      queryText: message.trim(),
      conversationId: activeConversationId,
    });

    responseText = agentResult.response;
  }

  const assistantMessage = await addMessage({
    conversationId: activeConversationId,
    role: "assistant",
    content: responseText,
  });

  return {
    conversationId: activeConversationId,
    userMessage,
    assistantMessage,
    response: responseText,
    isOwnerContribution,
  };
}
