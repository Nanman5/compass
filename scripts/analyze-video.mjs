/**
 * analyze-video.mjs — analyze a screen recording with Gemini (video-native).
 *
 * Usage:
 *   node scripts/analyze-video.mjs <path-to-video> ["what to look for"]
 *
 * Uploads the video via the Gemini Files API, waits until it's processed, then asks
 * Gemini to describe what happens — useful for debugging UI/voice flows from a recording.
 * Reads GEMINI_API_KEY from the environment or .env.local.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";

function getKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const env = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const m = env.match(/^GEMINI_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  } catch {}
  throw new Error("GEMINI_API_KEY not found (env or .env.local)");
}

const videoPath = process.argv[2];
const userPrompt =
  process.argv[3] ||
  "This is a screen recording of a web app (Compass, a voice onboarding chat). Walk through what happens chronologically. Call out any bug, glitch, error message, frozen/hung state, layout problem, or anything that looks broken or off. Be specific about timestamps and what's on screen.";

if (!videoPath) {
  console.error("Usage: node scripts/analyze-video.mjs <path-to-video> [\"prompt\"]");
  process.exit(1);
}

const MIME = {
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".m4v": "video/x-m4v",
  ".avi": "video/x-msvideo",
};

const key = getKey();
const fileManager = new GoogleAIFileManager(key);
const genAI = new GoogleGenerativeAI(key);
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });

const ext = path.extname(videoPath).toLowerCase();
const mimeType = MIME[ext] || "video/mp4";

console.error(`Uploading ${videoPath} (${mimeType})…`);
const uploaded = await fileManager.uploadFile(videoPath, { mimeType, displayName: path.basename(videoPath) });

let file = await fileManager.getFile(uploaded.file.name);
process.stderr.write("Processing");
while (file.state === FileState.PROCESSING) {
  process.stderr.write(".");
  await new Promise((r) => setTimeout(r, 2000));
  file = await fileManager.getFile(uploaded.file.name);
}
process.stderr.write("\n");

if (file.state === FileState.FAILED) {
  console.error("Gemini failed to process the video.");
  process.exit(1);
}

console.error("Analyzing…\n");
const result = await model.generateContent([
  { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
  { text: userPrompt },
]);

console.log(result.response.text());

// Clean up the uploaded file.
await fileManager.deleteFile(uploaded.file.name).catch(() => {});
