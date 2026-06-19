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
  // Testimonial — REALISTIC camera-roll photo (Realistic AI Image Guide, format C).
  "testimonial-mei": {
    size: "1024x1024",
    quality: "medium",
    prompt:
      "subject: Mei, a warm Asian-American mom in her early 30s, natural skin texture with visible pores, " +
      "a few flyaway hairs, tired-but-happy genuine half-smile, no makeup\n" +
      "scene: her lived-in living room at home on an ordinary afternoon\n" +
      "action: sitting on the couch mid-laugh, one arm around her small kid who is leaning into her\n" +
      "environment: messy real living room, kids' toys on the floor, a bunched-up throw blanket, a coffee " +
      "mug on the side table, a charger cable, a couple of board books, a houseplant in the corner\n" +
      "wardrobe/props: casual oversized oatmeal knit sweater, small stud earrings, hair in a loose messy bun\n" +
      "camera style: candid iPhone photo taken by a friend\n" +
      "photo quality and vibe: non-studio lighting, warm daylight through a window, imperfect phone quality, " +
      "slight compression noise, imperfect focus, natural skin texture, raw casual camera-roll snapshot\n" +
      "composition: slightly awkward framing, subject off-center, slight tilt, a cushion partly blocking one " +
      "corner, casual unposed snapshot\n" +
      "aspect ratio: 1:1\n" +
      "Avoid: studio lighting, flawless skin, airbrushed face, glossy AI look, oversharpening, perfect " +
      "symmetry, editorial pose, fake bokeh, perfect hands, extra fingers, distorted hands, excessive yellow.",
  },
  // Footer scene — ULTRA-WIDE short banner so it sits full-bleed AND low without cropping.
  // size:"auto" lets gpt-image-2 pick the aspect ratio requested in the prompt.
  // Footer BACKGROUND only — no signpost, no text (the signpost is drawn in CSS over this).
  // Designed with a generous safe area so it can be cropped to any height without losing anything.
  "footer-bg": {
    size: "1536x512", // 3:1 — widest gpt-image-2 allows; we crop it freely with object-cover
    quality: "medium",
    prompt:
      "A wide thin panoramic storybook LANDSCAPE illustration (3:1), made to be used as a website footer " +
      "background that gets cropped to different heights — so the scene must look good even if the top and " +
      "bottom edges are cropped (a generous safe area, with the horizon around the vertical middle). " +
      "Soft golden sunrise over gentle rolling green hills; a winding dirt path leading toward the warm " +
      "rising sun near the center; a few soft trees on the left, leafy bushes and shrubs on the right; a " +
      "low row of wildflowers along the bottom; soft hazy pale sky in the upper area. Keep the LEFT THIRD " +
      "calmer and more open (gentle hills and sky) so text can be overlaid there. " +
      "ABSOLUTELY NO text, NO words, NO signpost, NO people, NO animals. " +
      "Warm, gentle hand-drawn editorial storybook illustration with soft paper texture. Calming earthy " +
      "palette: sage greens (#8fb09a), cream (#fbf7f0), terracotta-coral (#e1785c), deep teal (#1e4d4a), " +
      "warm gold sun (#e6b566).",
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
      quality: spec.quality ?? "high",
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
