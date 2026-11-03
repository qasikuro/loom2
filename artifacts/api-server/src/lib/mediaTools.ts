// Production builds replace these constants with verified absolute executable
// paths. Source-based tests can still use the normal development PATH.
declare const __MEDIA_FFMPEG_PATH__: string;
declare const __MEDIA_FFPROBE_PATH__: string;

export function mediaToolPath(tool: "ffmpeg" | "ffprobe"): string {
  if (tool === "ffmpeg") {
    return typeof __MEDIA_FFMPEG_PATH__ === "string" ? __MEDIA_FFMPEG_PATH__ : tool;
  }
  return typeof __MEDIA_FFPROBE_PATH__ === "string" ? __MEDIA_FFPROBE_PATH__ : tool;
}
