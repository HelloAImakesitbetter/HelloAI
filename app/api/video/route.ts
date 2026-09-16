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

type SceneInput = {
  imageUrl: string;
};

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
    const executablePath = existsSync(localFfmpegPath) ? localFfmpegPath : ffmpegPath;

    if (!executablePath) {
      throw new Error("FFmpeg is not available");
    }

    const { scenes, audioDataUrl } = (await req.json()) as {
      scenes?: SceneInput[];
      audioDataUrl?: string;
    };

    if (!Array.isArray(scenes) || scenes.length !== 3) {
      return Response.json(
        { error: "Exactly three generated scenes are required" },
        { status: 400 }
      );
    }

    if (!audioDataUrl || typeof audioDataUrl !== "string") {
      return Response.json(
        { error: "A generated voiceover is required" },
        { status: 400 }
      );
    }

    workingDirectory = await mkdtemp(path.join(tmpdir(), "business-video-"));

    const imagePaths = await Promise.all(
      scenes.map(async (scene, index) => {
        const imagePath = path.join(workingDirectory, `scene-${index}.png`);
        await writeFile(imagePath, decodeDataUrl(scene.imageUrl));
        return imagePath;
      })
    );
    const audioPath = path.join(workingDirectory, "voiceover.mp3");
    const outputPath = path.join(workingDirectory, "business-video.mp4");

    await writeFile(audioPath, decodeDataUrl(audioDataUrl));

    const inputArguments = imagePaths.flatMap((imagePath) => [
      "-loop",
      "1",
      "-t",
      "20",
      "-i",
      imagePath,
    ]);
    const filter =
      "[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v0];" +
      "[1:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v1];" +
      "[2:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v2];" +
      "[v0][v1][v2]concat=n=3:v=1:a=0[v]";

    await execFileAsync(executablePath, [
      "-y",
      ...inputArguments,
      "-i",
      audioPath,
      "-filter_complex",
      filter,
      "-map",
      "[v]",
      "-map",
      "3:a",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      outputPath,
    ]);

    const video = await readFile(outputPath);

    return new Response(video, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": "attachment; filename=business-video.mp4",
      },
    });
  } catch (error) {
    console.error("Video creation failed:", error);

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create video",
      },
      { status: 500 }
    );
  } finally {
    if (workingDirectory) {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  }
}