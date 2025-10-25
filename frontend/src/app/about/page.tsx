"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import AnimatedWrapper from "@/components/AnimatedWrapper";
import { getExperiences } from "@/lib/api";
import type { Experience } from "@/lib/types";
import {
  Sun,
  Waves,
  Infinity,
  Sparkles,
  Check,
  Monitor,
  Share2,
  Camera,
  Clapperboard,
  PenTool,
  Lamp,
  Palette,
  Workflow,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";

const logoElements = [
  { label: "Sun", description: "Energy & inspiration", icon: Sun },
  { label: "Wave", description: "Flow & creative harmony", icon: Waves },
  {
    label: "Continuous Line",
    description: "Connection between ideas, people, and creation",
    icon: Infinity,
  },
  { label: "Gold Color", description: "Warmth, light, and luxury", icon: Sparkles },
] as const;

const missionStatements = [
  "Fuse art, technology, and storytelling.",
  "Help brands and individuals express their best identity.",
  "Be a trusted and dedicated creative partner.",
] as const;

const heroHighlights = [
  {
    title: "Strategic storytelling",
    description: "Narratives choreographed to reveal every brand's inner light.",
  },
  {
    title: "Immersive visuals",
    description: "Cinematic design systems that feel handcrafted and timeless.",
  },
  {
    title: "Human partnerships",
    description: "Guidance rooted in empathy, collaboration, and devotion to detail.",
  },
] as const;

const coreValues = [
  "Boundless creativity",
  "Refined simplicity",
  "Consistent quality",
  "Authentic warmth",
  "Harmony between aesthetics and meaning",
] as const;

const communicationTraits = [
  "Warm, confident guidance grounded in empathy.",
  "Elegant yet clear phrasing that inspires decisive action.",
  "Inviting collaboration that honours every perspective.",
  "Professional assurance with meticulous follow-through.",
] as const;

const brandApplications = [
  {
    title: "Website",
    description: "Immersive digital experiences that feel luminous and intuitive across every screen.",
    icon: Monitor,
  },
  {
    title: "Social Media",
    description: "Story-led narratives and motion that keep audiences aligned with each new launch.",
    icon: Share2,
  },
  {
    title: "Photography",
    description: "Editorial imagery composed with sunrise warmth and purposeful art direction.",
    icon: Camera,
  },
  {
    title: "Videography",
    description: "Cinematic pacing and emotion-rich visuals that illuminate every storyline.",
    icon: Clapperboard,
  },
  {
    title: "Digital Design",
    description: "Identity systems and marketing assets refined for timeless resonance.",
    icon: PenTool,
  },
] as const;

const studioHighlights = [
  {
    title: "10+ Brand Transformations",
    description: "Tailored identities and campaigns that glow with strategic clarity.",
    icon: Lamp,
  },
  {
    title: "Global Creative Network",
    description: "Collaborating across continents with trusted artists and storytellers.",
    icon: Workflow,
  },
  {
    title: "Multidisciplinary Craft",
    description: "From design systems to motion and imagery, every touchpoint stays cohesive.",
    icon: Palette,
  },
] as const;

const colorPalette = [
  {
    name: "Devara Gold",
    hex: "#C7A645",
    meaning: "Luxury, light, creativity",
  },
  {
    name: "Deep Sea Blue",
    hex: "#0B2545",
    meaning: "Depth, trust, professionalism",
  },
  {
    name: "Pure White",
    hex: "#FFFFFF",
    meaning: "Clarity, honesty",
  },
  {
    name: "Sea Gray",
    hex: "#BFCAD0",
    meaning: "Balance, calmness",
  },
  {
    name: "Coral Sand",
    hex: "#EFD9B4",
    meaning: "Warmth, humanity",
  },
] as const;

export default function AboutPage() {
  const [experiences, setExperiences] = useState<Experience[]>([]);

  useEffect(() => {
    const fetchExperiences = async () => {
      try {
        const data = await getExperiences();
        setExperiences(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to fetch experiences:", error);
      }
    };
    fetchExperiences();
  }, []);

  const sortedExperiences = useMemo(
    () =>
      [...experiences].sort((a, b) => {
        if (a.order === b.order) {
          return a.id - b.id;
        }
        return a.order - b.order;
      }),
    [experiences],
  );

  const spotlightExperience = sortedExperiences[0];

  return (
    <main className="bg-white text-[#0B2545]">
      <section className="bg-[#0B2545] px-4 sm:px-6 pt-24 pb-20 text-white">
        <AnimatedWrapper className="mx-auto flex max-w-6xl flex-col items-center gap-12 text-center">
          <div className="w-full space-y-8 lg:w-3/4">
            <div className="space-y-6">
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
                Devara Creative
              </span>
              <h1 className="text-3xl font-[var(--font-poppins)] font-bold leading-tight sm:text-5xl">
                Designing luminous worlds for brands who lead with heart
              </h1>
              <p className="mx-auto max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
                Rooted in Bali's golden horizons, Devara Creative translates divine light into refined visual narratives that help every collaborator feel seen, guided, and ready to shine.
              </p>
            </div>
            <div className="grid gap-4 md:gap-5 md:grid-cols-3">
              {heroHighlights.map(({ title, description }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/15 bg-[#102a4a] p-5 transition duration-300 hover:border-[#C7A645]/60 hover:bg-[#12345a]"
                >
                  <div className="space-y-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#C7A645]/80">
                      {title}
                    </p>
                    <p className="text-sm leading-relaxed text-white/80">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AnimatedWrapper>
      </section>

      <section className="px-4 sm:px-6 py-20 md:py-24">
        <AnimatedWrapper className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:gap-16 lg:grid-cols-2 lg:items-center">
            <div className="space-y-8">
              <div className="space-y-3">
                <span className="inline-block text-xs font-semibold uppercase tracking-[0.35em] text-[#C7A645]">
                  Guiding Light
                </span>
                <h2 className="text-2xl font-[var(--font-poppins)] font-semibold text-[#0B2545] sm:text-3xl">
                  Brand Philosophy
                </h2>
              </div>
              <p className="text-base leading-relaxed text-[#0B2545]/80 sm:text-lg">
                "Devara" evokes divine light — a harmony of sun, sea, and spirit. The studio honours that meaning by uniting art, technology, and storytelling into luminous experiences that feel intimate, balanced, and enduring.
              </p>
              <p className="text-base leading-relaxed text-[#0B2545]/80 sm:text-lg">
                Every project is guided by mindful listening, graceful structure, and the promise that every collaborator leaves with work that glows from the inside out.
              </p>
              <div className="flex flex-wrap gap-3 pt-4">
                <div className="flex items-center gap-2 rounded-full border-2 border-[#C7A645] px-5 py-2 text-sm font-semibold text-[#0B2545]">
                  <Sparkles size={16} className="text-[#C7A645]" />
                  Inspired Motion
                </div>
                <div className="flex items-center gap-2 rounded-full border-2 border-[#0B2545] px-5 py-2 text-sm font-semibold text-[#0B2545]">
                  <Infinity size={16} />
                  Seamless Collaboration
                </div>
                <div className="flex items-center gap-2 rounded-full border-2 border-[#BFCAD0] px-5 py-2 text-sm font-semibold text-[#0B2545]">
                  <Waves size={16} />
                  Elegant Flow
                </div>
              </div>
            </div>
            <div className="relative h-[350px] sm:h-[500px] overflow-hidden rounded-3xl border-4 border-[#C7A645]">
              <Image
                src="/images/home/homepage-cover.webp"
                alt="Devara Creative studio atmosphere"
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
        </AnimatedWrapper>
      </section>

      <section className="bg-[#F8F7F4] px-4 sm:px-6 py-20 md:py-24">
        <AnimatedWrapper className="mx-auto max-w-6xl space-y-12">
          <div className="text-center">
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.35em] text-[#C7A645]">
              Studio Highlights
            </span>
            <h2 className="mt-4 text-2xl font-[var(--font-poppins)] font-semibold text-[#0B2545] sm:text-3xl">
              Crafting impact with luminous partnerships
            </h2>
          </div>
          <div className="grid gap-6 md:gap-8 md:grid-cols-3">
            {studioHighlights.map(({ title, description, icon: Icon }) => (
              <div key={title} className="space-y-4 text-center md:text-left">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#C7A645] text-[#C7A645]">
                  <Icon size={28} />
                </div>
                <h3 className="text-xl font-[var(--font-poppins)] font-semibold text-[#0B2545]">
                  {title}
                </h3>
                <p className="text-sm leading-relaxed text-[#0B2545]/75">{description}</p>
              </div>
            ))}
          </div>
        </AnimatedWrapper>
      </section>

      <section className="px-4 sm:px-6 py-20 md:py-24">
        <AnimatedWrapper className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:gap-16 lg:grid-cols-2 lg:items-center">
            <div className="order-2 lg:order-1">
              <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
                {logoElements.map(({ label, description, icon: Icon }) => (
                  <div key={label} className="space-y-3 rounded-2xl border-2 border-[#0B2545]/20 bg-white p-6">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#C7A645]/20 text-[#C7A645]">
                      <Icon size={22} />
                    </div>
                    <p className="text-lg font-semibold text-[#0B2545]">{label}</p>
                    <p className="text-sm leading-relaxed text-[#0B2545]/75">{description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="order-1 lg:order-2 space-y-8">
              <div className="space-y-3">
                <span className="inline-block text-xs font-semibold uppercase tracking-[0.35em] text-[#C7A645]">
                  Logo Narrative
                </span>
                <h2 className="text-2xl font-[var(--font-poppins)] font-semibold text-[#0B2545] sm:text-3xl">
                  Logo Meaning
                </h2>
              </div>
              <p className="text-sm leading-relaxed text-[#0B2545]/80 sm:text-base">
                The emblem captures dawn reflecting on calm tides — a continual reminder that creativity is a living dialogue between light and motion.
              </p>
              <p className="text-sm leading-relaxed text-[#0B2545]/75 sm:text-base">
                Each element is a directional beam, guiding collaborators through clarity, warmth, and inspiration.
              </p>
            </div>
          </div>
        </AnimatedWrapper>
      </section>

      <section className="bg-[#0B2545] px-4 sm:px-6 py-20 md:py-24 text-white">
        <AnimatedWrapper className="mx-auto max-w-6xl">
          <div className="mb-12 sm:mb-16 space-y-4 text-center">
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.35em] text-[#C7A645]">
              Our Philosophy
            </span>
            <h2 className="text-3xl font-[var(--font-poppins)] font-bold text-white sm:text-4xl lg:text-5xl">
              Our Guiding Light
            </h2>
            <p className="mx-auto max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
              Our vision, mission, and core values are the constellation that guides every project, ensuring every collaboration glows with strategy and soul.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-5 lg:gap-16">
            <div className="space-y-12 lg:col-span-3">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-3 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
                  Vision
                </div>
                <h3 className="text-2xl font-[var(--font-poppins)] font-semibold sm:text-3xl">
                  Illuminate every story with purposeful radiance
                </h3>
                <p className="text-base leading-relaxed text-white/80 sm:text-lg">
                  To illuminate the world with elegant, meaningful visual creations that resonate far beyond the moment they are experienced.
                </p>
              </div>

              <div className="space-y-5">
                <div className="inline-flex items-center gap-3 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
                  Mission
                </div>
                <h3 className="text-2xl font-[var(--font-poppins)] font-semibold sm:text-3xl">
                  Craft collaborations that glow
                </h3>
                <ul className="space-y-4 pt-2 text-sm leading-relaxed text-white/80 sm:text-base">
                  {missionStatements.map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#C7A645] text-[#0B2545]">
                        <Check size={14} strokeWidth={3} />
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-3 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
                  Core Values
                </div>
                <h3 className="text-2xl font-[var(--font-poppins)] font-semibold sm:text-3xl">
                  Our Constellation
                </h3>
                <p className="text-sm leading-relaxed text-white/80 sm:text-base">
                  These principles are the foundation of our craft and collaborations.
                </p>
                <div className="space-y-4 pt-4">
                  {coreValues.map((value) => (
                    <div key={value}>
                      <div className="flex items-center gap-4">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#C7A645]/20 text-[#C7A645]">
                          <Sparkles size={20} />
                        </span>
                        <span className="text-sm font-medium text-white/90 sm:text-base">{value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </AnimatedWrapper>
      </section>

      <section className="px-4 sm:px-6 py-20 md:py-24 bg-[#F8F7F4]">
        <AnimatedWrapper className="mx-auto grid max-w-6xl gap-10 lg:gap-12 lg:grid-cols-2 lg:items-center">
          <div className="space-y-8">
            <div className="space-y-3">
              <span className="inline-block text-xs font-semibold uppercase tracking-[0.35em] text-[#C7A645]">
                About Me
              </span>
              <h2 className="text-2xl font-[var(--font-poppins)] font-semibold text-[#0B2545] sm:text-3xl">
                Founder Spotlight
              </h2>
            </div>
            {spotlightExperience ? (
              <div className="space-y-5">
                <div className="inline-flex items-center gap-3 rounded-full border-2 border-[#C7A645] px-5 py-2 text-sm font-medium text-[#C7A645]">
                  <span>{spotlightExperience.period}</span>
                  <span className="h-3 w-px bg-[#C7A645]/40" />
                  <span>{spotlightExperience.title}</span>
                </div>
                {spotlightExperience.company && (
                  <p className="text-sm font-semibold text-[#0B2545] sm:text-base">
                    {spotlightExperience.company}
                  </p>
                )}
                <p className="text-sm leading-relaxed text-[#0B2545]/80 sm:text-base">
                  {spotlightExperience.description}
                </p>
                <p className="text-sm leading-relaxed text-[#0B2545]/80 sm:text-base">
                  Devara Creative nurtures this journey into a dedicated studio practice, pairing heartfelt storytelling with precise execution so every collaborator feels seen, guided, and illuminated.
                </p>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-[#0B2545]/70 sm:text-base">Coming Soon.</p>
            )}
          </div>
          <div className="relative h-[350px] sm:h-[500px] overflow-hidden rounded-3xl">
            <Image
              src="/images/home/homepage-cover.webp"
              alt="Devara Creative studio atmosphere"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 border-4 border-[#0B2545] rounded-3xl pointer-events-none" />
          </div>
        </AnimatedWrapper>
      </section>

      <section className="px-4 sm:px-6 py-20 md:py-24">
        <AnimatedWrapper className="mx-auto max-w-6xl space-y-10">
          <div className="space-y-3 text-center">
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.35em] text-[#C7A645]">
              Work Experience
            </span>
            <h2 className="text-2xl font-[var(--font-poppins)] font-semibold text-[#0B2545] sm:text-3xl">
              A timeline of illuminated collaborations
            </h2>
          </div>
          {sortedExperiences.length > 0 ? (
            <div className="mx-auto max-w-3xl">
              {sortedExperiences.map((item, index) => (
                <div
                  key={item.id}
                  className="flex gap-4 sm:gap-6"
                >
                  <div className="flex w-6 flex-col items-center">
                    <div className="h-5 w-5 flex-shrink-0 rounded-full border-4 border-white bg-[#C7A645] shadow-md" />
                    {index !== sortedExperiences.length - 1 && (
                      <div className="mt-1 w-0.5 flex-1 bg-[#C7A645]/30" />
                    )}
                  </div>
                  <div className={`-mt-1.5 flex-1 ${index === sortedExperiences.length - 1 ? 'pb-0' : 'pb-10 sm:pb-12'}`}>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#C7A645]">
                      {item.period}
                    </p>
                    <h3 className="mt-2 text-lg font-[var(--font-poppins)] font-semibold text-[#0B2545] sm:text-xl">
                      {item.title}
                    </h3>
                    {item.company && (
                      <p className="mt-1 text-sm font-medium text-[#0B2545]/75">{item.company}</p>
                    )}
                    <p className="mt-3 text-sm leading-relaxed text-[#0B2545]/80">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm leading-relaxed text-[#0B2545]/70 sm:text-base">Coming Soon.</p>
          )}
        </AnimatedWrapper>
      </section>

      <section className="bg-[#0B2545] px-4 sm:px-6 py-20 md:py-24 text-white">
        <AnimatedWrapper className="mx-auto max-w-6xl space-y-12">
          <div className="space-y-3 text-center">
            <h2 className="text-2xl font-[var(--font-poppins)] font-semibold sm:text-3xl">
              Color Palette
            </h2>
            <p className="text-sm leading-relaxed text-white/75 sm:text-base">
              A spectrum of light and depth that keeps the brand warm, elegant, and trustworthy.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-5">
            {colorPalette.map((color) => (
              <div
                key={color.hex}
                className="overflow-hidden rounded-2xl border-2 border-white/20 bg-white/5 p-4 sm:p-5 text-left"
              >
                <div
                  className="h-20 sm:h-24 w-full rounded-xl mb-4"
                  style={{ backgroundColor: color.hex }}
                />
                <div className="space-y-2">
                  <p className="text-base font-semibold sm:text-lg">{color.name}</p>
                  <p className="text-xs uppercase tracking-[0.25em] text-white/70">{color.hex}</p>
                  <p className="text-xs sm:text-sm leading-relaxed text-white/75">{color.meaning}</p>
                </div>
              </div>
            ))}
          </div>
        </AnimatedWrapper>
      </section>

      <section className="px-4 sm:px-6 py-20 md:py-24">
        <AnimatedWrapper className="mx-auto max-w-5xl space-y-10">
          <div className="space-y-3 text-center">
            <h2 className="text-2xl font-[var(--font-poppins)] font-semibold text-[#0B2545] sm:text-3xl">
              Typography
            </h2>
            <p className="text-sm leading-relaxed text-[#0B2545]/80 sm:text-base">
              Poppins leads every heading with sculpted confidence, while Inter delivers warm, clear storytelling across paragraphs.
            </p>
          </div>
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            <div className="rounded-2xl border-4 border-[#C7A645] bg-white p-6 sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[#C7A645]">Headings</p>
              <p className="mt-4 text-2xl font-[var(--font-poppins)] font-semibold text-[#0B2545] sm:text-3xl">
                Poppins — sculpted, radiant, articulate.
              </p>
            </div>
            <div className="rounded-2xl border-4 border-[#0B2545] bg-white p-6 sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[#0B2545]">Body</p>
              <p className="mt-4 text-sm leading-relaxed text-[#0B2545]/80 sm:text-base">
                Inter — poised, approachable, and effortless to read across long-form copy, captions, and user interfaces.
              </p>
            </div>
          </div>
        </AnimatedWrapper>
      </section>

      <section className="bg-[#F8F7F4] px-4 sm:px-6 py-20 md:py-24">
        <AnimatedWrapper className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-10 lg:gap-16 lg:grid-cols-2">

            <div className="space-y-10">
              <div className="space-y-3">
                <h2 className="text-2xl font-[var(--font-poppins)] font-semibold text-[#0B2545] sm:text-3xl">
                  Brand Applications
                </h2>
                <p className="text-sm leading-relaxed text-[#0B2545]/80 sm:text-base">
                  The identity radiates across every touchpoint, balancing luxury with approachability.
                </p>
              </div>
              <div className="space-y-8">
                {brandApplications.map(({ title, description, icon: Icon }) => (
                  <div
                    key={title}
                    className="flex h-full flex-start gap-4 sm:gap-5"
                  >
                    <span className="inline-flex h-11 w-11 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#C7A645]/20 text-[#C7A645]">
                      <Icon size={22} />
                    </span>
                    <div>
                      <h3 className="text-lg font-[var(--font-poppins)] font-semibold text-[#0B2545] sm:text-xl">
                        {title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-[#0B2545]/80">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-10">
              <div className="space-y-3">
                <h2 className="text-2xl font-[var(--font-poppins)] font-semibold text-[#0B2545] sm:text-3xl">
                  Communication Style
                </h2>
                <p className="text-sm leading-relaxed text-[#0B2545]/80 sm:text-base">
                  The voice of Devara Creative is a guiding light — warm, elegant, and inspiring.
                </p>
              </div>
              <div className="rounded-2xl border-2 border-[#0B2545]/10 bg-white p-6 sm:p-8 shadow-sm">
                <ul className="space-y-6">
                  {communicationTraits.map((trait) => (
                    <li
                      key={trait}
                      className="flex items-start gap-4"
                    >
                      <span className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#C7A645] text-white">
                        <Sparkles size={18} />
                      </span>
                      <span className="text-sm leading-relaxed text-[#0B2545]/80 sm:text-base">{trait}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

          </div>
        </AnimatedWrapper>
      </section>

      <section className="px-4 sm:px-6 py-16">
        <AnimatedWrapper className="mx-auto max-w-4xl space-y-8 text-center">
          <div className="mx-auto h-px w-32 bg-[#C7A645]" />
          <p className="text-xl font-[var(--font-poppins)] font-semibold text-[#0B2545] sm:text-2xl">
            Illuminate Every Creation — Light in Every Work.
          </p>
        </AnimatedWrapper>
      </section>
    </main>
  );
}