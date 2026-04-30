/**
 * Server-side YouTube upload functions using TanStack Start's createServerFn.
 *
 * Uses a single-channel owner model with a long-lived refresh token.
 * The refresh token is stored as YOUTUBE_REFRESH_TOKEN in .env.
 */

import { createServerFn } from "@tanstack/react-start";
import { google, youtube_v3 } from "googleapis";
import fs from "fs";
import path from "path";

// --- YouTube client singleton ---

let youtubeClient: youtube_v3.Youtube | null = null;

function getYouTubeClient(): youtube_v3.Youtube {
  if (youtubeClient) return youtubeClient;

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing YouTube API credentials. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN in .env"
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  youtubeClient = google.youtube({ version: "v3", auth: oauth2Client });
  return youtubeClient;
}

// --- Types ---

interface UploadVideoInput {
  /** Absolute path to the video file on the server */
  filePath: string;
  /** Video title */
  title: string;
  /** Video description */
  description: string;
  /** Privacy: public, unlisted, or private */
  privacyStatus?: "public" | "unlisted" | "private";
  /** Optional tags */
  tags?: string[];
  /** Optional category ID (default 17 = Sports) */
  categoryId?: string;
}

interface UploadVideoResult {
  videoId: string;
  url: string;
}

// --- Server Functions ---

/**
 * Upload a video file to YouTube from the server.
 *
 * This is called server-side after video processing (FFmpeg) is complete.
 * The video file must exist on the server's filesystem.
 */
export const uploadVideoToYouTube = createServerFn({ method: "POST" })
  .inputValidator(
    (data: UploadVideoInput) => data
  )
  .handler(async ({ data }): Promise<UploadVideoResult> => {
    const youtube = getYouTubeClient();

    // Verify the file exists
    if (!fs.existsSync(data.filePath)) {
      throw new Error(`Video file not found: ${data.filePath}`);
    }

    const fileSize = fs.statSync(data.filePath).size;
    console.log(
      `[YouTube] Uploading "${data.title}" (${(fileSize / 1024 / 1024).toFixed(1)} MB)...`
    );

    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: data.title,
          description: data.description,
          tags: data.tags || ["volleyball", "grass volleyball", "highlights"],
          categoryId: data.categoryId || "17", // Sports
        },
        status: {
          privacyStatus: data.privacyStatus || "unlisted",
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: fs.createReadStream(data.filePath),
      },
    });

    const videoId = response.data.id;
    if (!videoId) {
      throw new Error("YouTube upload succeeded but no video ID was returned");
    }

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`[YouTube] ✅ Upload complete: ${url}`);

    return { videoId, url };
  });

/**
 * Check if YouTube credentials are configured.
 * Useful for conditionally showing upload buttons in the UI.
 */
export const checkYouTubeConfigured = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ configured: boolean }> => {
    const hasCredentials = !!(
      process.env.YOUTUBE_CLIENT_ID &&
      process.env.YOUTUBE_CLIENT_SECRET &&
      process.env.YOUTUBE_REFRESH_TOKEN
    );
    return { configured: hasCredentials };
  });
