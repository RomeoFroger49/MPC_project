import "dotenv/config";

import express from "express";
import { sendMessageTool } from "./mcp/tools";
import { logger } from "./utils/logger";

const app = express();
app.use(express.json({ limit: "1mb" }));


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

function rpcResult(id: JsonRpcId, result: any): JsonRpcRes {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: any
): JsonRpcRes {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}

// (2) Tolérer CORS/Préflight pour /mcp et /mcp/tools
app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.status(200).json(mcpDiscovery());
});
app.post("/", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.status(200).json({ ok: true, ...mcpDiscovery() });
});
app.head("/", (_req, res) => res.sendStatus(200));
app.options("/", (_req, res) => res.sendStatus(204));

// Endpoints MCP (gardés tels quels)


// Liste des tools
app.get("/mcp/tools", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.status(200).json({
    tools: [{
      name: "send_message",
      description: "Send a message via the specified channel (gmail/whatsapp/teams)",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string", description: "gmail | whatsapp | teams" },
          to: { type: "string", description: "Recipient (email, E.164 phone, or teams id)" },
          content: {
            type: "object",
            properties: {
              subject: { type: "string", description: "Email subject (gmail only)" },
              text: { type: "string", description: "Message body" }
            },
            required: ["text"]
          }
        },
        required: ["channel", "to", "content"]
      }
    }]
  });
});

app.post("/mcp", async (req, res) => {
  const body = req.body as JsonRpcReq | JsonRpcReq[];
  const handle = async (m: JsonRpcReq): Promise<JsonRpcRes> => {
    // garde-fous JSON-RPC de base
    if (!m || m.jsonrpc !== "2.0" || !m.method) {
      return rpcError(m?.id ?? null, -32600, "Invalid Request");
    }

    try {
      switch (m.method) {
        // 1) initialize : annonce capacités serveur
        case "initialize": {
          // Optionnel: lire m.params (ex: client info)
          const result = {
            protocolVersion: "2024-11-05", // valeur indicative
            serverInfo: { name: "Romeo MCP Server", version: "0.1.0" },
            capabilities: {
              tools: { list: true, call: true },
            },
          };
          return rpcResult(m.id ?? null, result);
        }

        // 2) tools/list : on l’implémente à l’étape suivante
        case "tools/list": {
          return rpcResult(m.id ?? null, { tools: TOOLS_LIST });
        }

        // 3) tools/call : on branchera send_message ensuite
        case "tools/call": {
          // attendu: { name: string, arguments: any }
          const { name, arguments: args } = m.params ?? {};
          if (name !== "send_message") {
            return rpcError(m.id ?? null, -32601, `Unknown tool: ${name}`);
          }
          try {
            // appelle ta logique existante
            const result = await sendMessageTool(args); // importe depuis ./mcp/tools
            // renvoie un résultat JSON clair
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

  const isBatch = Array.isArray(body);
  const responses = isBatch
    ? await Promise.all(body.map(handle))
    : await handle(body);
  res.setHeader("Content-Type", "application/json");
  res.status(200).json(responses);
});

app.get(["/favicon.ico", "/favicon.png", "/favicon.svg"], (_req, res) => {
  res.status(204).end(); // No Content
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => logger.info(`MCP server listening on :${PORT}`));
