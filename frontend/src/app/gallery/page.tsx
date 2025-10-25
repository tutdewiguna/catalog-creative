"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import AnimatedWrapper from "@/components/AnimatedWrapper";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import GalleryLightbox from "@/components/GalleryLightbox";
import { GalleryItem } from "@/lib/types";
import { getGallery } from "@/lib/api";
import { X, Camera, Film, Palette, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

type GalleryResponse = {
  items?: GalleryItem[];
  filters?: string[];
};

const SECTION_TITLES: Record<GalleryItem["section"], string> = {
  photography: "Photography",
  videography: "Videography",
  design: "Design",
  web: "Web Development",
};

const SECTION_SUBTEXT: Record<GalleryItem["section"], string> = {
  photography:
    "Evocative stills shaped by natural light and quiet compositions.",
  videography:
    "Cinematic narratives that breathe with emotion and restrained pacing.",
  design:
    "Identity explorations translated into visuals, layouts, and tactile assets.",
  web:
    "Digital experiences crafted with clarity, emotion, and purposeful flow.",
};

const SECTION_HEADLINES: Record<GalleryItem["section"], string> = {
  photography: "Light-led frames with quiet resonance.",
  videography: "Films that glow with feeling.",
  design: "Identity systems with tactile nuance.",
  web: "Digital canvases for thoughtful brands.",
};

const SECTION_ORDER: GalleryItem["section"][] = [
  "photography",
  "videography",
  "design",
  "web",
];

const SECTION_ICONS: Record<GalleryItem["section"], any> = {
  photography: Camera,
  videography: Film,
  design: Palette,
  web: Globe,
};

function isGalleryItem(value: unknown): value is GalleryItem {
  return typeof value === "object" && value !== null && "id" in value && "section" in value;
}

function extractFilters(items: GalleryItem[]): string[] {
  const set = new Map<string, string>();
  items
    .filter((item) => item.section === "photography")
    .forEach((item) => {
      (item.filters ?? []).forEach((filter) => {
        const trimmed = filter.trim();
        if (!trimmed) return;
        const lowered = trimmed.toLowerCase();
        if (!set.has(lowered)) {
          set.set(lowered, trimmed);
        }
      });
    });
  return Array.from(set.values()).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
}

function normalizeVideoLink(link?: string | null) {
  if (!link) return "";
  return link.replace("view?usp=sharing", "preview").replace("/view", "/preview");
}

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [filters, setFilters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] = useState("All");
  const [activeSection, setActiveSection] = useState<GalleryItem["section"]>("photography");
  const [lightboxItem, setLightboxItem] = useState<GalleryItem | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [activeVideo, setActiveVideo] = useState<GalleryItem | null>(null);

  const openLightbox = useCallback((item: GalleryItem, index = 0) => {
    if (!item.assets || !item.assets.length) return;
    setLightboxItem(item);
    setLightboxIndex(index);
  }, []);

  const openVideoModal = useCallback((item: GalleryItem) => {
    setActiveVideo(item);
  }, []);

  const handleItemClick = useCallback(
    (item: GalleryItem) => {
      const assets = item.assets ?? [];

      switch (item.section) {
        case "videography":
          if (item.video_url) {
            openVideoModal(item);
            return;
          }
          break;
        case "design":
          if (item.display_mode === "pdf" && assets[0]?.url) {
            if (typeof window !== "undefined") {
              window.open(assets[0].url, "_blank", "noopener,noreferrer");
            }
            return;
          }
          break;
        case "web":
          if (item.link_url) {
            if (typeof window !== "undefined") {
              window.open(item.link_url, "_blank", "noopener,noreferrer");
            }
            return;
          }
          break;
      }

      if (assets.length) {
        openLightbox(item, 0);
      }
    },
    [openLightbox, openVideoModal]
  );

  useEffect(() => {
    let isMounted = true;
    async function fetchGallery() {
      setLoading(true);
      try {
        const response = (await getGallery()) as GalleryResponse | GalleryItem[];
        let incomingItems: GalleryItem[] = [];
        let incomingFilters: string[] = [];
        if (Array.isArray(response)) {
          incomingItems = response.filter(isGalleryItem);
        } else if (response && typeof response === "object") {
          if (Array.isArray(response.items)) {
            incomingItems = response.items.filter(isGalleryItem);
          }
          if (Array.isArray(response.filters)) {
            incomingFilters = response.filters
              .map((filter) => filter.trim())
              .filter(Boolean);
          }
        }
        if (isMounted) {
          setItems(incomingItems);
          setFilters(
            incomingFilters.length
              ? incomingFilters
              : extractFilters(incomingItems)
          );
        }
      } catch (err) {
        console.warn("Failed to load gallery:", err);
        if (isMounted) {
          setError("We couldn't load the gallery right now. Please try again shortly.");
          setItems([]);
          setFilters([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchGallery();
    return () => {
      isMounted = false;
    };
  }, []);

  const itemsBySection = useMemo(() => {
    const grouped: Record<GalleryItem["section"], GalleryItem[]> = {
      photography: [],
      videography: [],
      design: [],
      web: [],
    };
    for (const item of items) {
      grouped[item.section]?.push(item);
    }
    return grouped;
  }, [items]);

  const photographyFilters = useMemo(() => {
    const unique = filters.length ? filters : extractFilters(items);
    return ["All", ...unique];
  }, [filters, items]);

  const filteredPhotography = useMemo(() => {
    const photographyItems = itemsBySection.photography;
    if (activeFilter === "All") {
      return photographyItems;
    }
    const lowered = activeFilter.toLowerCase();
    return photographyItems.filter((item) =>
      (item.filters ?? []).some((filter) => filter.toLowerCase() === lowered)
    );
  }, [itemsBySection.photography, activeFilter]);

  useEffect(() => {
    if (activeSection !== "photography") {
      setActiveFilter("All");
    }
  }, [activeSection]);

  const renderEmptyState = (message: string) => (
    <AnimatedWrapper className="mx-auto max-w-3xl rounded-[2rem] border border-[#1E3D59]/10 bg-white/80 p-10 sm:p-12 text-center text-[#445064] shadow-[0_24px_48px_rgba(20,32,47,0.08)]">
      <p className="text-sm sm:text-base">{message}</p>
    </AnimatedWrapper>
  );

  const renderSectionContent = () => {
    const sectionItems = itemsBySection[activeSection] ?? [];

    if (activeSection === "photography") {
      const totalPhotographyItems = sectionItems.length;
      const displayItems = filteredPhotography;
      if (totalPhotographyItems === 0) {
        return renderEmptyState("No photography entries yet. Please check back soon.");
      }
      if (displayItems.length === 0) {
        return renderEmptyState("No collections match this filter. Try selecting another mood.");
      }
      return (
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4 xl:grid-cols-5">
          {displayItems.map((item) => (
            <AnimatedWrapper
              key={item.id}
              delay={0.05}
              className="group relative cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[1.75rem] border border-[#1E3D59]/15 bg-white shadow-[0_28px_56px_rgba(17,29,46,0.1)] transition duration-500 hover:-translate-y-2 hover:shadow-[0_36px_72px_rgba(17,29,46,0.16)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C9A46A]"
              onClick={() => handleItemClick(item)}
            >
              <div className="relative h-40 w-full sm:h-56">
                <Image
                  src={item.thumbnail}
                  alt={item.title}
                  fill
                  className="object-cover transition duration-700 group-hover:scale-105"
                  sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 768px) 45vw, 45vw"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A1F33]/85 via-transparent to-transparent opacity-100 transition duration-500" />
              <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 text-white">
                <h3 className="text-sm font-semibold sm:text-lg">{item.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-white/80">{item.subtitle}</p>
              </div>
            </AnimatedWrapper>
          ))}
        </div>
      );
    }

    if (activeSection === "videography") {
      if (sectionItems.length === 0) {
        return renderEmptyState("No videography entries yet. New films will appear here soon.");
      }
      return (
        <div className="grid grid-cols-2 gap-4 sm:gap-8 xl:grid-cols-4">
          {sectionItems.map((item) => (
            <AnimatedWrapper
              key={item.id}
              delay={0.05}
              className="group relative cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[1.75rem] border border-[#0D2438]/25 bg-[#0D2438] shadow-[0_40px_88px_rgba(13,36,56,0.28)] transition duration-500 hover:-translate-y-1.5 hover:shadow-[0_48px_104px_rgba(13,36,56,0.32)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C9A46A]"
              onClick={() => handleItemClick(item)}
            >
              <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
                <Image
                  src={item.thumbnail}
                  alt={item.title}
                  fill
                  className="object-cover transition duration-700 group-hover:scale-105"
                  sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 768px) 45vw, 45vw"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#020B14]/90 via-[#020B14]/20 to-transparent opacity-100 transition duration-500" />
              <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 text-white">
                <h3 className="text-sm font-semibold tracking-wide sm:text-lg">{item.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-white/80">{item.subtitle}</p>
              </div>
            </AnimatedWrapper>
          ))}
        </div>
      );
    }

    if (activeSection === "design") {
      if (sectionItems.length === 0) {
        return renderEmptyState("No design case studies yet. Studio updates will appear soon.");
      }
      return (
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4 xl:grid-cols-5">
          {sectionItems.map((item) => (
            <AnimatedWrapper
              key={item.id}
              delay={0.05}
              className="group relative cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[1.75rem] border border-[#1E3D59]/15 bg-white/80 shadow-[0_30px_60px_rgba(18,32,49,0.16)] transition duration-500 hover:-translate-y-2 hover:shadow-[0_38px_80px_rgba(18,32,49,0.22)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C9A46A]"
              onClick={() => handleItemClick(item)}
            >
              <div className="relative h-40 w-full sm:h-56 bg-[#1E3D59]/5">
                <Image
                  src={item.thumbnail}
                  alt={item.title}
                  fill
                  className="object-cover transition duration-700 group-hover:scale-105"
                  sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 768px) 45vw, 45vw"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A1F33]/85 via-[#0A1F33]/20 to-transparent opacity-100 transition duration-500" />
              <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 text-white">
                <h3 className="text-sm font-semibold sm:text-lg">{item.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-white/80">{item.subtitle}</p>
              </div>
            </AnimatedWrapper>
          ))}
        </div>
      );
    }

    if (activeSection === "web") {
      if (sectionItems.length === 0) {
        return renderEmptyState("No web builds available yet. New launches will appear here soon.");
      }
      return (
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4 xl:grid-cols-5">
          {sectionItems.map((item) => (
            <AnimatedWrapper
              key={item.id}
              delay={0.05}
              className="group relative cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[1.75rem] border border-[#1E3D59]/15 bg-white shadow-[0_32px_64px_rgba(20,32,47,0.14)] transition duration-500 hover:-translate-y-2 hover:shadow-[0_40px_90px_rgba(20,32,47,0.22)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C9A46A]"
              onClick={() => handleItemClick(item)}
            >
              <div className="relative h-40 w-full sm:h-56">
                <Image
                  src={item.thumbnail}
                  alt={item.title}
                  fill
                  className="object-cover transition duration-700 group-hover:scale-105"
                  sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 768px) 45vw, 45vw"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A1F33]/85 via-[#0A1F33]/20 to-transparent opacity-100 transition duration-500" />
              <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 text-white">
                <h3 className="text-sm font-semibold sm:text-lg">{item.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-white/80">{item.subtitle}</p>
              </div>
            </AnimatedWrapper>
          ))}
        </div>
      );
    }

    return null;
  };

  const navigateLightbox = useCallback(
    (direction: "prev" | "next") => {
      if (!lightboxItem) return;
      const assets = lightboxItem.assets ?? [];
      if (!assets.length) return;
      setLightboxIndex((prev) => {
        if (direction === "prev") {
          return prev === 0 ? assets.length - 1 : prev - 1;
        }
        return prev === assets.length - 1 ? 0 : prev + 1;
      });
    },
    [lightboxItem]
  );

  const selectLightboxIndex = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  const closeVideoModal = useCallback(() => {
    setActiveVideo(null);
  }, []);

  return (
    <main className="bg-[#F8F7F4] text-[#1C2A3A]">
      <section className="relative overflow-hidden bg-[#E3EBF2] px-4 sm:px-6 py-24 sm:py-32 md:py-44 min-h-[520px] md:min-h-[600px]">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2000&q=80"
            alt="Ocean horizon with golden light"
            fill
            className="object-cover opacity-60"
            priority
          />
          <div className="absolute inset-0 bg-[#1E3D59]/70 mix-blend-multiply" />
        </div>
        <PageBreadcrumb
          variant="overlay"
          className="relative z-10 mb-6"
          containerClassName="px-0 sm:px-0 items-center"
          breadcrumbClassName="justify-center"
        />
        <AnimatedWrapper
          immediate
          className="relative mx-auto flex max-w-3xl flex-col items-center space-y-5 md:space-y-6 text-center text-[#F5F7FA]"
        >
          <p className="text-xs uppercase tracking-[0.35em] text-[#E6D4B3]">
            Devara Creative Gallery
          </p>
          <h1 className="text-3xl leading-snug sm:text-5xl font-[var(--font-poppins)] font-bold">
            Where emotion meets light, and stories come alive.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-[#F0F4F8]/90 sm:text-lg">
            A living portfolio of photography, film, design, and digital experiences -
            curated from Bali and crafted for the world.
          </p>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 pt-2">
            <Link
              href="#gallery-sections"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-xs sm:px-6 sm:py-3 sm:text-sm font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-white/20"
            >
              Discover Collections
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-2.5 text-xs sm:px-6 sm:py-3 sm:text-sm font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-white/15"
            >
              Book a Project
            </Link>
          </div>
        </AnimatedWrapper>
      </section>

      {loading && (
        <section className="px-4 sm:px-6 py-20 md:py-32">
          <div className="mx-auto max-w-4xl text-center text-[#445064]">
            <p className="text-base sm:text-lg">Preparing the gallery, please hold a moment...</p>
          </div>
        </section>
      )}

      {error && !loading && (
        <section className="px-4 sm:px-6 py-20 md:py-32">
          <div className="mx-auto max-w-4xl text-center text-[#C35858]">
            <p className="text-base sm:text-lg">{error}</p>
          </div>
        </section>
      )}

      {!loading && !error && (
        <section
          id="gallery-sections"
          className="px-4 sm:px-6 py-20 md:py-32 bg-white"
        >
          <div className="mx-auto max-w-6xl space-y-8">
            <AnimatedWrapper className="space-y-6 text-center">
              <div className="flex justify-center">
                <AnimatedWrapper className="flex flex-wrap justify-center gap-2">
                  {SECTION_ORDER.map((section) => {
                    const isActive = activeSection === section;
                    const Icon = SECTION_ICONS[section];
                    return (
                      <button
                        key={section}
                        type="button"
                        onClick={() => setActiveSection(section)}
                        className={cn(
                          "inline-flex items-center justify-center rounded-full border p-3 transition",
                          isActive
                            ? "border-[#1E3D59] bg-[#1E3D59] text-white shadow-lg"
                            : "border-[#1E3D59]/15 bg-white text-[#1E3D59] hover:border-[#1E3D59] hover:bg-[#1E3D59]/10"
                        )}
                        aria-label={SECTION_TITLES[section]}
                        title={SECTION_TITLES[section]}
                      >
                        <Icon size={18} aria-hidden />
                      </button>
                    );
                  })}
                </AnimatedWrapper>
              </div>
              <p className="text-xs uppercase tracking-[0.35em] text-[#C9A46A]">
                {SECTION_TITLES[activeSection]}
              </p>
              <h2 className="text-2xl font-[var(--font-poppins)] leading-tight sm:text-3xl lg:text-4xl font-bold">
                {SECTION_HEADLINES[activeSection]}
              </h2>
              <p className="mx-auto max-w-3xl text-base leading-relaxed text-[#445064] sm:text-lg">
                {SECTION_SUBTEXT[activeSection]}
              </p>
            </AnimatedWrapper>

            {activeSection === "photography" && (
              <AnimatedWrapper className="flex flex-wrap justify-center gap-2 sm:gap-3">
                {photographyFilters.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-xs sm:px-5 sm:py-2 sm:text-sm transition",
                      activeFilter === filter
                        ? "border-[#1E3D59] bg-[#1E3D59] text-white shadow-lg"
                        : "border-[#1E3D59]/20 bg-white text-[#1E3D59] hover:border-[#1E3D59] hover:bg-[#1E3D59]/10"
                    )}
                  >
                    {filter}
                  </button>
                ))}
              </AnimatedWrapper>
            )}

            {renderSectionContent()}
          </div>
        </section>
      )}

      {lightboxItem && (
        <GalleryLightbox
          item={lightboxItem}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxItem(null)}
          onNavigate={navigateLightbox}
          onSelect={selectLightboxIndex}
        />
      )}

      {activeVideo && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl sm:rounded-[2rem] border border-white/20 bg-[#0D2438] shadow-[0_48px_96px_rgba(7,16,26,0.65)]">
            <button
              type="button"
              onClick={closeVideoModal}
              className="absolute right-3 top-3 sm:right-4 sm:top-4 z-10 inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Close video"
            >
              <X size={20} />
            </button>
            <div className="aspect-video w-full">
              <iframe
                src={normalizeVideoLink(activeVideo.video_url)}
                title={activeVideo.title}
                allow="autoplay; encrypted-media"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
            <div className="space-y-2 sm:space-y-3 p-4 sm:p-6 text-white">
              <h3 className="text-lg font-semibold sm:text-xl">{activeVideo.title}</h3>
              <p className="text-sm text-white/70">{activeVideo.subtitle}</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}