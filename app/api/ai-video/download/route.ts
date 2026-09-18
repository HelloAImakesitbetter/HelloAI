import ffmpegPath from "ffmpeg-static";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);
const localFfmpegPath = path.resolve(process.cwd(), "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");

export async function POST(req: Request) {
  let workingDirectory = "";
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    const { ids } = (await req.json()) as { ids?: string[] };
    if (!apiKey) throw new Error("HEYGEN_API_KEY is not configured");
    if (!Array.isArray(ids) || ids.length === 0) return Response.json({ error: "HeyGen video IDs are required" }, { status: 400 });

    const videos = await Promise.all(ids.map(async (id) => {
      const response = await fetch(`https://api.heygen.com/v3/videos/${encodeURIComponent(id)}`, { headers: { "X-Api-Key": apiKey } });
      const data = await response.json();
      if (!response.ok || !data?.data?.video_url) throw new Error(data?.error?.message || "A HeyGen video is not ready");
      return data.data.video_url as string;
    }));
    const executablePath = existsSync(localFfmpegPath) ? localFfmpegPath : ffmpegPath;
    if (!executablePath) throw new Error("FFmpeg is not available");

    workingDirectory = await mkdtemp(path.join(tmpdir(), "helloai-heygen-"));
    const clipPaths = await Promise.all(videos.map(async (url, index) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("HeyGen video download failed");
      const filePath = path.join(workingDirectory, `character-${index}.mp4`);
      await writeFile(filePath, Buffer.from(await response.arrayBuffer()));
      return filePath;
    }));
    const concatPath = path.join(workingDirectory, "clips.txt");
    await writeFile(concatPath, clipPaths.map((filePath) => `file '${filePath.replace(/\\/g, "/")}'`).join("\n"));
    const outputPath = path.join(workingDirectory, "helloai-multi-character.mp4");
    await execFileAsync(executablePath, ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", outputPath], { maxBuffer: 10 * 1024 * 1024 });

    return new Response(await readFile(outputPath), { headers: { "Content-Type": "video/mp4", "Content-Disposition": "attachment; filename=helloai-multi-character.mp4" } });
  } catch (error) {
    console.error("HeyGen video merge failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to merge HeyGen videos" }, { status: 500 });
  } finally {
    if (workingDirectory) await rm(workingDirectory, { recursive: true, force: true });
  }
}
