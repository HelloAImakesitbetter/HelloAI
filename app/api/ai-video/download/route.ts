import RunwayML from "@runwayml/sdk";
import ffmpegPath from "ffmpeg-static";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);
const localFfmpegPath = path.resolve(
  process.cwd(),
  "node_modules",
  "ffmpeg-static",
  process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
);

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);

  if (!match) {
    throw new Error("Expected a base64 data URL");
  }

  return Buffer.from(match[1], "base64");
}

export async function POST(req: Request) {
  let workingDirectory = "";

  try {
    const apiKey = process.env.RUNWAYML_API_SECRET;
    const { ids, audioDataUrl } = (await req.json()) as {
      ids?: string[];
      audioDataUrl?: string;
    };

    if (!apiKey) {
      throw new Error("RUNWAYML_API_SECRET is not configured");
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: "Video IDs are required" }, { status: 400 });
    }

    const runway = new RunwayML({ apiKey });
    const tasks = await Promise.all(ids.map((id) => runway.tasks.retrieve(id)));
    const completedTasks = tasks.filter(
      (task): task is Extract<(typeof tasks)[number], { status: "SUCCEEDED" }> =>
        task.status === "SUCCEEDED"
    );

    if (completedTasks.length !== tasks.length || completedTasks.some((task) => !task.output[0])) {
      throw new Error("All Runway videos must be ready before merging");
    }

    const executablePath = existsSync(localFfmpegPath) ? localFfmpegPath : ffmpegPath;

    if (!executablePath) {
      throw new Error("FFmpeg is not available");
    }

    workingDirectory = await mkdtemp(path.join(tmpdir(), "runway-video-"));
    const clipPaths = await Promise.all(
      completedTasks.map(async (task, index) => {
        const content = await fetch(task.output[0]);

        if (!content.ok) {
          throw new Error("Runway video download failed");
        }

        const clipPath = path.join(workingDirectory, `clip-${index}.mp4`);
        await writeFile(clipPath, Buffer.from(await content.arrayBuffer()));
        return clipPath;
      })
    );

    const concatPath = path.join(workingDirectory, "clips.txt");
    await writeFile(
      concatPath,
      clipPaths.map((clipPath) => `file '${clipPath.replace(/\\/g, "/")}'`).join("\n")
    );

    const outputPath = path.join(workingDirectory, "ai-business-video.mp4");
    const ffmpegArguments = [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatPath,
    ];

    if (audioDataUrl) {
      const audioPath = path.join(workingDirectory, "voiceover.mp3");
      await writeFile(audioPath, decodeDataUrl(audioDataUrl));
      ffmpegArguments.push("-i", audioPath, "-map", "0:v", "-map", "1:a", "-shortest");
    }

    ffmpegArguments.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", outputPath);
    await execFileAsync(executablePath, ffmpegArguments);

    const video = await readFile(outputPath);

    return new Response(video, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": "attachment; filename=ai-business-video.mp4",
      },
    });
  } catch (error) {
    console.error("AI video download failed:", error);

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to download AI video",
      },
      { status: 500 }
    );
  } finally {
    if (workingDirectory) {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  }
}
