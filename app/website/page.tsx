"use client";

import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { WebsitePagePlan } from "../../lib/website-generator";
import { buildZip, exportEmbedHtml, exportPageHtml, pageFileName } from "../../lib/website-export";
import { WEBSITE_TEMPLATES, type WebsiteTemplate } from "../../lib/website-templates";

type WebsitePage = {
  slug: string;
  label: string;
  pageType?: string;
  request?: string;
  isGenerated?: boolean;
  showInNavigation?: boolean;
  title: string;
  tagline: string;
  intro: string;
  primaryCta: string;
  secondaryCta: string;
  benefits: string[];
  steps: string[];
  closing: string;
  imagePrompt?: string;
  sections?: { heading: string; body: string; items: string[]; layout: "cards" | "split" | "faq" | "steps" }[];
  seoTitle: string;
  seoDescription: string;
};
type WebsiteDraft = { pages: WebsitePage[]; growthPack?: { blogs: { title: string; keyword: string; outline: string }[]; localPages: string[]; faq: { question: string; answer: string }[] } };
type Photo = { name: string; url: string; fallbackUrl?: string; x: number; y: number };
type Provider = "wordpress" | "shopify" | "webflow" | "github-vercel" | "custom";
type ProviderConnection = { id: string; provider: Provider; label: string };
const MAX_SAVED_IMAGE_DATA_URL_CHARS = 1_800_000;
const MAX_WEBSITE_PAGES = 200;
const MAX_BULK_LOCAL_PAGES = 50;
const WEBSITE_STORAGE_FULL_EVENT = "helloai-website-storage-full";
const WEBSITE_STORAGE_SAVED_EVENT = "helloai-website-storage-saved";

function getSavedImageDataSize(photos: Record<string, Photo[]>) {
  return Object.values(photos).flat().reduce((total, photo) => total + (photo.url.startsWith("data:image/") ? photo.url.length : 0), 0);
}

function hydrateWebsiteDraft(draft?: WebsiteDraft | null): WebsiteDraft | null {
  if (!draft) return null;
  return {
    ...draft,
    pages: draft.pages.map((page) => ({
      ...page,
      isGenerated: page.isGenerated ?? true,
      showInNavigation: page.showInNavigation ?? true,
    })),
  };
}

function getPhotoQuery(page: WebsitePage, businessDescription: string) {
  const source = page.imagePrompt || `${page.label} ${businessDescription}`;
  return source.replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 8).join(",");
}

function getFallbackPhoto(pageIndex: number, businessDescription: string, pageLabel: string) {
  const context = `${businessDescription} ${pageLabel}`.toLowerCase();
  const photoIds: [string[], string][] = [
    [["restaurant", "catering", "food", "chef", "bakery"], "photo-1555396273-367ea4eb4db5"],
    [["salon", "hair", "beauty", "spa"], "photo-1560066984-138dadb4c035"],
    [["clean", "cleaning"], "photo-1581578731548-c64695cc6952"],
    [["gym", "fitness", "training"], "photo-1534438327276-14e5300c3a48"],
    [["builder", "construction", "renovation"], "photo-1504307651254-35680f356dfd"],
    [["health", "clinic", "medical", "dental"], "photo-1538108149393-fbbd81895907"],
    [["property", "real estate", "estate agent"], "photo-1560518883-ce09059eeffa"],
    [["coffee", "cafe", "café"], "photo-1442512595331-e89e73853f31"],
  ];
  const match = photoIds.find(([keywords]) => keywords.some((keyword) => context.includes(keyword)));
  const fallbackPhotos = [
    "photo-1497366754035-f200968a6e72",
    "photo-1524758631624-e2822e304c36",
    "photo-1556761175-b413da4baf72",
    "photo-1556742049-0cfed4f6a45d",
  ];
  const photoId = match?.[1] || fallbackPhotos[pageIndex % fallbackPhotos.length];
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&crop=entropy&w=1800&h=1200&q=85`;
}

function compressWebsiteImage(dataUrl: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const scale = Math.min(1, 1200 / image.naturalWidth, 800 / image.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Could not prepare the generated image"));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    image.onerror = () => reject(new Error("Could not load the generated image"));
    image.src = dataUrl;
  });
}

export default function WebsiteBuilderPage() {
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [activeTemplate, setActiveTemplate] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [services, setServices] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("Clear, confident, and human");
  const [primaryAction, setPrimaryAction] = useState("Contact the business");
  const [draft, setDraft] = useState<WebsiteDraft | null>(null);
  const [selectedSlug, setSelectedSlug] = useState("home");
  const [photos, setPhotos] = useState<Record<string, Photo[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isGeneratingHeroImage, setIsGeneratingHeroImage] = useState(false);
  const [error, setError] = useState("");
  const [autoFixNotice] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const fixMarker = window.localStorage.getItem("helloai-website-autofix");
      if (!fixMarker) return "";
      const parsedFix = JSON.parse(fixMarker) as { summary?: string };
      return parsedFix.summary ? `SEO auto-fix applied: ${parsedFix.summary}.` : "SEO auto-fix applied to your website draft.";
    } catch {
      return "SEO auto-fix applied to your website draft.";
    }
  });
  const [draggingPhoto, setDraggingPhoto] = useState<{ pageSlug: string; name: string } | null>(null);
  const [provider, setProvider] = useState<Provider>("wordpress");
  const [providerFields, setProviderFields] = useState<Record<string, string>>({});
  const [providerConnections, setProviderConnections] = useState<ProviderConnection[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedDraft, setPublishedDraft] = useState<{ title: string; editUrl: string } | null>(null);
  const [refinementInstruction, setRefinementInstruction] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [isGeneratingPage, setIsGeneratingPage] = useState(false);
  const [newPageLabel, setNewPageLabel] = useState("");
  const [localService, setLocalService] = useState("");
  const [localAreas, setLocalAreas] = useState("");
  const [accountUserId, setAccountUserId] = useState<string | null>(null);
  const [isResettingProject, setIsResettingProject] = useState(false);
  const [projectMessage, setProjectMessage] = useState("");

  const selectedPage = draft?.pages.find((page) => page.slug === selectedSlug) || draft?.pages[0];
  const seoTitleLength = selectedPage?.seoTitle?.length || 0;
  const seoDescriptionLength = selectedPage?.seoDescription?.length || 0;
  const seoChecks = [seoTitleLength >= 30 && seoTitleLength <= 60, seoDescriptionLength >= 120 && seoDescriptionLength <= 160, Boolean(selectedPage?.title), Boolean(selectedPage?.primaryCta)].filter(Boolean).length;

  useEffect(() => {
    const loadProject = async () => {
      const saved = window.localStorage.getItem("helloai-website-draft");
      if (saved) {
        try {
          const data = JSON.parse(saved) as { businessName?: string; description?: string; industry?: string; location?: string; phone?: string; email?: string; websiteUrl?: string; services?: string; audience?: string; tone?: string; primaryAction?: string; draft?: WebsiteDraft; photos?: Record<string, Photo[]> };
          setBusinessName(data.businessName || ""); setDescription(data.description || ""); setIndustry(data.industry || ""); setLocation(data.location || ""); setPhone(data.phone || ""); setEmail(data.email || ""); setWebsiteUrl(data.websiteUrl || ""); setServices(data.services || ""); setAudience(data.audience || ""); setTone(data.tone || "Clear, confident, and human"); setPrimaryAction(data.primaryAction || "Contact the business"); setDraft(hydrateWebsiteDraft(data.draft));
          setPhotos(Object.fromEntries(Object.entries(data.photos || {}).map(([slug, pagePhotos]) => [slug, (pagePhotos as Photo[]).map((photo, index) => ({ ...photo, x: photo.x ?? 5 + (index % 3) * 30, y: photo.y ?? 12 + Math.floor(index / 3) * 28 }))])));
        } catch { /* Ignore stale local drafts. */ }
      }
      if (!supabase) return;
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;
      setAccountUserId(userId);
      const { data } = await supabase.from("projects").select("payload").eq("user_id", userId).eq("kind", "website").maybeSingle();
      if (!data?.payload) return;
      const project = data.payload as {
        businessName?: string;
        description?: string;
        industry?: string;
        location?: string;
        phone?: string;
        email?: string;
        websiteUrl?: string;
        services?: string;
        audience?: string;
        tone?: string;
        primaryAction?: string;
        draft?: WebsiteDraft;
        photos?: Record<string, Photo[]>;
      };
      setBusinessName(project.businessName || ""); setDescription(project.description || ""); setIndustry(project.industry || ""); setLocation(project.location || ""); setPhone(project.phone || ""); setEmail(project.email || ""); setWebsiteUrl(project.websiteUrl || ""); setServices(project.services || ""); setAudience(project.audience || ""); setTone(project.tone || "Clear, confident, and human"); setPrimaryAction(project.primaryAction || "Contact the business"); setDraft(hydrateWebsiteDraft(project.draft)); setPhotos(project.photos || {});
    };
    void loadProject();
  }, []);

  useEffect(() => {
    const handleStorageFull = () => setError("Your browser could not save this draft because its image storage is full. Remove some uploaded or AI-generated images and try again.");
    const handleStorageSaved = () => setError((current) => current.startsWith("Your browser could not save this draft") ? "" : current);
    window.addEventListener(WEBSITE_STORAGE_FULL_EVENT, handleStorageFull);
    window.addEventListener(WEBSITE_STORAGE_SAVED_EVENT, handleStorageSaved);
    return () => {
      window.removeEventListener(WEBSITE_STORAGE_FULL_EVENT, handleStorageFull);
      window.removeEventListener(WEBSITE_STORAGE_SAVED_EVENT, handleStorageSaved);
    };
  }, []);

  useEffect(() => {
    const payload = { businessName, description, industry, location, phone, email, websiteUrl, services, audience, tone, primaryAction, draft, photos };
    if (isResettingProject) return;
    try {
      window.localStorage.setItem("helloai-website-draft", JSON.stringify(payload));
      window.dispatchEvent(new Event(WEBSITE_STORAGE_SAVED_EVENT));
    } catch {
      window.dispatchEvent(new Event(WEBSITE_STORAGE_FULL_EVENT));
    }
    if (supabase && accountUserId && (draft || businessName || description)) {
      void supabase.from("projects").upsert({ user_id: accountUserId, kind: "website", name: businessName || "Website project", payload, updated_at: new Date().toISOString() }, { onConflict: "user_id,kind" });
    }
  }, [accountUserId, businessName, description, industry, location, phone, email, websiteUrl, services, audience, tone, primaryAction, draft, photos, isResettingProject]);

  const resetWebsiteProject = async () => {
    if (!window.confirm("Delete this website project and its saved draft? This cannot be undone.")) return;
    setIsResettingProject(true);
    setError("");
    setProjectMessage("");
    try {
      if (supabase && accountUserId) {
        const { error: deleteError } = await supabase.from("projects").delete().eq("user_id", accountUserId).eq("kind", "website");
        if (deleteError) throw new Error(`Could not delete the saved website project: ${deleteError.message}`);
      }
      window.localStorage.removeItem("helloai-website-draft");
      window.localStorage.removeItem("helloai-website-autofix");
      setBusinessName("");
      setDescription("");
      setIndustry("");
      setLocation("");
      setPhone("");
      setEmail("");
      setWebsiteUrl("");
      setServices("");
      setAudience("");
      setTone("Clear, confident, and human");
      setPrimaryAction("Contact the business");
      setDraft(null);
      setSelectedSlug("home");
      setNewPageLabel("");
      setPhotos({});
      setProjectMessage("Website project deleted. You can start a new one whenever you’re ready.");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Could not delete the website project.");
    } finally {
      setIsResettingProject(false);
    }
  };

  const buildWebsite = async (event: FormEvent) => {
    event.preventDefault();
    if (draft?.pages.some((page) => page.isGenerated !== false) && !window.confirm("Replace the current page plan and generated page drafts? This cannot be undone.")) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/website/sitemap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessName, description, industry, location, phone, email, websiteUrl, services, audience, tone, primaryAction }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to suggest website pages");
      const pages = (data.pages as WebsitePagePlan[]).map((page) => ({
        ...page,
        isGenerated: false,
        showInNavigation: true,
        title: "",
        tagline: "",
        intro: "",
        primaryCta: "",
        secondaryCta: "",
        benefits: [],
        steps: [],
        closing: "",
        imagePrompt: "",
        seoTitle: "",
        seoDescription: "",
      }));
      const firstPage = pages.find((page) => page.slug === "home") || pages[0];
      setDraft({ pages, growthPack: data.growthPack });
      setSelectedSlug(firstPage.slug);
      setPhotos({});
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to suggest website pages");
    } finally {
      setIsLoading(false);
    }
  };

  const generateSelectedPage = async () => {
    if (!selectedPage || !draft || isGeneratingPage || !description.trim()) return;
    setIsGeneratingPage(true);
    setIsLoadingPhotos(true);
    setError("");
    try {
      const response = await fetch("/api/website/page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: selectedPage,
          instruction: selectedPage.request || "",
          existingPages: [...draft.pages.filter((page) => page.slug !== selectedPage.slug && page.isGenerated !== false && page.pageType !== "local"), ...draft.pages.filter((page) => page.slug !== selectedPage.slug && (page.isGenerated === false || page.pageType === "local"))]
            .slice(0, 20)
            .map(({ slug, label, title, intro, isGenerated }) => ({ slug, label, title, intro: intro.slice(0, 300), isGenerated })),
          businessName,
          description,
          industry,
          location,
          phone,
          email,
          websiteUrl,
          services,
          audience,
          tone,
          primaryAction,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate page");
      setDraft((current) => current ? {
        ...current,
        pages: current.pages.map((page) => page.slug === selectedPage.slug
          ? { ...page, ...data.page, request: page.request, showInNavigation: page.showInNavigation ?? true }
          : page),
      } : current);
      const selectedPageIndex = draft.pages.findIndex((page) => page.slug === selectedPage.slug);
      const stockPhoto = getFallbackPhoto(selectedPageIndex, `${industry} ${description}`, selectedPage.label);
      const photo: Photo = {
        name: `${selectedPage.label} hero photo`,
        url: stockPhoto,
        x: 0,
        y: 0,
      };
      setPhotos((current) => ({ ...current, [selectedPage.slug]: current[selectedPage.slug]?.length ? current[selectedPage.slug] : [photo] }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to generate page");
    } finally {
      setIsGeneratingPage(false);
      setIsLoadingPhotos(false);
    }
  };

  const addLocalPages = () => {
    if (!draft) return;
    const service = localService.trim().slice(0, 60);
    const areas = Array.from(new Set(localAreas.split(/[,\n]/).map((area) => area.trim().slice(0, 50)).filter(Boolean))).slice(0, MAX_BULK_LOCAL_PAGES);
    if (!areas.length) {
      setError("Enter at least one area, separated by commas or new lines.");
      return;
    }
    const makeSlug = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
    const usedSlugs = new Set(draft.pages.map((page) => page.slug));
    const newPages: WebsitePage[] = [];
    for (const area of areas) {
      if (draft.pages.length + newPages.length >= MAX_WEBSITE_PAGES) break;
      const label = (service ? `${service} in ${area}` : area).slice(0, 80);
      const slug = makeSlug(label);
      if (!slug || usedSlugs.has(slug)) continue;
      usedSlugs.add(slug);
      newPages.push({
        slug,
        label,
        pageType: "local",
        request: `Write a genuinely useful local landing page for ${area}${service ? ` about ${service}` : ""}. Mention ${area} naturally and only include local details that are supported by the business brief. Do not invent addresses, local statistics, customer names, reviews, or claims. Make it distinct from the pages for other areas.`,
        isGenerated: false,
        showInNavigation: false,
        title: "",
        tagline: "",
        intro: "",
        primaryCta: "",
        secondaryCta: "",
        benefits: [],
        steps: [],
        closing: "",
        imagePrompt: "",
        seoTitle: "",
        seoDescription: "",
      });
    }
    if (!newPages.length) {
      setError("Those pages already exist or the page limit has been reached.");
      return;
    }
    setDraft({ ...draft, pages: [...draft.pages, ...newPages] });
    setLocalAreas("");
    setError("");
    setProjectMessage(`Added ${newPages.length} local page${newPages.length === 1 ? "" : "s"}. They're hidden from navigation by default and ready to generate one at a time.`);
  };

  const addPlannedPage = () => {
    if (!draft || draft.pages.length >= MAX_WEBSITE_PAGES || !newPageLabel.trim()) return;
    const label = newPageLabel.trim().slice(0, 80);
    const slug = label.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
    if (!slug) {
      setError("Use at least one letter or number in the page name.");
      return;
    }
    if (draft.pages.some((page) => page.slug === slug)) {
      setError("A page with that URL already exists. Choose a different page name.");
      return;
    }
    const page: WebsitePage = {
      slug,
      label,
      pageType: "custom",
      request: `Create a ${label} page based on the business brief.`,
      isGenerated: false,
      showInNavigation: true,
      title: "",
      tagline: "",
      intro: "",
      primaryCta: "",
      secondaryCta: "",
      benefits: [],
      steps: [],
      closing: "",
      imagePrompt: "",
      seoTitle: "",
      seoDescription: "",
    };
    setDraft({ ...draft, pages: [...draft.pages, page] });
    setSelectedSlug(page.slug);
    setNewPageLabel("");
    setError("");
  };

  const removePlannedPage = (page: WebsitePage) => {
    if (!draft || draft.pages.length <= 1) {
      setError("A website plan must have at least one page.");
      return;
    }
    if (!window.confirm(`Remove the ${page.label} page and its draft from this website plan?`)) return;
    const remainingPages = draft.pages.filter((item) => item.slug !== page.slug);
    setDraft({ ...draft, pages: remainingPages });
    setPhotos((current) => {
      const next = { ...current };
      delete next[page.slug];
      return next;
    });
    if (selectedSlug === page.slug) {
      const nextPage = remainingPages[0];
      setSelectedSlug(nextPage.slug);
    }
  };

  const connectProvider = async () => {
    setIsConnecting(true);
    setConnectionMessage("");
    setError("");
    try {
      const response = await fetch("/api/seo/connections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, ...providerFields }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Provider connection failed");
      setProviderConnections((current) => [...current, { id: `${provider}-${Date.now()}`, provider, label: data.label }]);
      setConnectionMessage(data.detail);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Provider connection failed");
    } finally {
      setIsConnecting(false);
    }
  };

  const setProviderField = (key: string, value: string) => setProviderFields((current) => ({ ...current, [key]: value }));

  const applyTemplate = (template: WebsiteTemplate) => {
    if ((draft || description.trim()) && !window.confirm("Replace your current brief with this template? Your generated pages are kept until you build a new plan.")) return;
    setActiveTemplate(template.id);
    setIndustry(template.brief.industry);
    setDescription(template.brief.description);
    setServices(template.brief.services);
    setAudience(template.brief.audience);
    setTone(template.brief.tone);
    setPrimaryAction(template.brief.primaryAction);
    setProjectMessage(`"${template.name}" template loaded. Add your business name and details, then build your page plan.`);
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadSiteZip = () => {
    if (!draft) return;
    const generated = draft.pages.filter((page) => page.isGenerated !== false);
    if (!generated.length) return;
    downloadBlob(buildZip(generated.map((page) => ({ name: pageFileName(page), content: exportPageHtml(page, businessName, generated, photos) }))), `${(businessName || "website").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-site.zip`);
  };

  const copyEmbedCode = async () => {
    if (!selectedPage) return;
    try {
      await navigator.clipboard.writeText(exportEmbedHtml(selectedPage, businessName, photos));
      setConnectionMessage("Embed code copied. Paste it into a Wix Embed HTML element, a Squarespace code block, or any HTML field.");
    } catch {
      setError("Could not copy to the clipboard. Use the download option instead.");
    }
  };

  const publishToProvider = async () => {
    if (!selectedPage || isPublishing || (provider !== "shopify" && provider !== "github-vercel")) return;
    const target = provider === "shopify" ? "an unpublished Shopify page" : `a "helloai-pages" branch in ${providerFields.repository || "your repository"}`;
    if (!window.confirm(`Send "${selectedPage.title}" to ${target}? It will not go live automatically.`)) return;

    setIsPublishing(true);
    setError("");
    setPublishedDraft(null);
    try {
      const response = await fetch("/api/website/publish-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, shopDomain: providerFields.shopDomain, repository: providerFields.repository, token: providerFields.token, businessName, heroImage: heroPhoto?.url, page: selectedPage }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Publishing failed");
      setPublishedDraft({ title: selectedPage.title, editUrl: data.url });
      setConnectionMessage(data.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Publishing failed");
    } finally {
      setIsPublishing(false);
    }
  };

  const createWordPressDraft = async () => {
    if (!selectedPage || !providerFields.baseUrl?.trim() || !providerFields.username?.trim() || !providerFields.token?.trim() || isPublishing) return;
    if (!window.confirm(`Create "${selectedPage.title}" as a WordPress draft? It will not be public until you publish it in WordPress.`)) return;

    setIsPublishing(true);
    setError("");
    setPublishedDraft(null);
    try {
      const response = await fetch("/api/website/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: providerFields.baseUrl, username: providerFields.username, token: providerFields.token, businessName, heroImage: heroPhoto?.url, page: selectedPage }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create WordPress draft");
      setPublishedDraft({ title: selectedPage.title, editUrl: data.editUrl });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create WordPress draft");
    } finally {
      setIsPublishing(false);
    }
  };

  const refineSelectedPage = async () => {
    if (!selectedPage || selectedPage.isGenerated === false || !refinementInstruction.trim()) return;
    setIsRefining(true);
    setError("");
    try {
      const response = await fetch("/api/website/refine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: selectedPage, instruction: refinementInstruction, businessName, audience, tone }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to refine page");
      setDraft((current) => current ? { ...current, pages: current.pages.map((page) => page.slug === selectedPage.slug ? { ...page, ...data.page } : page) } : current);
      setRefinementInstruction("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to refine page");
    } finally {
      setIsRefining(false);
    }
  };

  const updateSelectedPage = (field: keyof WebsitePage, value: string | boolean) => {
    if (!draft || !selectedPage) return;
    setDraft({ ...draft, pages: draft.pages.map((page) => page.slug === selectedPage.slug ? { ...page, [field]: value } : page) });
  };

  const generateHeroImage = async () => {
    if (!selectedPage || selectedPage.isGenerated === false || isGeneratingHeroImage) return;
    if (!supabase) {
      setError("Supabase is not configured, so sign-in is unavailable.");
      return;
    }
    setIsGeneratingHeroImage(true);
    setError("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) throw new Error("Sign in before generating an AI hero image.");
      const response = await fetch("/api/website/image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          businessName,
          industry: industry || description.slice(0, 120),
          pageLabel: selectedPage.label,
          imagePrompt: selectedPage.imagePrompt || `${selectedPage.title}. ${selectedPage.tagline}. ${getPhotoQuery(selectedPage, description)}`,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate hero image");
      const compressedImage = await compressWebsiteImage(data.imageDataUrl);
      const pagePhotos = photos[selectedPage.slug] || [];
      const replacedHeroes = pagePhotos.filter((photo) => photo.name.endsWith(" hero image") || photo.name.endsWith(" hero photo"));
      const retainedImageDataSize = getSavedImageDataSize(photos) - replacedHeroes.reduce((total, photo) => total + (photo.url.startsWith("data:image/") ? photo.url.length : 0), 0);
      if (retainedImageDataSize + compressedImage.length > MAX_SAVED_IMAGE_DATA_URL_CHARS) {
        throw new Error("The saved image limit is reached. Remove some uploaded or AI-generated images before creating another.");
      }
      const newHero: Photo = { name: `${selectedPage.label} AI hero image`, url: compressedImage, x: 0, y: 0 };
      setPhotos((current) => {
        const pagePhotos = current[selectedPage.slug] || [];
        return { ...current, [selectedPage.slug]: [newHero, ...pagePhotos.filter((photo) => !photo.name.endsWith(" hero image") && !photo.name.endsWith(" hero photo"))] };
      });
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : "Failed to generate hero image");
    } finally {
      setIsGeneratingHeroImage(false);
    }
  };

  const addPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    if (!selectedPage || !event.target.files) return;
    const files = Array.from(event.target.files);
    void Promise.all(files.map((file) => new Promise<Photo>((resolve, reject) => {
      if (file.size > 20 * 1024 * 1024) {
        reject(new Error(`${file.name} is larger than the 20 MB upload limit`));
        return;
      }
      if (!file.type.startsWith("image/")) {
        reject(new Error(`${file.name} is not an image`));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
      reader.onload = async () => {
        try {
          resolve({ name: file.name, url: await compressWebsiteImage(String(reader.result)), x: 5, y: 12 });
        } catch (imageError) {
          reject(imageError);
        }
      };
      reader.readAsDataURL(file);
    }))).then((newPhotos) => {
      if (getSavedImageDataSize(photos) + newPhotos.reduce((total, photo) => total + photo.url.length, 0) > MAX_SAVED_IMAGE_DATA_URL_CHARS) {
        throw new Error("The saved image limit is reached. Remove some uploaded or AI-generated images before adding more.");
      }
      setError("");
      setPhotos((current) => {
        const existing = current[selectedPage.slug] || [];
        return {
          ...current,
          [selectedPage.slug]: [...existing, ...newPhotos.map((photo, index) => ({
            ...photo,
            x: 5 + ((existing.length + index) % 3) * 30,
            y: 12 + Math.floor((existing.length + index) / 3) * 28,
          }))],
        };
      });
    }).catch((imageError) => setError(imageError instanceof Error ? imageError.message : "Could not add page photos"));
    event.target.value = "";
  };

  const heroPhoto = selectedPage
    ? photos[selectedPage.slug]?.[0] || {
      name: `${selectedPage.label} hero photo`,
      url: getFallbackPhoto(draft?.pages.findIndex((page) => page.slug === selectedPage.slug) || 0, `${industry} ${description}`, selectedPage.label),
      x: 0,
      y: 0,
    }
    : null;

  return (
    <main className="website-builder-shell">
      <header className="website-builder-header"><Link href="/" className="back-link">← HelloAI workspace</Link><span className="eyebrow">WEBSITE BUILDER</span><button type="button" className="secondary-button" onClick={() => void resetWebsiteProject()} disabled={isResettingProject}>{isResettingProject ? "Deleting..." : "Delete / restart project"}</button></header>
      {projectMessage && <div className="success-banner" role="status">{projectMessage}</div>}
      <div className="website-builder-grid website-builder-grid-wide">
        <section className="website-brief-panel">
          <span className="eyebrow">PLAN AND BUILD PAGE BY PAGE</span><h1>Make your site one page at a time.</h1>
          <p>Describe your business, review the suggested page plan, then generate and refine only the pages you want. Your work saves as a draft.</p>
          <div className="template-gallery">
            <span className="eyebrow">START FROM A TEMPLATE</span>
            <div className="template-grid">{WEBSITE_TEMPLATES.map((template) => <button key={template.id} type="button" className={`template-card${activeTemplate === template.id ? " template-card-active" : ""}`} style={{ borderTopColor: template.accent }} onClick={() => applyTemplate(template)}>
              <span className="template-icon" style={{ background: template.accent }}>{template.icon}</span>
              <strong>{template.name}</strong><small>{template.category}</small>
              <p>{template.summary}</p>
              <span className="template-pages">{template.pages.join(" · ")}</span>
            </button>)}</div>
            <small>Templates pre-fill the brief below. You can edit anything before building.</small>
          </div>
          <form onSubmit={buildWebsite} className="website-form">
            <label>Business name<input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="e.g. HelloCleaners" required /></label>
            <label>Industry<input value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="e.g. Cleaning services" /></label>
            <label>Location<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Manchester" /></label>
            <label>Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="e.g. 0161 555 0100" /></label>
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="hello@example.com" /></label>
            <label>Existing website <span className="optional-label">optional</span><input type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://example.com" /></label>
            <label>Services to promote<input value={services} onChange={(event) => setServices(event.target.value)} placeholder="End of tenancy, deep cleaning, carpet cleaning" /></label>
            <label>Business brief<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What do you offer, who is it for, and what should visitors do next?" required /></label>
            <label>Ideal audience<input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="e.g. Busy homeowners in Manchester" /></label>
            <label>Brand voice<select value={tone} onChange={(event) => setTone(event.target.value)}><option>Clear, confident, and human</option><option>Warm and conversational</option><option>Premium and editorial</option><option>Bold and energetic</option><option>Minimal and trustworthy</option></select></label>
            <label>Primary conversion action<input value={primaryAction} onChange={(event) => setPrimaryAction(event.target.value)} placeholder="e.g. Book a consultation" /></label>
            {error && <div className="error-banner">{error}</div>}
            {autoFixNotice && <div className="success-banner">{autoFixNotice}</div>}
            <button className="primary-button" type="submit" disabled={isLoading}>{isLoading ? "Planning your pages..." : draft ? "Suggest a new page plan →" : "Suggest page plan →"}</button>
          </form>
          {draft && <div className="page-review-panel">
            <div className="page-review-heading"><span className="eyebrow">YOUR PAGE PLAN</span><small>{draft.pages.filter((page) => page.isGenerated !== false).length} of {draft.pages.length} pages generated</small></div>
            {draft.pages.map((page) => <div className="page-plan-row" key={page.slug}>
              <button className={page.slug === selectedPage?.slug ? "page-tab selected" : "page-tab"} type="button" onClick={() => setSelectedSlug(page.slug)}>
                <span>{page.label}</span><small>{page.isGenerated === false ? "Ready to generate" : "Draft ready"}{page.showInNavigation === false ? " · Hidden from navigation" : ""}</small><b>→</b>
              </button>
              <button className="page-plan-remove" type="button" aria-label={`Remove ${page.label} from page plan`} onClick={() => removePlannedPage(page)}>×</button>
            </div>)}
            <div className="page-plan-add"><input aria-label="New page name" value={newPageLabel} onChange={(event) => setNewPageLabel(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addPlannedPage(); } }} placeholder="Add a page (e.g. Pricing)" /><button type="button" className="secondary-button" onClick={addPlannedPage} disabled={draft.pages.length >= MAX_WEBSITE_PAGES || !newPageLabel.trim()}>Add page</button></div>
            <div className="page-plan-local">
              <span className="eyebrow">LOCAL AREA PAGES</span>
              <input aria-label="Service for local pages" value={localService} onChange={(event) => setLocalService(event.target.value)} placeholder="Service (optional), e.g. House cleaning" />
              <textarea aria-label="Areas for local pages" value={localAreas} onChange={(event) => setLocalAreas(event.target.value)} placeholder="Areas, separated by commas or new lines, e.g. Didsbury, Salford, Stockport" />
              <button type="button" className="secondary-button" onClick={addLocalPages} disabled={draft.pages.length >= MAX_WEBSITE_PAGES || !localAreas.trim()}>Add local pages</button>
              <small>Up to {MAX_BULK_LOCAL_PAGES} at a time, {MAX_WEBSITE_PAGES} pages per site. Each is hidden from navigation by default and written separately so the copy isn’t duplicated.</small>
            </div>
          </div>}
          {draft?.growthPack && <section className="growth-pack-panel"><span className="eyebrow">GROWTH PACK</span><strong>{draft.growthPack.blogs.length} blog ideas · {draft.growthPack.localPages.length} local pages · {draft.growthPack.faq.length} FAQs</strong><div>{draft.growthPack.blogs.slice(0, 4).map((blog) => <p key={blog.title}><b>{blog.title}</b><small>{blog.keyword}</small></p>)}</div></section>}
          <section className="website-publishing-panel"><span className="eyebrow">CONNECT TO PUBLISH</span><strong>{providerConnections.length ? `${providerConnections.length} provider connection${providerConnections.length === 1 ? "" : "s"}` : "Connect website providers"}</strong><p>Connect as many websites and provider accounts as needed. Tokens are sent to the server and not saved in the browser.</p>{providerConnections.length > 0 && <div className="website-connection-list">{providerConnections.map((connection) => <div key={connection.id}><span>{connection.label}</span><small>Verified connection</small></div>)}</div>}{isLoadingPhotos && <div className="success-banner">Adding relevant page imagery...</div>}<select value={provider} onChange={(event) => setProvider(event.target.value as Provider)}><option value="wordpress">WordPress REST API</option><option value="shopify">Shopify Admin API</option><option value="webflow">Webflow API</option><option value="github-vercel">GitHub / Vercel</option><option value="custom">Custom CMS API</option></select>{provider === "wordpress" && <><input placeholder="WordPress site URL" value={providerFields.baseUrl || ""} onChange={(event) => setProviderField("baseUrl", event.target.value)} /><input type="password" placeholder="Application access token" value={providerFields.token || ""} onChange={(event) => setProviderField("token", event.target.value)} /></>}{provider === "shopify" && <><input placeholder="store.myshopify.com" value={providerFields.shopDomain || ""} onChange={(event) => setProviderField("shopDomain", event.target.value)} /><input type="password" placeholder="Admin API access token" value={providerFields.token || ""} onChange={(event) => setProviderField("token", event.target.value)} /></>}{provider === "webflow" && <><input placeholder="Webflow site ID" value={providerFields.siteId || ""} onChange={(event) => setProviderField("siteId", event.target.value)} /><input type="password" placeholder="Webflow API token" value={providerFields.token || ""} onChange={(event) => setProviderField("token", event.target.value)} /></>}{provider === "github-vercel" && <><input placeholder="owner/repository" value={providerFields.repository || ""} onChange={(event) => setProviderField("repository", event.target.value)} /><input placeholder="Vercel project name" value={providerFields.vercelProject || ""} onChange={(event) => setProviderField("vercelProject", event.target.value)} /><input type="password" placeholder="GitHub token" value={providerFields.token || ""} onChange={(event) => setProviderField("token", event.target.value)} /></>}{provider === "custom" && <><input placeholder="Custom CMS endpoint" value={providerFields.endpoint || ""} onChange={(event) => setProviderField("endpoint", event.target.value)} /><input type="password" placeholder="CMS API token" value={providerFields.token || ""} onChange={(event) => setProviderField("token", event.target.value)} /></>}<button type="button" className="secondary-button" onClick={connectProvider} disabled={isConnecting}>{isConnecting ? "Verifying connection..." : "Verify and connect another"}</button>{connectionMessage && <div className="success-banner">{connectionMessage}</div>}</section>
        </section>
        <section className="website-preview-frame">
          {selectedPage ? (selectedPage.isGenerated === false ? <div className="website-plan-preview">
            <span className="eyebrow">PAGE PLAN · /{selectedPage.slug}</span>
            <h2>{selectedPage.label}</h2>
            <p>This page is planned but its content has not been generated. Add any page-specific details in the editor, then generate this page when you’re ready.</p>
            <div className="page-visibility-notice">Hidden from navigation means it won’t appear in this site menu. It is not private: after publishing, anyone with its direct URL may be able to visit it.</div>
          </div> : <div className="website-preview">
            <div className="preview-nav"><strong>{businessName || selectedPage.title}</strong><span>{draft?.pages.filter((page) => page.isGenerated !== false && page.showInNavigation !== false).map((page) => <button key={page.slug} className={page.slug === selectedPage.slug ? "preview-nav-active" : ""} type="button" onClick={() => setSelectedSlug(page.slug)}>{page.label}</button>)}</span></div>
            <div className="preview-hero-layout">
              <div className="preview-hero"><span className="preview-badge">{selectedPage.label.toUpperCase()}</span><h2>{selectedPage.title}</h2><p>{selectedPage.tagline}</p><div className="preview-actions"><button>{selectedPage.primaryCta}</button><button className="outline-button">{selectedPage.secondaryCta}</button></div></div>
              {heroPhoto && <div className="preview-hero-image"><Image src={heroPhoto.url} alt={`${selectedPage.label} — ${businessName || selectedPage.title}`} width={1200} height={800} priority unoptimized /></div>}
            </div>
            <div className="preview-intro"><p>{selectedPage.intro}</p></div>
            {(photos[selectedPage.slug] || []).length > 1 && <div className="preview-photo-canvas" onPointerMove={(event) => { if (!draggingPhoto || draggingPhoto.pageSlug !== selectedPage.slug) return; const bounds = event.currentTarget.getBoundingClientRect(); const x = Math.max(0, Math.min(78, ((event.clientX - bounds.left) / bounds.width) * 100 - 10)); const y = Math.max(0, Math.min(78, ((event.clientY - bounds.top) / bounds.height) * 100 - 10)); setPhotos((current) => ({ ...current, [selectedPage.slug]: current[selectedPage.slug].map((photo) => photo.name === draggingPhoto.name ? { ...photo, x, y } : photo) })); }} onPointerUp={() => setDraggingPhoto(null)} onPointerLeave={() => setDraggingPhoto(null)}><span className="canvas-label">DRAG PHOTOS INTO PLACE</span>{photos[selectedPage.slug].slice(1).map((photo) => <Image key={photo.name + photo.url} src={photo.url} alt={photo.name} draggable={false} width={480} height={320} unoptimized style={{ left: `${photo.x ?? 5}%`, top: `${photo.y ?? 12}%` }} onError={(event) => { const fallbackUrl = (photo as Photo & { fallbackUrl?: string }).fallbackUrl; if (fallbackUrl && event.currentTarget.src !== fallbackUrl) event.currentTarget.src = fallbackUrl; }} onPointerDown={(event) => { event.preventDefault(); setDraggingPhoto({ pageSlug: selectedPage.slug, name: photo.name }); }} />)}</div>}
            {selectedPage.sections?.length ? selectedPage.sections.map((section, sectionIndex) => <section className={`preview-content-section preview-section-${section.layout}`} key={`${section.heading}-${sectionIndex}`}>
              <span className="eyebrow">0{sectionIndex + 1} / {section.layout.toUpperCase()}</span><h3>{section.heading}</h3>{section.body && <p>{section.body}</p>}
              {section.items.length > 0 && <div className="preview-section-items">{section.items.map((item, itemIndex) => <article key={`${item}-${itemIndex}`}><span>{section.layout === "faq" ? "Q&A" : `0${itemIndex + 1}`}</span><p>{item}</p></article>)}</div>}
            </section>) : <>
              <div className="preview-benefits"><span className="eyebrow">WHY CHOOSE US</span><div>{selectedPage.benefits.map((benefit, index) => <article key={benefit + index}><span>0{index + 1}</span><h3>{benefit}</h3></article>)}</div></div>
              <div className="preview-steps"><span className="eyebrow">HOW IT WORKS</span><div>{selectedPage.steps.map((step, index) => <p key={step + index}><b>0{index + 1}</b>{step}</p>)}</div></div>
            </>}
            <div className="preview-closing"><h3>{selectedPage.closing}</h3><button>{selectedPage.primaryCta}</button></div>
          </div>) : <div className="website-empty"><div>✦</div><h2>Your website preview will appear here.</h2><p>Start with the business brief on the left.</p></div>}
          {selectedPage && selectedPage.isGenerated !== false && <div className="website-publish-action">
            <span className="eyebrow">ANY PLATFORM</span>
            <strong>Wix, Squarespace, Shopify, or any host</strong>
            <p>Download every generated page as a ready-to-upload HTML site, or copy a page as embed code to paste into Wix (Embed HTML), Squarespace (code block) or any page builder.</p>
            <button className="primary-button" type="button" onClick={downloadSiteZip}>Download site (.zip) →</button>
            <button className="secondary-button" type="button" onClick={() => void copyEmbedCode()}>Copy embed code for this page</button>
          </div>}
          {selectedPage && selectedPage.isGenerated !== false && (provider === "shopify" || provider === "github-vercel") && <div className="website-publish-action">
            <span className="eyebrow">{provider === "shopify" ? "SHOPIFY" : "GITHUB"}</span>
            <strong>{provider === "shopify" ? "Create an unpublished Shopify page" : "Commit this page to a review branch"}</strong>
            <p>{provider === "shopify" ? "The page is created hidden in your store. Review and publish it in Shopify admin." : "The page is committed as HTML to a separate helloai-pages branch. Merge it to deploy through Vercel, Netlify or GitHub Pages."}</p>
            <button className="primary-button" type="button" onClick={() => void publishToProvider()} disabled={isPublishing || !providerFields.token?.trim() || (provider === "shopify" ? !providerFields.shopDomain?.trim() : !providerFields.repository?.trim())}>{isPublishing ? "Sending..." : provider === "shopify" ? "Create Shopify page →" : "Commit to GitHub →"}</button>
            {publishedDraft && publishedDraft.title === selectedPage.title && <div className="success-banner">Done. <a href={publishedDraft.editUrl} target="_blank" rel="noreferrer">Open it →</a></div>}
          </div>}
          {selectedPage && selectedPage.isGenerated !== false && provider === "wordpress" && <div className="website-publish-action">
            <span className="eyebrow">WORDPRESS</span>
            <strong>Create a reviewable draft</strong>
            <p>This sends the selected page, its section layouts and hero image to WordPress as a private draft. It will not publish the page publicly.</p>
            <label>WordPress username<input autoComplete="username" value={providerFields.username || ""} onChange={(event) => setProviderField("username", event.target.value)} placeholder="Your WordPress username" /></label>
            <button className="primary-button" type="button" onClick={createWordPressDraft} disabled={isPublishing || !providerFields.baseUrl?.trim() || !providerFields.username?.trim() || !providerFields.token?.trim()}>
              {isPublishing ? "Creating draft..." : "Create WordPress draft →"}
            </button>
            {publishedDraft && publishedDraft.title === selectedPage.title && <div className="success-banner">Draft created. <a href={publishedDraft.editUrl} target="_blank" rel="noreferrer">Review it in WordPress →</a></div>}
          </div>}
        </section>
        {selectedPage && <aside className="website-editor-panel">
          <span className="eyebrow">EDIT {selectedPage.label.toUpperCase()}</span>
          <h2>{selectedPage.isGenerated === false ? "Page plan" : "Page controls"}</h2>
          <label className="page-navigation-toggle"><input type="checkbox" checked={selectedPage.showInNavigation !== false} onChange={(event) => updateSelectedPage("showInNavigation", event.target.checked)} /><span>Show in site navigation</span></label>
          <p className="page-visibility-notice">Turn this off to keep the page out of the navigation menu. It does not make the page private; visitors may still access its direct URL after publishing. This is a site-plan preference; update WordPress menus separately.</p>
          {selectedPage.isGenerated === false ? <>
            <div className="ai-refine-panel"><span className="eyebrow">PAGE-SPECIFIC REQUEST</span><textarea value={selectedPage.request || ""} onChange={(event) => updateSelectedPage("request", event.target.value)} placeholder="Tell HelloAI what this page should cover, what to include, or what to avoid." /><button type="button" className="primary-button" onClick={() => void generateSelectedPage()} disabled={isGeneratingPage || !description.trim()}>{isGeneratingPage ? "Writing this page..." : "Generate this page →"}</button><small>HelloAI will generate only this page. You can review and edit it before creating a WordPress draft.</small></div>
          </> : <>
            <div className="ai-refine-panel"><span className="eyebrow">AI PAGE DIRECTOR</span><textarea value={refinementInstruction} onChange={(event) => setRefinementInstruction(event.target.value)} placeholder="e.g. Make this feel more premium and add a stronger booking CTA" /><button type="button" className="secondary-button" onClick={refineSelectedPage} disabled={isRefining || !refinementInstruction.trim()}>{isRefining ? "Refining page..." : "Refine with AI"}</button></div>
            <label>Headline<input value={selectedPage.title} onChange={(event) => updateSelectedPage("title", event.target.value)} /></label>
            <label>Tagline<textarea value={selectedPage.tagline} onChange={(event) => updateSelectedPage("tagline", event.target.value)} /></label>
            <label>Intro<textarea value={selectedPage.intro} onChange={(event) => updateSelectedPage("intro", event.target.value)} /></label>
            <label>Primary button<input value={selectedPage.primaryCta} onChange={(event) => updateSelectedPage("primaryCta", event.target.value)} /></label>
            <label>Secondary button<input value={selectedPage.secondaryCta} onChange={(event) => updateSelectedPage("secondaryCta", event.target.value)} /></label>
            <div className="seo-panel"><div className="seo-panel-heading"><span className="eyebrow">SEO READINESS</span><strong>{seoChecks}/4</strong></div><label>SEO title <small>{seoTitleLength}/60 characters</small><input value={selectedPage.seoTitle || ""} onChange={(event) => updateSelectedPage("seoTitle", event.target.value)} /></label><label>SEO description <small>{seoDescriptionLength}/160 characters</small><textarea value={selectedPage.seoDescription || ""} onChange={(event) => updateSelectedPage("seoDescription", event.target.value)} /></label><p>Use a clear service, location, and customer outcome. These fields become your search preview.</p></div>
            <div className="photo-upload">
              <span className="eyebrow">PAGE IMAGERY</span>
              <p>A large, industry-matched hero photo is included by default. Add your own photos or create a custom AI image.</p>
              <button type="button" className="secondary-button" onClick={() => void generateHeroImage()} disabled={isGeneratingHeroImage || !accountUserId}>
                {isGeneratingHeroImage ? "Generating image..." : accountUserId ? "Generate custom AI hero image" : "Sign in to generate an AI image"}
              </button>
              {!accountUserId && <Link href="/login">Sign in or create an account →</Link>}
              <small>AI image generation uses a paid image service and can take up to a minute. Default stock imagery is free.</small>
              <label className="upload-button">+ Add photos<input type="file" accept="image/*" multiple onChange={addPhotos} /></label>
              {(photos[selectedPage.slug] || []).map((photo, photoIndex) => <div className="uploaded-photo" key={photo.name + photo.url}>
                <Image src={photo.url} alt={photo.name} width={160} height={120} unoptimized />
                <span>{photo.name}</span>
                {photoIndex !== 0 && <button type="button" className="secondary-button" onClick={() => setPhotos((current) => {
                  const pagePhotos = current[selectedPage.slug] || [];
                  return { ...current, [selectedPage.slug]: [photo, ...pagePhotos.filter((item) => item !== photo)] };
                })}>Use as hero</button>}
                <button type="button" className="secondary-button" onClick={() => setPhotos((current) => ({
                  ...current,
                  [selectedPage.slug]: (current[selectedPage.slug] || []).filter((item) => item !== photo),
                }))}>Remove</button>
              </div>)}
            </div>
          </>}
        </aside>}
      </div>
    </main>
  );
}
