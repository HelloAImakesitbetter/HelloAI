import RunwayML from "@runwayml/sdk";
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
    const apiKey = process.env.RUNWAYML_API_SECRET;
    const { ids, script } = (await req.json()) as { ids?: string[]; script?: string };
    if (!apiKey) throw new Error("RUNWAYML_API_SECRET is not configured");
    if (!Array.isArray(ids) || !ids[0]) return Response.json({ error: "A Runway task ID is required" }, { status: 400 });
    if (!script?.trim()) return Response.json({ error: "A script is required for the video voiceover" }, { status: 400 });
    const voiceKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
    if (!voiceKey) throw new Error("ELEVENLABS_API_KEY is not configured");
    const executablePath = existsSync(localFfmpegPath) ? localFfmpegPath : ffmpegPath;
    if (!executablePath) throw new Error("FFmpeg is not available");

    const client = new RunwayML({ apiKey });
    const task = await client.tasks.retrieve(ids[0]);
    if (task.status !== "SUCCEEDED" || !task.output[0]) throw new Error("Runway video is not ready");
    const video = await fetch(task.output[0]);
    if (!video.ok) throw new Error("Runway video download failed");
    workingDirectory = await mkdtemp(path.join(tmpdir(), "helloai-cinematic-"));
    const videoPath = path.join(workingDirectory, "silent.mp4");
    const audioPath = path.join(workingDirectory, "voice.mp3");
    const outputPath = path.join(workingDirectory, "helloai-cinematic-video.mp4");
    await writeFile(videoPath, Buffer.from(await video.arrayBuffer()));
    const voiceResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": voiceKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: script, model_id: "eleven_multilingual_v2" }),
    });
    if (!voiceResponse.ok) throw new Error("ElevenLabs voice generation failed");
    await writeFile(audioPath, Buffer.from(await voiceResponse.arrayBuffer()));
    await execFileAsync(executablePath, ["-y", "-i", videoPath, "-i", audioPath, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-shortest", outputPath], { maxBuffer: 10 * 1024 * 1024 });
    return new Response(await readFile(outputPath), { headers: { "Content-Type": "video/mp4", "Content-Disposition": "attachment; filename=helloai-cinematic-video.mp4" } });
  } catch (error) {
    console.error("Runway download failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to download cinematic video" }, { status: 500 });
  } finally {
    if (workingDirectory) await rm(workingDirectory, { recursive: true, force: true });
  }
}
