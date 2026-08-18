import crypto from "node:crypto";
import { pool } from "../db/db.mjs";

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");

  const hash = crypto.scryptSync(
    password,
    salt,
    64
  ).toString("hex");

  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) {
    return false;
  }

  const [salt, originalHash] = storedHash.split(":");

  const hash = crypto.scryptSync(
    password,
    salt,
    64
  ).toString("hex");

  const actual = Buffer.from(hash, "hex");
  const expected = Buffer.from(originalHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    actual,
    expected
  );
}

export async function signup({
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

  const normalizedEmail =
    email.trim().toLowerCase();

  const existingUser = await pool.query(
    `
    SELECT id
    FROM users
    WHERE email = $1
    LIMIT 1;
    `,
    [normalizedEmail]
  );

  if (existingUser.rows.length > 0) {
    throw new Error(
      "An account with this email already exists."
    );
  }

  const passwordHash =
    hashPassword(password);

  const result = await pool.query(
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

  return result.rows[0];
}

export async function login({
  email,
  password,
}) {
  if (!email || !email.trim()) {
    throw new Error("Email is required.");
  }

  if (!password) {
    throw new Error("Password is required.");
  }

  const normalizedEmail =
    email.trim().toLowerCase();

  const result = await pool.query(
    `
    SELECT
      id,
      email,
      display_name,
      password_hash,
      created_at,
      updated_at
    FROM users
    WHERE email = $1
    LIMIT 1;
    `,
    [normalizedEmail]
  );

  if (result.rows.length === 0) {
    throw new Error(
      "Invalid email or password."
    );
  }

  const user = result.rows[0];

  if (!user.password_hash) {
    throw new Error(
      "This account does not have a password yet."
    );
  }

  const passwordMatches =
    verifyPassword(
      password,
      user.password_hash
    );

  if (!passwordMatches) {
    throw new Error(
      "Invalid email or password."
    );
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}
