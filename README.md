<div align="center">

# Still With You

### AI-Powered Digital Legacy & Memory Preservation Platform

![Node.js](https://img.shields.io/badge/NODE.JS-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![CockroachDB](https://img.shields.io/badge/COCKROACHDB-6933FF?style=for-the-badge&logo=cockroachlabs&logoColor=white)
![AWS Lambda](https://img.shields.io/badge/AWS%20LAMBDA-FF9900?style=for-the-badge&logo=awslambda&logoColor=white)
![AWS Amplify](https://img.shields.io/badge/AWS%20AMPLIFY-FF9900?style=for-the-badge&logo=awsamplify&logoColor=white)
![Groq](https://img.shields.io/badge/GROQ-F55036?style=for-the-badge&logoColor=white)

![Distributed Vector Indexing](https://img.shields.io/badge/DISTRIBUTED%20VECTOR%20INDEXING-2FA84F?style=for-the-badge)
![Managed MCP Server](https://img.shields.io/badge/MANAGED%20MCP%20SERVER-E8813A?style=for-the-badge)

**License: MIT** · Built for the **CockroachDB × AWS Hackathon — Build with Agentic Memory**

</div>

---

> **What if the memories, stories, values, and advice someone shared with you could remain accessible — not as a generic chatbot, but as a private, memory-grounded space built from what they actually left behind?**

## Submission Link

| | |
|---|---|
| 🌐 Live demo | **[staging.d12jw6rtkbuyc8.amplifyapp.com](https://staging.d12jw6rtkbuyc8.amplifyapp.com)** |

---

## The Problem

When someone we love is no longer around, what disappears isn't just their presence — it's the small things: the stories they told, their advice, the phrases they used, the way they comforted people. Cloud storage preserves files. Chatbots generate conversation. Neither does **persistent, permission-aware personal memory**.

**Still With You preserves the memories first, and lets AI communicate around them second.** The agent never invents a person's life — it's grounded only in what was actually recorded.

## The Solution

A person creates a private **Legacy Space** for themselves, shares real memories about their own life, and invites trusted people by email. Those people sign up on their own account and can then talk *to* the preserved legacy — with responses grounded in real, retrieved memory, not general AI knowledge.

```
Human memories → Persistent memory (CockroachDB) → Semantic retrieval → AI conversation → Grounded response
```

## Features

- **Legacy Space** — a dedicated, private space for one preserved person
- **Memory preservation** — stories, values, advice, and everyday moments stored as persistent data, not chat history
- **Semantic retrieval** — a question doesn't need the exact words a memory used; CockroachDB's vector search finds what's *meant*, not just what's typed
- **Family access** — the owner invites people by email + relationship; access is granted automatically the moment that person signs up
- **Relationship-aware** — the interface reflects each visitor's actual relationship to the legacy (daughter, son, spouse, etc.)
- **Owner vs. member separation** — the owner privately contributes memories; members converse with the legacy — two distinct modes on one shared memory layer

---

## CockroachDB Tools Used *(2 required)*

| Tool | How it's used |
|---|---|
| **Distributed Vector Indexing** | Runtime — every memory is stored as a `VECTOR(768)` embedding with a real vector index. When someone asks a question, the app searches this index for semantically related memories before generating a response. This is the actual retrieval mechanism, not a demo feature. |
| **Cloud Managed MCP Server** | Development-time — we connected Cline (an AI dev agent in VS Code) to our live cluster via `https://cockroachlabs.cloud/mcp`, authenticated by OAuth, read-only. Used to inspect the live schema, confirm the vector index was configured correctly, and verify memory data was actually persisting as the app ran. |

**Runtime retrieval flow:**
```
User question → embedding → CockroachDB vector search → relevant memories → AI response
```

**Development-time MCP flow:**
```
Cline (AI agent) → MCP → CockroachDB Cloud cluster → schema / data verification
```

---

## AWS Services Used

| Service | How it's used |
|---|---|
| **AWS Lambda** | Runs the entire backend — auth, memory capture, chat, family access — as a serverless function, called by the frontend via a public Function URL. |
| **AWS Amplify** | Hosts the public frontend at the live demo link above. |

---

## Architecture

```
        USER
          │
          ▼
   AWS Amplify (Frontend)
          │
          ▼
    AWS Lambda (Backend)
          │
          ▼
    ┌──────────────────────────────┐
    │  CockroachDB                 │◄──────► Groq (LLM reasoning)
    │  Cloud                       │
    │                              │
    │  users                       │
    │  legacies                    │
    │  memories                    │  ← VECTOR(768) + vector index
    │  access/invites              │
    │  conversations               │
    └──────────────────────────────-
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML / CSS / JavaScript (no framework) |
| Backend | Node.js, AWS Lambda |
| Database | CockroachDB Cloud (relational + vector) |
| LLM | Groq (`openai/gpt-oss-120b`) for responses, Gemini for embeddings |
| Auth | bcrypt password hashing |
| Hosting | AWS Amplify |

---

## Screenshots

**Still With You, live** — the deployed application
![Live Demo](screenshots/live-demo.png)

**CockroachDB Managed MCP Server** — Cline connected to the live cluster
![MCP Server](screenshots/cockroachdb-mcp.png)

**CockroachDB Vector Memory** — the vector column and index powering retrieval
![Vector Memory](screenshots/cockroachdb-vector-memory.png)

---

## Judge Testing Flow

1. Open the [live demo](https://staging.d12jw6rtkbuyc8.amplifyapp.com)
2. Create an account — this becomes your own Legacy
3. Share a couple of memories about yourself in the chat box
4. Sign out, sign back in — ask something related to what you shared, and see it retrieved and reflected in the response
5. The point of the test: that memory is **persistent data in CockroachDB**, not something held only in the browser session

---

## Running Locally

```bash
git clone https://github.com/SagarishaR/still-with-you.git
cd still-with-you
npm install
```

Create `.env.local` (never committed):
```
GROQ_API_KEY=
GEMINI_API_KEY=
DATABASE_URL=
AUTH_SECRET=
```

```bash
node --env-file=.env.local backend/server.mjs      # backend
python3 -m http.server 5500 --directory frontend    # frontend, separate terminal
```

Open `http://localhost:5500`.

---

## Repository Structure

```
still-with-you/
├── backend/          # local dev server
├── lambda/           # AWS Lambda entry point
├── src/               # router, auth, memory, agent, safety logic
├── frontend/            # index.html, style.css, app.js
├── screenshots/           # README images
├── LICENSE
└── README.md
```

---

<div align="center">

**The database remembers. The AI communicates.**

Built for the CockroachDB × AWS Hackathon — Build with Agentic Memory


