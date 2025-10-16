import "dotenv/config";
import http from "node:http";
import { google } from "googleapis";
import { URL } from "node:url";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const PORT = 53682; // loopback port
const REDIRECT_URI = `http://127.0.0.1:${PORT}`; // loopback (Desktop app)
const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

async function main() {
  const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  // 1) Démarre un mini serveur pour capter ?code=...
  const server = http.createServer(async (req, res) => {
    try {
      if (!req.url) return;
      const url = new URL(req.url, REDIRECT_URI);
      const code = url.searchParams.get("code");
      if (!code) {
        res.writeHead(400).end("Missing code");
        return;
      }

      // 3) Échange code -> tokens
      const { tokens } = await oauth2.getToken(code);
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("✅ Auth OK. Tu peux fermer cet onglet et revenir au terminal.");

      console.log("\n✅ Tokens reçus.");
      console.log("Access Token :", tokens.access_token);
      console.log("Refresh Token:", tokens.refresh_token);
      console.log("\n➡️ Ajoute dans .env :");
      console.log("GOOGLE_REFRESH_TOKEN=" + tokens.refresh_token);

      server.close();
    } catch (e: any) {
      console.error("Erreur échange de code:", e?.message || e);
      res.writeHead(500).end("Erreur.");
      server.close();
    }
  });

  server.listen(PORT, "127.0.0.1", () => {
    // 2) Génère l’URL d’autorisation (offline pour récupérer un refresh token)
    const authUrl = oauth2.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
    });
    console.log("\n1) Ouvre cette URL, choisis le bon compte et accepte :\n");
    console.log(authUrl + "\n");
    console.log(`2) Après validation, Google te redirige vers ${REDIRECT_URI}`);
  });
}

main().catch((err) => {
  console.error("Erreur script:", err?.message || err);
  process.exit(1);
});
