export const logger = {
  info: (...a: unknown[]) => console.log("[INFO]", ...a),
  error: (...a: unknown[]) => console.error("[ERROR]", ...a),
};
