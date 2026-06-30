# Compass on Cloud Run.
#
# Buildpacks can't give us yt-dlp + ffmpeg, which Paste & Personalize needs to download a
# pasted TikTok/YouTube clip and hand it to Gemini. So we use an explicit image: Node 20 +
# ffmpeg + a pinned yt-dlp binary, then a standard Next.js build.
#
# Deploy:  gcloud run deploy compass --source . --region us-central1
# (Cloud Run auto-detects this Dockerfile; existing env vars on the service are preserved.)

FROM node:20-bookworm-slim

# yt-dlp (zipapp → needs python3) + ffmpeg for muxing the downloaded video.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 ffmpeg ca-certificates curl \
  && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && apt-get purge -y curl && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for better layer caching.
COPY package.json package-lock.json* ./
RUN npm ci

# Build.
COPY . .
RUN npm run build

ENV NODE_ENV=production
# Cloud Run provides PORT (defaults to 8080); next start honors it.
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "run", "start"]
