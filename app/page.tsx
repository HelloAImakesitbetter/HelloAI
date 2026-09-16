"use client";

import { useState } from "react";

type Scene = {
  scene: number;
  imagePrompt: string;
  imageUrl: string;
};

export default function Home() {
  const [result, setResult] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioDataUrl, setAudioDataUrl] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);
  const [isCreatingVideo, setIsCreatingVideo] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ businessName, description }),
      });
      const responseText = await response.text();
      let data: { script?: string; error?: string };

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `The API returned an invalid response (${response.status})`
        );
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate script");
      }

      if (!data.script) {
        throw new Error("The API response did not include a script");
      }

      setResult(data.script);
      setScenes([]);
      setAudioDataUrl("");
      setVideoUrl("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to generate script"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const generateVoice = async () => {
    if (!result) {
      return;
    }

    setError("");

    try {
      const response = await fetch("/api/voice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ script: result }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to generate voiceover");
      }

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      const blob = await response.blob();
      const audioData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Failed to read voiceover"));
        reader.readAsDataURL(blob);
      });

      setAudioUrl(URL.createObjectURL(blob));
      setAudioDataUrl(audioData);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to generate voiceover"
      );
    }
  };

  const generateScenes = async () => {
    if (!result) {
      return;
    }

    setIsGeneratingScenes(true);
    setError("");

    try {
      const response = await fetch("/api/scenes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ script: result }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate scenes");
      }

      setScenes(data.scenes);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to generate scenes"
      );
    } finally {
      setIsGeneratingScenes(false);
    }
  };

  const createVideo = async () => {
    if (scenes.length !== 3 || !audioDataUrl) {
      return;
    }

    setIsCreatingVideo(true);
    setError("");

    try {
      const response = await fetch("/api/video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scenes, audioDataUrl }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to create video");
      }

      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }

      setVideoUrl(URL.createObjectURL(await response.blob()));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to create video"
      );
    } finally {
      setIsCreatingVideo(false);
    }
  };

  return (
    <main className="p-10 max-w-3xl mx-auto">
      <h1 className="text-4xl font-bold mb-4">
        Business Video AI
      </h1>

      <p className="mb-6">
        Enter your business details and generate a marketing video.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Business Name"
          className="w-full border p-3 rounded"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
        />

        <textarea
          placeholder="Describe your business..."
          className="w-full border p-3 rounded h-32"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <button
          type="submit"
          className="bg-black text-white px-6 py-3 rounded"
          disabled={isLoading}
        >
          {isLoading ? "Generating..." : "Generate Video"}
        </button>
      </form>

      {error && <p className="mt-4 text-red-600">{error}</p>}

      {result && (
        <div className="mt-8 border p-4 rounded">
          <h2 className="font-bold mb-2">Generated Script</h2>
          <pre>{result}</pre>
          <button
            type="button"
            onClick={generateVoice}
            className="mt-4 bg-black text-white px-6 py-3 rounded"
          >
            Generate Voiceover
          </button>

          {audioUrl && (
            <audio controls className="mt-4 w-full">
              <source src={audioUrl} type="audio/mpeg" />
            </audio>
          )}

          <button
            type="button"
            onClick={generateScenes}
            disabled={isGeneratingScenes}
            className="mt-4 bg-black text-white px-6 py-3 rounded disabled:opacity-50"
          >
            {isGeneratingScenes ? "Creating Scenes..." : "Generate Scene Images"}
          </button>

          {scenes.length === 3 && audioDataUrl && (
            <button
              type="button"
              onClick={createVideo}
              disabled={isCreatingVideo}
              className="mt-4 ml-3 bg-black text-white px-6 py-3 rounded disabled:opacity-50"
            >
              {isCreatingVideo ? "Creating MP4..." : "Create MP4"}
            </button>
          )}
        </div>
      )}

      {scenes.length > 0 && (
        <section className="mt-8">
          <h2 className="font-bold mb-4">Video Scenes</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {scenes.map((scene) => (
              <article key={scene.scene} className="border rounded overflow-hidden">
                <img
                  src={scene.imageUrl}
                  alt={`Scene ${scene.scene}`}
                  className="aspect-square w-full object-cover"
                />
                <div className="p-4">
                  <h3 className="font-bold">Scene {scene.scene}</h3>
                  <p className="mt-2 text-sm">{scene.imagePrompt}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {videoUrl && (
        <section className="mt-8 border p-4 rounded">
          <h2 className="font-bold mb-4">Finished Video</h2>
          <video controls src={videoUrl} className="w-full" />
          <a
            href={videoUrl}
            download="business-video.mp4"
            className="mt-4 inline-block bg-black text-white px-6 py-3 rounded"
          >
            Download MP4
          </a>
        </section>
      )}
    </main>
  );
}