# Dedicated Video Processing Server

**Priority:** Low (future optimization)  
**Created:** 2026-06-11  
**Status:** Open

## Description

Currently the video processing pipeline (Cloud Run worker) downloads raw videos from Firebase Storage, processes them with FFmpeg, and re-uploads to YouTube. This means:

1. **Double bandwidth**: Video is uploaded to Firebase Storage by admin, then downloaded by Cloud Run, then uploaded to YouTube
2. **Cloud Run costs**: Pay per request + compute time for FFmpeg processing
3. **Storage costs**: Firebase Storage holds raw videos temporarily

## Proposed Solution

Set up a dedicated server (~$20/month VPS) that:

1. **Receives videos directly** — admin uploads straight to the server (skip Firebase Storage)
2. **Processes locally** — FFmpeg runs on local disk, no download needed
3. **Uploads to YouTube** — same as current
4. **No persistent storage needed** — delete raw files after processing, final content lives on YouTube

### Benefits
- Eliminates Firebase Storage bandwidth costs
- Eliminates Cloud Run cold starts and per-request costs
- Faster processing (no download step)
- Predictable monthly cost (~$20) vs. variable Cloud Run billing

### Considerations
- Need to handle server uptime/monitoring
- Need a domain + HTTPS for the upload endpoint
- Could use Hetzner, DigitalOcean, or a cheap VPS
- The server could also host the video processing queue

## Current Architecture (to be replaced)
```
Admin → Firebase Storage → Cloud Run (download) → FFmpeg → YouTube
```

## Proposed Architecture
```
Admin → Dedicated Server (local disk) → FFmpeg → YouTube
```

## Related Files
- `cloud-run/src/worker.ts`
- `src/lib/api.ts` (triggerCloudRunProcessing)
- `src/routes/manage/index.tsx` (video upload UI)
