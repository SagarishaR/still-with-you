import http from "node:http";

import { pool } from "../src/db/db.mjs";

import {
  login,
} from "../src/auth/authService.mjs";

import {
  createUserWithLegacy,
} from "../src/legacy/createLegacy.mjs";

import {
  chatWithLegacy,
} from "../src/conversation/chatService.mjs";

import {
  getLegacyForUser,
  addAuthorizedPerson,
  getLegacyMembers,
  createLegacyInvite,
  getLegacyInvites,
} from "../src/access/accessService.mjs";


const PORT =
  Number(process.env.PORT) || 3000;


// ==========================================
// SEND JSON RESPONSE
// ==========================================

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });

  res.end(JSON.stringify(data));
}


// ==========================================
// READ REQUEST BODY
// ==========================================

async function readBody(req) {
  let body = "";

  for await (const chunk of req) {
    body += chunk;

    if (body.length > 100_000) {
      throw new Error(
        "Request body is too large."
      );
    }
  }

  if (!body.trim()) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new Error(
      "Invalid JSON request body."
    );
  }
}


// ==========================================
// SERVER
// ==========================================

const server = http.createServer(
  async (req, res) => {


    // ======================================
    // HEALTH
    // ======================================

    if (
      req.method === "GET" &&
      req.url === "/health"
    ) {

      return sendJson(
        res,
        200,
        {
          ok: true,
          service: "still-with-you",
        }
      );
    }


    // ======================================
    // SIGNUP
    // ======================================

    if (
      req.method === "POST" &&
      req.url === "/signup"
    ) {

      try {

        const body =
          await readBody(req);

        const {
          email,
          displayName,
          password,
        } = body;


        const result =
          await createUserWithLegacy({
            email,
            displayName,
            password,
          });


        return sendJson(
          res,
          201,
          {
            success: true,

            user: result.user,

            legacy: result.legacy,
          }
        );

      } catch (error) {

        console.error(
          "Signup error:",
          error
        );


        let statusCode = 400;

        const errorMessage =
          error.message || "";


        if (
          error.code === "23505" ||
          errorMessage
            .toLowerCase()
            .includes("duplicate") ||
          errorMessage
            .toLowerCase()
            .includes("unique") ||
          errorMessage
            .toLowerCase()
            .includes("already exists")
        ) {
          statusCode = 409;
        }


        return sendJson(
          res,
          statusCode,
          {
            error:
              errorMessage ||
              "Unable to create account.",
          }
        );
      }
    }


    // ======================================
    // LOGIN
    // ======================================

    if (
      req.method === "POST" &&
      req.url === "/login"
    ) {

      try {

        const body =
          await readBody(req);

        const {
          email,
          password,
        } = body;


        const user =
          await login({
            email,
            password,
          });


        return sendJson(
          res,
          200,
          {
            success: true,
            user,
          }
        );

      } catch (error) {

        console.error(
          "Login error:",
          error
        );


        return sendJson(
          res,
          401,
          {
            error:
              error.message ||
              "Invalid email or password.",
          }
        );
      }
    }


    // ======================================
    // GET USER'S LEGACY
    // (owner OR authorized family member)
    // ======================================

    if (
      req.method === "GET" &&
      req.url.startsWith("/legacy") &&
      !req.url.startsWith("/legacy/members")
    ) {

      try {

        const url =
          new URL(
            req.url,
            `http://${req.headers.host}`
          );


        const userId =
          url.searchParams.get(
            "userId"
          );


        if (!userId) {

          return sendJson(
            res,
            400,
            {
              error:
                "userId is required.",
            }
          );
        }


        const legacy =
          await getLegacyForUser({ userId });


        if (!legacy) {

          return sendJson(
            res,
            404,
            {
              error:
                "No Legacy found for this user.",
            }
          );
        }


        return sendJson(
          res,
          200,
          {
            legacy,
          }
        );

      } catch (error) {

        console.error(
          "Legacy loading error:",
          error
        );


        return sendJson(
          res,
          500,
          {
            error:
              "Unable to load Legacy.",
          }
        );
      }
    }


    // ======================================
    // ADD FAMILY MEMBER
    // ======================================

    if (
      req.method === "POST" &&
      req.url === "/legacy/members"
    ) {

      try {

        const body =
          await readBody(req);

        const {
          legacyId,
          ownerUserId,
          displayName,
          email,
          password,
          relationshipType,
          accessLevel,
        } = body;


        const result =
          await addAuthorizedPerson({
            legacyId,
            ownerUserId,
            displayName,
            email,
            password,
            relationshipType,
            accessLevel,
          });


        return sendJson(
          res,
          201,
          {
            success: true,

            user: result.user,

            accessLevel: result.accessLevel,

            relationshipType: result.relationshipType,
          }
        );

      } catch (error) {

        console.error(
          "Add family member error:",
          error
        );


        let statusCode = 400;

        const errorMessage =
          error.message || "";


        if (
          errorMessage
            .toLowerCase()
            .includes("only the legacy owner")
        ) {
          statusCode = 403;
        }


        if (
          error.code === "23505" ||
          errorMessage
            .toLowerCase()
            .includes("duplicate")
        ) {
          statusCode = 409;
        }


        return sendJson(
          res,
          statusCode,
          {
            error:
              errorMessage ||
              "Unable to add family member.",
          }
        );
      }
    }


    // ======================================
    // LIST FAMILY MEMBERS
    // ======================================

    if (
      req.method === "GET" &&
      req.url.startsWith("/legacy/members")
    ) {

      try {

        const url =
          new URL(
            req.url,
            `http://${req.headers.host}`
          );

        const legacyId =
          url.searchParams.get("legacyId");

        if (!legacyId) {

          return sendJson(
            res,
            400,
            {
              error:
                "legacyId is required.",
            }
          );
        }

        const members =
          await getLegacyMembers({ legacyId });

        return sendJson(
          res,
          200,
          { members }
        );

      } catch (error) {

        console.error(
          "List members error:",
          error
        );

        return sendJson(
          res,
          500,
          {
            error:
              "Unable to load family members.",
          }
        );
      }
    }


    // ======================================
    // CREATE INVITE
    // ======================================

    if (
      req.method === "POST" &&
      req.url === "/legacy/invites"
    ) {

      try {

        const body =
          await readBody(req);

        const {
          legacyId,
          ownerUserId,
          email,
          relationshipType,
        } = body;

        const result =
          await createLegacyInvite({
            legacyId,
            ownerUserId,
            email,
            relationshipType,
          });

        return sendJson(
          res,
          201,
          {
            success: true,
            status: result.status,
            email: result.email,
          }
        );

      } catch (error) {

        console.error(
          "Create invite error:",
          error
        );

        let statusCode = 400;

        const errorMessage =
          error.message || "";

        if (
          errorMessage
            .toLowerCase()
            .includes("only the legacy owner")
        ) {
          statusCode = 403;
        }

        return sendJson(
          res,
          statusCode,
          {
            error:
              errorMessage ||
              "Unable to create invite.",
          }
        );
      }
    }


    // ======================================
    // LIST INVITES
    // ======================================

    if (
      req.method === "GET" &&
      req.url.startsWith("/legacy/invites")
    ) {

      try {

        const url =
          new URL(
            req.url,
            `http://${req.headers.host}`
          );

        const legacyId =
          url.searchParams.get("legacyId");

        if (!legacyId) {

          return sendJson(
            res,
            400,
            {
              error:
                "legacyId is required.",
            }
          );
        }

        const invites =
          await getLegacyInvites({ legacyId });

        return sendJson(
          res,
          200,
          { invites }
        );

      } catch (error) {

        console.error(
          "List invites error:",
          error
        );

        return sendJson(
          res,
          500,
          {
            error:
              "Unable to load invites.",
          }
        );
      }
    }


    // ======================================
    // CHAT
    // ======================================

    if (
      req.method === "POST" &&
      req.url === "/chat"
    ) {

      try {

        const body =
          await readBody(req);


        const {
          legacyId,
          userId,
          conversationId = null,
          message,
        } = body;


        if (!legacyId) {

          return sendJson(
            res,
            400,
            {
              error:
                "legacyId is required.",
            }
          );
        }


        if (!userId) {

          return sendJson(
            res,
            400,
            {
              error:
                "userId is required.",
            }
          );
        }


        if (
          !message ||
          !message.trim()
        ) {

          return sendJson(
            res,
            400,
            {
              error:
                "message is required.",
            }
          );
        }


        const result =
          await chatWithLegacy({
            legacyId,
            userId,
            conversationId,
            message:
              message.trim(),
          });


        return sendJson(
          res,
          200,
          {
            conversationId:
              result.conversationId,

            response:
              result.response,

            userMessage:
              result.userMessage,

            assistantMessage:
              result.assistantMessage,

            isOwnerContribution:
              result.isOwnerContribution,
          }
        );

      } catch (error) {

        console.error(
          "Chat error:",
          error
        );


        return sendJson(
          res,
          500,
          {
            error:
              "Unable to process the conversation.",
          }
        );
      }
    }


    // ======================================
    // UNKNOWN ROUTE
    // ======================================

    return sendJson(
      res,
      404,
      {
        error:
          "Route not found.",
      }
    );
  }
);


// ==========================================
// START SERVER
// ==========================================

server.listen(
  PORT,
  () => {
    console.log(
      `Still With You API running on http://localhost:${PORT}`
    );
  }
);
