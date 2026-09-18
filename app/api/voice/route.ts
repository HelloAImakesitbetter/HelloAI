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
const defaultVoiceId = "JBFqnCBsd6RMkjVDRZzb";

type DialogueLine = { speaker: string; text: string };

async function generateSpeech(apiKey: string, voiceId: string, text: string) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs voice generation failed (${response.status}): ${errorText.slice(0, 240)}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function parseDialogue(script: string): DialogueLine[] {
  return script
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([^:]{1,40})\s*:\s*(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({ speaker: match[1], text: match[2].trim() }))
    .filter(
      (line) =>
        !/^(narrator|voiceover|voice-over|speaker|scene|director)$/i.test(line.speaker) &&
        line.text.length > 0
    );
}

export async function POST(req: Request) {
  let workingDirectory = "";

  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    const { script } = (await req.json()) as { script?: string };

    if (!script || typeof script !== "string") {
      return Response.json({ error: "A script is required" }, { status: 400 });
    }

    const dialogue = parseDialogue(script);
    const voiceIds = (process.env.ELEVENLABS_VOICE_IDS || process.env.ELEVENLABS_VOICE_ID || defaultVoiceId)
      .split(",")
      .map((voiceId) => voiceId.trim())
        .filter((voiceId) => voiceId && !/^voice_id_\d+$/i.test(voiceId))
      .filter(Boolean);

      if (voiceIds.length === 0) {
        voiceIds.push(defaultVoiceId);
      }

    if (dialogue.length === 0) {
      return new Response(await generateSpeech(apiKey, voiceIds[0], script), {
        headers: { "Content-Type": "audio/mpeg" },
      });
    }

    const audioFiles = [];

    for (const [index, line] of dialogue.entries()) {
      const speakerIndex = dialogue.findIndex(
        (candidate) => candidate.speaker === line.speaker
      );
      const bytes = await generateSpeech(
        apiKey,
        voiceIds[(speakerIndex >= 0 ? speakerIndex : index) % voiceIds.length],
        line.text
      );
      audioFiles.push({
        fileName: `dialogue-${index}.mp3`,
        bytes,
      });
    }

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
