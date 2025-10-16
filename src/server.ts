import "dotenv/config";
import express from "express";
import { sendMessageTool } from "./mcp/tools";
import { logger } from "./utils/logger";
import { expressjwt as jwt } from "express-jwt";
import jwksRsa from "jwks-rsa";
import fetch from "node-fetch"; 
import { URL, URLSearchParams } from "url";

const app = express();

const audience = "https://mcp.romeofroger.com";
const issuerBase = "https://dev-ar4cxth8ci8dynsr.us.auth0.com";
const issuer = `${issuerBase}/`;

// --- body parser en premier (important) ---
app.use(express.json({ limit: "1mb" }));

// --- logger simple et non bloquant ---
app.use((req, _res, next) => {
  try {
    const preview =
      req.method === "POST" && req.body
        ? JSON.stringify(req.body).slice(0, 300)
        : "";
    console.log(
      `[REQ] ${req.method} ${req.path} ${preview && "body:"} ${preview}`
    );
  } catch {}
  next();
});

app.use(
  "/mcp",
  jwt({
    secret: jwksRsa.expressJwtSecret({
      cache: true,
      jwksUri: `${issuer}.well-known/jwks.json`,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    }) as any,
    algorithms: ["RS256"],
    audience,
    issuer,
    credentialsRequired: true,
  })
);

// --- Schéma des tools exposés ---
const TOOLS_LIST = [
  {
    name: "send_message",
    description: "Send a message via gmail/whatsapp/teams",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string", description: "gmail | whatsapp | teams" },
        to: { type: "string", description: "email / E.164 / teams id" },
        content: {
          type: "object",
          properties: {
            subject: { type: "string", description: "Gmail only" },
            text: { type: "string", description: "Message body" },
          },
          required: ["text"],
        },
      },
      required: ["channel", "to", "content"],
    },
  },
];

function mcpDiscovery() {
  return {
    name: "Romeo MCP Server",
    description: "Expose messaging and communication tools",
    links: { tools: "/mcp/tools" },
    tools: TOOLS_LIST,
  };
}

// --- JSON-RPC 2.0 types/helpers ---
type JsonRpcId = string | number | null;
type JsonRpcReq = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: any;
};
type JsonRpcRes =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: any }
  | {
      jsonrpc: "2.0";
      id: JsonRpcId;
      error: { code: number; message: string; data?: any };
    };

const rpcResult = (id: JsonRpcId, result: any): JsonRpcRes => ({
  jsonrpc: "2.0",
  id,
  result,
});
const rpcError = (
  id: JsonRpcId,
  code: number,
  message: string,
  data?: any
): JsonRpcRes => ({ jsonrpc: "2.0", id, error: { code, message, data } });

// --- Préflights & HEAD (ne bloquent pas) ---
app.options("/", (_req, res) => res.sendStatus(204));
app.options("/mcp", (_req, res) => res.sendStatus(204));
app.options("/mcp/tools", (_req, res) => res.sendStatus(204));
app.head("/", (_req, res) => res.sendStatus(200));
app.head("/mcp", (_req, res) => res.sendStatus(200));
app.head("/mcp/tools", (_req, res) => res.sendStatus(200));

// --- Découverte (utile pour debug/navigateurs) ---
app.get("/", (_req, res) => {
  res.type("application/json").status(200).json(mcpDiscovery());
});
app.get("/mcp", (_req, res) => {
  res.type("application/json").status(200).json(mcpDiscovery());
});

app.get("/.well-known/oauth-authorization-server", (req, res) => {
  res.json({
    issuer: issuerBase + "/",
    authorization_endpoint: `https://${req.headers.host}/oauth/authorize`,
    token_endpoint: `https://${req.headers.host}/oauth/token`,
  });
});

app.get("/.well-known/openid-configuration", (req, res) => {
  res.json({
    issuer: issuerBase + "/",
    authorization_endpoint: `https://${req.headers.host}/oauth/authorize`,
    token_endpoint: `https://${req.headers.host}/oauth/token`,
    jwks_uri: `${issuerBase}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    grant_types_supported: [
      "authorization_code",
      "client_credentials",
      "refresh_token",
    ],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
  });
});

app.get("/oauth/authorize", (req, res) => {
  const query = new URLSearchParams(req.query as any).toString();
  const url = `${issuerBase}/authorize?${query}`;
  res.redirect(302, url);
});

// --- Liste des tools (GET facultatif) ---
app.get("/mcp/tools", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.status(200).json({ tools: TOOLS_LIST });
});

// --- POINT D’ENTRÉE MCP JSON-RPC ---
app.post("/mcp", async (req, res) => {
  const body = req.body as JsonRpcReq | JsonRpcReq[];

  const handle = async (m: JsonRpcReq): Promise<JsonRpcRes> => {
    if (!m || m.jsonrpc !== "2.0" || !m.method) {
      return rpcError(m?.id ?? null, -32600, "Invalid Request");
    }
    try {
      switch (m.method) {
        case "initialize":
          return rpcResult(m.id ?? null, {
            protocolVersion: "2024-11-05",
            serverInfo: { name: "Romeo MCP Server", version: "0.1.0" },
            capabilities: { tools: { list: true, call: true } },
          });

        case "tools/list":
          return rpcResult(m.id ?? null, { tools: TOOLS_LIST });

        case "tools/call": {
          const { name, arguments: args } = m.params ?? {};
          if (name !== "send_message") {
            return rpcError(m.id ?? null, -32601, `Unknown tool: ${name}`);
          }
          try {
            const result = await sendMessageTool(args);
            return rpcResult(m.id ?? null, { ok: true, result });
          } catch (e: any) {
            return rpcError(m.id ?? null, -32000, "Tool execution failed", {
              message: e?.message,
            });
          }
        }

        default:
          return rpcError(
            m.id ?? null,
            -32601,
            `Method not found: ${m.method}`
          );
      }
    } catch (e: any) {
      return rpcError(m.id ?? null, -32000, "Server error", {
        message: e?.message,
      });
    }
  };

  try {
    const responses = Array.isArray(body)
      ? await Promise.all(body.map(handle))
      : await handle(body);
    res.type("application/json").status(200).json(responses);
  } catch (e: any) {
    res
      .type("application/json")
      .status(200)
      .json(
        rpcError((body as any)?.id ?? null, -32000, "Unhandled server error", {
          message: e?.message,
        })
      );
  }
});

// --- Favicon : éviter les 404 bruitées ---
app.get(["/favicon.ico", "/favicon.png", "/favicon.svg"], (_req, res) =>
  res.status(204).end()
);

app.post(
  "/oauth/token",
  express.urlencoded({ extended: false }),
  async (req, res) => {
    try {
      const body = new URLSearchParams(req.body as any);
      const r = await fetch(`${issuerBase}/oauth/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      } as any);
      const text = await r.text();
      res
        .status(r.status)
        .type(r.headers.get("content-type") || "application/json")
        .send(text);
    } catch (e: any) {
      res.status(502).json({ error: "oauth_proxy_error", details: e?.message });
    }
  }
);

// --- Listen ---
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => logger.info(`MCP server listening on :${PORT}`));
