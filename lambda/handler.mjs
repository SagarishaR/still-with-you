import { handleRequest } from "../src/router.mjs";

// ==========================================
// AWS LAMBDA ENTRY POINT
// Works with Lambda Function URLs, which pass
// events in this shape (same as API Gateway v2).
// ==========================================

export const handler = async (event) => {

  const method = event.requestContext?.http?.method || "GET";
  const path = event.rawPath || "/";

  const query = event.queryStringParameters || {};

  let body = {};

  if (event.body) {
    try {
      const rawBody = event.isBase64Encoded
        ? Buffer.from(event.body, "base64").toString("utf-8")
        : event.body;

      body = JSON.parse(rawBody);
    } catch {
      body = {};
    }
  }

  try {
    const result = await handleRequest({ method, path, query, body });

    return {
      statusCode: result.statusCode,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify(result.data),
    };

  } catch (error) {
    console.error("Lambda error:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Internal server error." }),
    };
  }
};
