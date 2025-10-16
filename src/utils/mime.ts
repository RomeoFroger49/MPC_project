export function buildMimeRaw(
  to: string,
  from: string,
  subject: string,
  text: string
) {
  const message = `To: ${to}
From: ${from}
Subject: ${subject}
MIME-Version: 1.0
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: 7bit

${text}`;
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
