export async function run(args: string[]) {
  let apiKey = args[0];
  if (!apiKey) {
    apiKey = process.env.AROS_API_KEY ?? "";
    if (!apiKey) {
      console.error("Usage: aros auth <api-key>");
      console.error(
        "Get your API key from https://app.aros.dev/settings/api-keys",
      );
      process.exit(1);
    }
  }

  // Store in ~/.aros/config.json
  const fs = await import("fs");
  const path = await import("path");
  const os = await import("os");

  const configDir = path.join(os.homedir(), ".aros");
  const configFile = path.join(configDir, "config.json");

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(
    configFile,
    JSON.stringify({ apiKey, apiUrl: "https://api.aros.dev" }, null, 2),
  );
  console.log("[AROS] API key saved to ~/.aros/config.json");
  console.log(
    "[AROS] You can now use `aros scan`, `aros fix`, and `aros report`",
  );
}
