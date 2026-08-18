import { pool } from "./db/db.mjs";
import { login } from "./auth/authService.mjs";
import { createUserWithLegacy } from "./legacy/createLegacy.mjs";
import { chatWithLegacy } from "./conversation/chatService.mjs";

import {
  getLegacyForUser,
  addAuthorizedPerson,
  getLegacyMembers,
  createLegacyInvite,
  getLegacyInvites,
} from "./access/accessService.mjs";

import { getFeaturedMemory } from "./memory/memoryService.mjs";

// ==========================================
// SHARED ROUTER
// Takes a normalized request, returns a
// normalized response. Works the same
// whether called from Node's http server
// (local dev) or from AWS Lambda.
// ==========================================

export async function handleRequest({
  method,
  path,
  query,
  body,
}) {

  // ======================================
  // HEALTH
  // ======================================

  if (method === "GET" && path === "/health") {
    return {
      statusCode: 200,
      data: { ok: true, service: "still-with-you" },
    };
  }


  // ======================================
  // SIGNUP
  // ======================================

  if (method === "POST" && path === "/signup") {

    try {
      const { email, displayName, password } = body;

      const result = await createUserWithLegacy({
        email,
        displayName,
        password,
      });

      return {
        statusCode: 201,
        data: {
          success: true,
          user: result.user,
          legacy: result.legacy,
        },
      };

    } catch (error) {
      console.error("Signup error:", error);

      let statusCode = 400;
      const errorMessage = error.message || "";

      if (
        error.code === "23505" ||
        errorMessage.toLowerCase().includes("duplicate") ||
        errorMessage.toLowerCase().includes("unique") ||
        errorMessage.toLowerCase().includes("already exists")
      ) {
        statusCode = 409;
      }

      return {
        statusCode,
        data: { error: errorMessage || "Unable to create account." },
      };
    }
  }


  // ======================================
  // LOGIN
  // ======================================

  if (method === "POST" && path === "/login") {

    try {
      const { email, password } = body;
      const user = await login({ email, password });

      return {
        statusCode: 200,
        data: { success: true, user },
      };

    } catch (error) {
      console.error("Login error:", error);

      return {
        statusCode: 401,
        data: { error: error.message || "Invalid email or password." },
      };
    }
  }


  // ======================================
  // GET USER'S LEGACY
  // ======================================

  if (
    method === "GET" &&
    path === "/legacy"
  ) {

    try {
      const userId = query.userId;

      if (!userId) {
        return { statusCode: 400, data: { error: "userId is required." } };
      }

      const legacy = await getLegacyForUser({ userId });

      if (!legacy) {
        return { statusCode: 404, data: { error: "No Legacy found for this user." } };
      }

      return { statusCode: 200, data: { legacy } };

    } catch (error) {
      console.error("Legacy loading error:", error);
      return { statusCode: 500, data: { error: "Unable to load Legacy." } };
    }
  }


  // ======================================
  // ADD FAMILY MEMBER (direct, existing accounts)
  // ======================================

  if (method === "POST" && path === "/legacy/members") {

    try {
      const {
        legacyId, ownerUserId, displayName,
        email, password, relationshipType, accessLevel,
      } = body;

      const result = await addAuthorizedPerson({
        legacyId, ownerUserId, displayName,
        email, password, relationshipType, accessLevel,
      });

      return {
        statusCode: 201,
        data: {
          success: true,
          user: result.user,
          accessLevel: result.accessLevel,
          relationshipType: result.relationshipType,
        },
      };

    } catch (error) {
      console.error("Add family member error:", error);

      let statusCode = 400;
      const errorMessage = error.message || "";

      if (errorMessage.toLowerCase().includes("only the legacy owner")) statusCode = 403;
      if (error.code === "23505" || errorMessage.toLowerCase().includes("duplicate")) statusCode = 409;

      return { statusCode, data: { error: errorMessage || "Unable to add family member." } };
    }
  }


  // ======================================
  // LIST FAMILY MEMBERS
  // ======================================

  if (method === "GET" && path === "/legacy/members") {

    try {
      const legacyId = query.legacyId;

      if (!legacyId) {
        return { statusCode: 400, data: { error: "legacyId is required." } };
      }

      const members = await getLegacyMembers({ legacyId });
      return { statusCode: 200, data: { members } };

    } catch (error) {
      console.error("List members error:", error);
      return { statusCode: 500, data: { error: "Unable to load family members." } };
    }
  }


  // ======================================
  // CREATE INVITE
  // ======================================

  if (method === "POST" && path === "/legacy/invites") {

    try {
      const { legacyId, ownerUserId, email, relationshipType } = body;

      const result = await createLegacyInvite({
        legacyId, ownerUserId, email, relationshipType,
      });

      return {
        statusCode: 201,
        data: { success: true, status: result.status, email: result.email },
      };

    } catch (error) {
      console.error("Create invite error:", error);

      let statusCode = 400;
      const errorMessage = error.message || "";

      if (errorMessage.toLowerCase().includes("only the legacy owner")) statusCode = 403;

      return { statusCode, data: { error: errorMessage || "Unable to create invite." } };
    }
  }


  // ======================================
  // LIST INVITES
  // ======================================

  if (method === "GET" && path === "/legacy/invites") {

    try {
      const legacyId = query.legacyId;

      if (!legacyId) {
        return { statusCode: 400, data: { error: "legacyId is required." } };
      }

      const invites = await getLegacyInvites({ legacyId });
      return { statusCode: 200, data: { invites } };

    } catch (error) {
      console.error("List invites error:", error);
      return { statusCode: 500, data: { error: "Unable to load invites." } };
    }
  }


  // ======================================
  // FEATURED MEMORY
  // ======================================

  if (method === "GET" && path === "/legacy/highlight") {

    try {
      const legacyId = query.legacyId;

      if (!legacyId) {
        return { statusCode: 400, data: { error: "legacyId is required." } };
      }

      const memory = await getFeaturedMemory({ legacyId });
      return { statusCode: 200, data: { memory } };

    } catch (error) {
      console.error("Featured memory error:", error);
      return { statusCode: 500, data: { error: "Unable to load a memory." } };
    }
  }


  // ======================================
  // CHAT
  // ======================================

  if (method === "POST" && path === "/chat") {

    try {
      const {
        legacyId, userId, conversationId = null, message,
      } = body;

      if (!legacyId) return { statusCode: 400, data: { error: "legacyId is required." } };
      if (!userId) return { statusCode: 400, data: { error: "userId is required." } };
      if (!message || !message.trim()) return { statusCode: 400, data: { error: "message is required." } };

      const result = await chatWithLegacy({
        legacyId, userId, conversationId, message: message.trim(),
      });

      return {
        statusCode: 200,
        data: {
          conversationId: result.conversationId,
          response: result.response,
          userMessage: result.userMessage,
          assistantMessage: result.assistantMessage,
          isOwnerContribution: result.isOwnerContribution,
        },
      };

    } catch (error) {
      console.error("Chat error:", error);
      return { statusCode: 500, data: { error: "Unable to process the conversation." } };
    }
  }


  // ======================================
  // UNKNOWN ROUTE
  // ======================================

  return { statusCode: 404, data: { error: "Route not found." } };
}
