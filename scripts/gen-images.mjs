/**
 * Generate Compass web illustrations with gpt-image-2.
 * Usage:  node scripts/gen-images.mjs [name1 name2 ...]   (default: all)
 * Reads OPENAI_API_KEY from .env.local. Saves PNGs to public/img/.
 */
import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// load OPENAI_API_KEY from .env.local
const env = await readFile(join(root, ".env.local"), "utf8");
const KEY = env.match(/OPENAI_API_KEY=(.+)/)?.[1]?.trim();
if (!KEY) throw new Error("OPENAI_API_KEY missing in .env.local");

const MODEL = "gpt-image-2";

const STYLE =
  "Warm, gentle hand-drawn editorial storybook illustration. Soft rounded shapes, " +
  "subtle paper/grain texture, soft warm lighting. Calming earthy palette: cream background (#fbf7f0), " +
  "terracotta-coral (#e1785c), sage green (#8fb09a), deep teal (#1e4d4a), warm gold (#e6b566). " +
  "Tasteful, premium, reassuring. No text, no words, no lettering, no logos.";

const IMAGES = {
  "hero-family": {
    size: "1536x1024",
    prompt:
      "A young mother lovingly hugging her two small children (about ages 4 and 6) while " +
      "snuggled together on a cozy couch under a soft knitted blanket. A potted plant beside them, " +
      "a small framed picture and a few tiny stars in the background, a warm mug nearby. " +
      "Peaceful, intimate, joyful family moment. " +
      STYLE,
  },
  "value-guidance": {
    size: "1024x1024",
    prompt:
      "A single open caring hand gently holding a small glowing heart, centered, simple and warm. " +
      STYLE,
  },
  "value-steps": {
    size: "1024x1024",
    prompt:
      "A small friendly checklist clipboard with a few items checked off, a pencil resting on it, simple and warm. " +
      STYLE,
  },
  "value-grow": {
    size: "1024x1024",
    prompt:
      "A small seedling sprouting two leaves growing from warm soil in a little pot, hopeful and gentle. " +
      STYLE,
  },
};

async function gen(name, spec) {
  process.stdout.write(`→ ${name} (${spec.size}) ... `);
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      prompt: spec.prompt,
      size: spec.size,
      quality: "high",
      n: 1,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    console.log("FAILED");
    console.error(JSON.stringify(json, null, 2));
    throw new Error(`API error for ${name}`);
  }
  const item = json.data[0];
  let buf;
  if (item.b64_json) buf = Buffer.from(item.b64_json, "base64");
  else if (item.url) buf = Buffer.from(await (await fetch(item.url)).arrayBuffer());
  else throw new Error("no image data returned");
  const out = join(root, "public/img", `${name}.png`);
  await writeFile(out, buf);
  console.log(`OK (${Math.round(buf.length / 1024)} KB)`);
}

const requested = process.argv.slice(2);
const names = requested.length ? requested : Object.keys(IMAGES);
for (const name of names) {
  if (!IMAGES[name]) {
    console.error(`unknown image: ${name}`);
    continue;
  }
  await gen(name, IMAGES[name]);
}
console.log("done.");
