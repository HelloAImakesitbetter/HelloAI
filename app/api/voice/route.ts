import ffmpegPath from "ffmpeg-static";
import OpenAI from "openai";
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
const characterVoices = ["alloy", "echo", "fable", "onyx", "nova"] as const;
const speakerNames = ["Maya", "Jordan", "Priya", "Marcus", "Elena"];

type DialogueLine = { speaker: string; text: string };

function parseDialogue(script: string): DialogueLine[] {
  const allowedSpeakers = new Set(speakerNames);

  return script
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(Maya|Jordan|Priya|Marcus|Elena)\s*:\s*(.+)$/i))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({ speaker: match[1], text: match[2].trim() }))
    .filter((line) => allowedSpeakers.has(line.speaker));
}

export async function POST(req: Request) {
  let workingDirectory = "";

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const { script } = (await req.json()) as { script?: string };

    if (!script || typeof script !== "string") {
      return Response.json({ error: "A script is required" }, { status: 400 });
    }

    const dialogue = parseDialogue(script);
    const openai = new OpenAI({ apiKey });

    if (dialogue.length === 0) {
      const speech = await openai.audio.speech.create({
        model: "gpt-4o-mini-tts",
        voice: "alloy",
        input: script,
      });

      return new Response(Buffer.from(await speech.arrayBuffer()), {
        headers: { "Content-Type": "audio/mpeg" },
      });
    }

    const audioFiles = await Promise.all(
      dialogue.map(async (line, index) => {
        const speakerIndex = speakerNames.indexOf(line.speaker);
        const speech = await openai.audio.speech.create({
          model: "gpt-4o-mini-tts",
          voice: characterVoices[speakerIndex >= 0 ? speakerIndex : index % characterVoices.length],
          input: line.text,
        });
        return {
          fileName: `dialogue-${index}.mp3`,
          bytes: Buffer.from(await speech.arrayBuffer()),
        };
      })
    );

    const executablePath = existsSync(localFfmpegPath) ? localFfmpegPath : ffmpegPath;

    if (!executablePath) {
      throw new Error("FFmpeg is not available");
    }

    workingDirectory = await mkdtemp(path.join(tmpdir(), "dialogue-"));
    await Promise.all(
      audioFiles.map(({ fileName, bytes }) =>
        writeFile(path.join(workingDirectory, fileName), bytes)
      )
    );
    const concatFile = path.join(workingDirectory, "dialogue.txt");
    await writeFile(
      concatFile,
      audioFiles.map(({ fileName }) => `file '${fileName}'`).join("\n")
    );
    const outputPath = path.join(workingDirectory, "dialogue.mp3");

    await execFileAsync(
      executablePath,
      ["-y", "-f", "concat", "-safe", "0", "-i", concatFile, "-c", "copy", outputPath],
      { cwd: workingDirectory }
    );

    return new Response(await readFile(outputPath), {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (error) {
    console.error("Voice generation failed:", error);

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate dialogue",
      },
      { status: 500 }
    );
  } finally {
    if (workingDirectory) {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  }
}
