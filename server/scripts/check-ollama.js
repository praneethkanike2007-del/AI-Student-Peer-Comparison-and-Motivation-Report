import "dotenv/config";

const baseUrl = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");
const model = process.env.OLLAMA_MODEL || "llama3.2:3b";

try {
  const tagsResponse = await fetch(`${baseUrl}/api/tags`);
  if (!tagsResponse.ok) throw new Error(`Ollama tags endpoint returned ${tagsResponse.status}`);
  const tags = await tagsResponse.json();
  const models = tags.models?.map((item) => item.name) || [];
  if (!models.includes(model)) {
    console.error(`Ollama is running, but model "${model}" is not installed.`);
    console.error(`Installed models: ${models.length ? models.join(", ") : "none"}`);
    console.error(`Run: ollama pull ${model}`);
    process.exit(1);
  }

  const chatResponse = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: "user", content: "Reply exactly: Ollama connected" }]
    })
  });
  if (!chatResponse.ok) throw new Error(`Ollama chat endpoint returned ${chatResponse.status}`);
  const data = await chatResponse.json();
  console.log(`Ollama check passed using model ${model}: ${data.message?.content?.trim()}`);
} catch (error) {
  console.error("Ollama check failed:");
  console.error(error?.message || error);
  console.error("Install Ollama from https://ollama.com, then run:");
  console.error(`ollama pull ${model}`);
  process.exit(1);
}
