import "dotenv/config";

import readline from "node:readline";
import { google } from "googleapis";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob"; // mode out-of-band (rapide en local)

const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

async function main() {
  const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  console.log("\n1) Ouvre cette URL et connecte-toi :\n", authUrl, "\n");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question("2) Colle ici le code d'autorisation : ", async (code) => {
    try {
      const { tokens } = await oauth2.getToken(code.trim());
      console.log("\n✅ Tokens reçus.");
      console.log("Access Token :", tokens.access_token);
      console.log("Refresh Token:", tokens.refresh_token);
      console.log("\n➡️ Ajoute ce Refresh Token dans ton .env :");
      console.log("GOOGLE_REFRESH_TOKEN=" + tokens.refresh_token);
    } catch (e: any) {
      console.error("Erreur d'échange de code:", e.message || e);
    } finally {
      rl.close();
    }
  });
}

main().catch(console.error);
