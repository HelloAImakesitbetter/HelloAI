"use client";

import { useEffect, useState } from "react";

type Avatar = { id: string; name: string; previewUrl: string; gender: string };
type Voice = { id: string; name: string; gender: string; language: string };
type Character = { name: string; avatarId: string; voiceId: string };

export default function CharactersPage() {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [name, setName] = useState("");
  const [avatarId, setAvatarId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [message, setMessage] = useState("Loading HeyGen characters...");

  useEffect(() => {
    const saved = localStorage.getItem("helloai-characters");
    if (saved) setCharacters(JSON.parse(saved));
    fetch("/api/characters").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load characters");
      setAvatars(data.avatars); setVoices(data.voices); setMessage("");
    }).catch((error) => setMessage(error.message));
  }, []);

  const save = (next: Character[]) => { setCharacters(next); localStorage.setItem("helloai-characters", JSON.stringify(next)); };
  const addCharacter = () => {
    if (!name.trim() || !avatarId || !voiceId) return;
    save([...characters.filter((character) => character.name.toLowerCase() !== name.trim().toLowerCase()), { name: name.trim(), avatarId, voiceId }]);
    setName(""); setMessage("Character saved");
  };

  return <main className="character-manager-shell"><header className="website-builder-header"><a href="/" className="back-link">← HelloAI workspace</a><span className="eyebrow">CHARACTER MANAGER</span></header><div className="character-manager-grid"><section className="character-form-card"><span className="eyebrow">BUILD YOUR CAST</span><h1>Name a character. Choose their face and voice.</h1><p>These selections are used automatically when the customer dialogue matches the character name.</p><label>Character name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Aisha" /></label><label>Avatar<select value={avatarId} onChange={(event) => setAvatarId(event.target.value)}><option value="">Choose an avatar</option>{avatars.map((avatar) => <option key={avatar.id} value={avatar.id}>{avatar.name}{avatar.gender ? ` · ${avatar.gender}` : ""}</option>)}</select></label><label>Voice<select value={voiceId} onChange={(event) => setVoiceId(event.target.value)}><option value="">Choose a voice</option>{voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}{voice.language ? ` · ${voice.language}` : ""}</option>)}</select></label><button className="primary-button" type="button" onClick={addCharacter} disabled={!name.trim() || !avatarId || !voiceId}>Save character</button>{message && <p className="character-message">{message}</p>}</section><section className="character-list-card"><div className="section-heading"><div><span className="eyebrow">YOUR CAST</span><h2>{characters.length} characters</h2></div></div>{characters.length === 0 ? <div className="character-empty">Save your first character to make the video cast dynamic.</div> : <div className="character-list">{characters.map((character) => <article key={character.name}><div className="character-avatar">{avatars.find((avatar) => avatar.id === character.avatarId)?.previewUrl ? <img src={avatars.find((avatar) => avatar.id === character.avatarId)?.previewUrl} alt="" /> : <span>{character.name[0]}</span>}</div><div><strong>{character.name}</strong><small>Avatar and voice connected</small></div><button type="button" onClick={() => save(characters.filter((item) => item.name !== character.name))}>Remove</button></article>)}</div>}</section></div></main>;
}
