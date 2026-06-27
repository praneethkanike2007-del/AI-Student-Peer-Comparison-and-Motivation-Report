import "dotenv/config";
import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY?.trim();
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
const placeholders = new Set(["", "sk-your-openai-api-key-here", "your_real_openai_api_key", "your-openai-api-key"]);

if (!apiKey || placeholders.has(apiKey)) {
  console.error("OpenAI check failed: OPENAI_API_KEY is missing or still a placeholder in server/.env");
  process.exit(1);
}

if (apiKey.startsWith("OPENAI_API_KEY")) {
  console.error("OpenAI check failed: the value contains the variable name. In server/.env use exactly:");
  console.error('OPENAI_API_KEY="sk-your-real-key-here"');
  console.error("Do not paste OPENAI_API_KEY inside the quotes.");
  process.exit(1);
}

if (!apiKey.startsWith("sk-")) {
  console.error("OpenAI check failed: OPENAI_API_KEY should normally start with sk-");
  process.exit(1);
}

const client = new OpenAI({ apiKey });

try {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "Reply with exactly: OpenAI connected" },
      { role: "user", content: "Connection test" }
    ],
    temperature: 0,
    max_tokens: 20
  });
  console.log(`OpenAI check passed using model ${model}: ${response.choices[0]?.message?.content?.trim()}`);
} catch (error) {
  console.error("OpenAI check failed:");
  console.error(error?.message || error);
  process.exit(1);
}
