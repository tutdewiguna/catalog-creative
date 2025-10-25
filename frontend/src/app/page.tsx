"use client";

import { useRef } from "react";
import type { WheelEvent as ReactWheelEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Camera, Megaphone, PenTool, Monitor, Star } from "lucide-react";
import AnimatedWrapper from "@/components/AnimatedWrapper";

const SUNLIT_GOLD = "#C9A46A";
const essenceHighlights = [
  {
    title: "Guided by natural light",
    description:
      "We translate the poetry of sun and sea into visual systems that feel warm, grounded, and timeless.",
  },
  {
    title: "Intentional collaboration",
    description:
      "Every engagement is a calm dialogue—listening first, shaping second—so the result remains deeply yours.",
  },
  {
    title: "Designed for longevity",
    description:
      "From typography to tonal palettes, we craft identities built to evolve gracefully beyond launch day.",
  },
] as const;

const services = [
  {
    icon: Camera,
    title: "Photo / Video",
    description:
      "Cinematic imagery and film direction that capture your brand's atmosphere in luminous detail.",
  },
  {
    icon: Megaphone,
    title: "Digital Marketing",
    description:
      "Narratives, launch campaigns, and retention flows designed to nurture audiences across every touchpoint.",
  },
  {
    icon: PenTool,
    title: "Design Graphic",
    description:
      "Visual identity systems, graphic narratives, and production guidance that keep every asset cohesive and on-brand.",
  },
  {
    icon: Monitor,
    title: "Web Development",
    description:
      "Responsive websites and tailored CMS builds engineered for seamless, intuitive digital experiences.",
  },
] as const;

const showcases = [
  {
    title: "Azure Retreat Launch",
    category: "Photography",
    image:
      "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?auto=format&fit=crop&w=1200&q=80",
    description:
      "Editorial imagery composed with sunrise warmth and purposeful art direction that captured the resort's essence through golden-hour portraits and architectural stills.",
    tags: ["Portrait Photography", "Architecture", "Editorial Style"],
  },
  {
    title: "Harbor & Co. Brand Film",
    category: "Videography",
    image:
      "https://images.unsplash.com/photo-1594394489098-74ac04c0fc2e?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1470",
    description:
      "Cinematic brand narrative with emotion-rich visuals and restrained pacing that illuminated the company's journey through compelling storytelling and dynamic sequences.",
    tags: ["Brand Film", "Cinematic Edit", "Motion Design"],
  },
  {
    title: "Solstice Editorial Series",
    category: "Design Graphic",
    image:
      "https://images.unsplash.com/photo-1561070791-2526d30994b5?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=764",
    description:
      "Seasonal narratives, copy systems, and art direction that guided a brand's publishing cadence with tranquil clarity.",
    tags: ["Story Framework", "Copywriting", "Art Direction"],
  },
  {
    title: "Maritime Atelier Web Build",
    category: "Web Development",
    image:
      "https://images.unsplash.com/photo-1593720213428-28a5b9e94613?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1470",
    description:
      "Responsive commerce platform combining bespoke UX, modular CMS, and performance-first engineering for a seamless journey.",
    tags: ["Next.js", "Headless CMS", "Conversion UX"],
  },
] as const;

const testimonials = [
  {
    client: "Maya S.",
    role: "CMO, Halcyon Living",
    quote:
      "Their calm process made the launch feel effortless. The brand feels like sunlight—warm, inviting, and meticulously considered.",
    rating: 5,
  },
  {
    client: "Aruna T.",
    role: "Founder, Tide Atelier",
    quote:
      "Every deliverable was anchored in strategy and storytelling. Devara translates vision into visual poetry.",
    rating: 5,
  },
  {
    client: "Daniel H.",
    role: "Head of Product, Lumen Voyage",
    quote:
      "A rare balance of precision and soul. Our digital experience now mirrors the feeling of our product perfectly.",
    rating: 4.8,
  },
  {
    client: "Lia K.",
    role: "Creative Lead, Lumière",
    quote:
      "Their sensitivity to detail made every deliverable feel intentional. The launch landed with effortless grace.",
    rating: 4.9,
  },
  {
    client: "Raka B.",
    role: "Founder, Atelier Sora",
    quote:
      "They distilled our fragmented ideas into a clear, elegant system that still feels human and warm.",
    rating: 5,
  },
  {
    client: "Elena V.",
    role: "Curator, Nocturne Gallery",
    quote:
      "Working with Devara felt like composing a symphony—each interaction calm, precise, and emotionally resonant.",
    rating: 4.8,
  },
] as const;

export default function HomePage() {
  const testimonialsTrackRef = useRef<HTMLDivElement | null>(null);

  const handleTestimonialsWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!testimonialsTrackRef.current) {
      return;
    }

    const isScrollable =
      testimonialsTrackRef.current.scrollWidth > testimonialsTrackRef.current.clientWidth;

    if (!isScrollable) {
      return;
    }

    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      testimonialsTrackRef.current.scrollBy({
        left: event.deltaY,
        behavior: "smooth",
      });
      return;
    }

    if (Math.abs(event.deltaX) > Math.abs(event.deltaY) && event.deltaX !== 0) {
      event.preventDefault();
      testimonialsTrackRef.current.scrollBy({
        left: event.deltaX,
        behavior: "smooth",
      });
    }
  };

  return (
    <main className="bg-white text-[#1C2A3A] font-[var(--font-poppins)]">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/home/homepage-cover.webp"
            alt="Devara Creative hero background"
            fill
            priority
            className="object-cover scale-[1.03] brightness-90"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/55 to-black/65 backdrop-blur-md" />
        </div>
        <div className="relative mx-auto flex min-h-screen min-h-[100svh] max-w-5xl flex-col items-center justify-center px-6 text-center text-white">
          <AnimatedWrapper delay={0.1} className="space-y-6">
            <span className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
              Devara Creative
            </span>
            <h1 className="text-4xl leading-tight sm:text-5xl md:text-6xl lg:text-7xl font-[var(--font-poppins)] font-bold">
              Illuminate Every Creation
            </h1>
            <p className="mx-auto max-w-2xl text-base text-white/80 sm:text-lg">
              We craft cinematic, soul-led brand and digital experiences that glow with emotion,
              precision, and calm.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/services"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#caa367] px-8 py-3 text-base font-semibold text-white transition hover:bg-[#b88f4f]"
              >
                Discover Our Services
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#caa367] px-8 py-3 text-base font-semibold text-[#caa367] transition hover:bg-[#caa367]/10"
              >
                Let’s Create Together
              </Link>
            </div>
          </AnimatedWrapper>
        </div>
      </section>

      {/* Brand Essence */}
      <section className="bg-white px-6 py-24 md:py-28">
        <AnimatedWrapper className="mx-auto max-w-5xl space-y-12">
          <div className="text-center space-y-6">
            <span className="text-xs font-semibold uppercase tracking-[0.35em] text-[#B1926A]">
              The Devara Tone
            </span>
            <h2 className="text-3xl leading-snug sm:text-4xl font-[var(--font-poppins)] font-bold">
              Luminous, human experiences where elegance meets ease.
            </h2>
            <p className="mx-auto max-w-3xl text-base leading-relaxed text-[#445064] sm:text-lg">
              Our studio believes every brand carries a quiet light. We reveal it with intentional
              strategy, poetic visuals, and calm digital touchpoints that feel like pages from a
              design magazine.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {essenceHighlights.map(({ title, description }, index) => (
              <AnimatedWrapper
                key={title}
                delay={index * 0.08}
                className="rounded-2xl border border-[#e8ddca] bg-white px-6 py-6 text-left shadow-[0_14px_35px_rgba(23,45,68,0.05)]"
              >
                <h3 className="text-lg font-semibold font-[var(--font-poppins)]">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#445064]">{description}</p>
              </AnimatedWrapper>
            ))}
          </div>
        </AnimatedWrapper>
      </section>

      {/* Services */}
      <section className="relative overflow-hidden bg-white px-6 py-24 md:py-32">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-white"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 right-[-8%] h-56 w-56 rounded-full bg-white opacity-40 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[-22%] left-[-12%] h-72 w-72 rounded-full bg-white opacity-50 blur-3xl"
        />
        <AnimatedWrapper className="relative mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.48fr)_minmax(0,1fr)] lg:items-start">
            <AnimatedWrapper className="space-y-6">
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-[#B1926A]">
                Services
              </span>
              <h2 className="mt-4 text-3xl leading-tight text-[#1C2A3A] sm:text-4xl font-[var(--font-poppins)] font-bold">
                The practice that guides every engagement.
              </h2>
              <p className="text-sm leading-relaxed text-[#46566B] sm:text-base">
                Every service is crafted as a bespoke journey—from strategy to digital execution—so
                your brand feels composed, warm, and unmistakably you.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#d8c5ac] bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.25em] text-[#8C7757]">
                  crafted with care
                </span>
                <Link
                  href="/services"
                  className="inline-flex items-center gap-2 rounded-full bg-[#cba874] px-5 py-2 text-sm font-semibold text-[#1C2A3A] transition hover:bg-[#b9965e]"
                >
                  Discover Our Services
                  <ArrowRight size={18} />
                </Link>
              </div>
            </AnimatedWrapper>
            <div className="grid gap-6 sm:grid-cols-2">
              {services.map(({ icon: Icon, title, description }, index) => (
                <AnimatedWrapper
                  key={title}
                  delay={index * 0.12}
                  className="group relative flex h-full flex-col gap-6 overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-7 shadow-[0_22px_48px_rgba(23,45,68,0.08)] backdrop-blur-sm transition duration-300 "
                >
                  <span className="absolute -top-7 right-6 text-6xl font-semibold text-[#f1e4d3]/60 font-[var(--font-poppins)]">
                    0{index + 1}
                  </span>
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d7a86e] text-[#1C2A3A] shadow-[0_12px_24px_rgba(201,164,106,0.35)] transition duration-300">
                      <Icon size={22} strokeWidth={1.6} />
                    </div>
                    <span className="text-xs uppercase tracking-[0.4em] text-[#b89667]/70">
                      service
                    </span>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-[#1E2A3A] font-[var(--font-poppins)]">
                      {title}
                    </h3>
                    <p className="text-sm leading-relaxed text-[#445064]">{description}</p>
                  </div>
                  <div className="h-px w-full bg-[#e8d7c0]" />
                </AnimatedWrapper>
              ))}
            </div>
          </div>
        </AnimatedWrapper>
      </section>

      {/* Selected Works */}
      <section className="relative overflow-hidden bg-white py-24 md:py-28">
        <div className="space-y-12">
          <AnimatedWrapper className="space-y-4 px-6 text-center lg:px-8">
            <span className="mx-auto inline-flex items-center justify-center rounded-full border border-[#d9c8af] bg-white px-6 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-[#B1926A]">
              Selected Works
            </span>
            <h2 className="mx-auto max-w-3xl text-3xl leading-tight sm:text-4xl font-[var(--font-poppins)] font-bold">
              A glimpse at how our studio activates each core service.
            </h2>
            <p className="mx-auto max-w-xl text-sm leading-relaxed text-[#4A5666] sm:text-base">
              Every engagement blends calm strategy, modern craft, and results you can measure.
            </p>
          </AnimatedWrapper>

          <div className="px-6 lg:px-8">
            <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 lg:grid-cols-4">
              {showcases.map(({ title, category, image, description, tags }, index) => (
                <AnimatedWrapper
                  key={title}
                  delay={index * 0.08}
                  className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-[#e4d7c4] bg-white shadow-[0_18px_42px_rgba(23,45,68,0.08)] transition duration-500"
                >
                  <div className="relative aspect-[3/2] overflow-hidden">
                    <Image
                      src={image}
                      alt={title}
                      fill
                      className="object-cover transition duration-700"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 25vw, 20vw"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 transition duration-500" />
                  </div>
                  <div className="flex flex-1 flex-col gap-6 p-7">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-[#B1926A]">
                        <span>{category}</span>
                        <span className="text-[#9a8364]">{String(index + 1).padStart(2, "0")}</span>
                      </div>
                      <h3 className="text-xl font-semibold text-[#1C2A3A] font-[var(--font-poppins)]">
                        {title}
                      </h3>
                      <p className="text-sm leading-relaxed text-[#4A5666]">{description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.28em] text-[#6F7A88]">
                      {tags.map((tag) => (
                        <span
                          key={`${title}-${tag}`}
                          className="rounded-full border border-[#e2d5c3] px-3 py-1"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </AnimatedWrapper>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-white py-24 md:py-28">
        <AnimatedWrapper className="space-y-16">
          <div className="px-6 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.35em] text-[#B1926A]">
              Editorial Notes
            </span>
            <h2 className="mt-5 text-3xl leading-tight sm:text-4xl font-[var(--font-poppins)] font-bold">
              Words from the brands we've illuminated.
            </h2>
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white via-white/70 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white via-white/70 to-transparent" />
            <div
              ref={testimonialsTrackRef}
              onWheel={handleTestimonialsWheel}
              onWheelCapture={handleTestimonialsWheel}
              className="overflow-x-auto pb-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              style={{ overscrollBehavior: "contain" }}
            >
              <div className="flex w-max gap-8 px-6 sm:px-10 lg:px-16">
                {testimonials.map(({ client, role, quote, rating }, index) => (
                  <AnimatedWrapper key={client} delay={index * 0.08}>
                    <blockquote className="group relative flex h-full w-[320px] flex-col justify-between rounded-[2.25rem] border border-[#e8ddca] bg-white/95 px-8 py-9 text-left shadow-[0_18px_48px_rgba(23,45,68,0.06)] transition duration-300  sm:w-[360px]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[#CBAE7A]">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={`${client}-${idx}`}
                              size={16}
                              className={
                                idx + 1 <= Math.round(rating)
                                  ? "fill-current text-[#CBAE7A]"
                                  : "text-[#d9c7a7] fill-transparent"
                              }
                            />
                          ))}
                        </div>
                        <span className="rounded-full bg-[#f6efe2] px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[#8C7757]">
                          {rating.toFixed(1)}
                        </span>
                      </div>
                      <p className="mt-6 text-base leading-relaxed text-[#374157] sm:text-lg">
                        {quote}
                      </p>
                      <div className="mt-8 border-t border-[#f0e5d4]" />
                      <div className="mt-6 text-sm font-semibold text-[#1C2A3A]">
                        {client}
                      </div>
                      <div className="text-xs uppercase tracking-[0.28em] text-[#7B8797]">
                        {role}
                      </div>
                    </blockquote>
                  </AnimatedWrapper>
                ))}
              </div>
            </div>
          </div>
        </AnimatedWrapper>
      </section>

      {/* CTA */}
      <section className="bg-[#1E3D59] px-6 py-24 md:py-28 text-[#F1F6FB]">
        <AnimatedWrapper className="mx-auto max-w-4xl space-y-8 text-center">
          <h2 className="text-3xl leading-tight text-white sm:text-4xl font-[var(--font-poppins)]">
            Ready to craft something luminous?
          </h2>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-[#E3EAF2] sm:text-lg">
            Share your story, inspiration, or simply the feeling you want to evoke. We’ll compose a
            tailored roadmap to bring it into the world.
          </p>
          <div className="flex justify-center">
            <a
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-[#caa367] px-8 py-3 text-base font-semibold text-[#1E2A3A] transition hover:bg-[#bd9452]"
            >
              Start a Project
              <ArrowRight size={18} />
            </a>
          </div>
        </AnimatedWrapper>
      </section>
    </main>
  );
}
