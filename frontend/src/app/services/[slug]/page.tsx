"use client";

import { useEffect, useState, use } from "react";
import { Service, ServiceHighlight } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ShoppingCart,
  Minus,
  Plus,
  Star,
  CheckCircle,
  Sparkles,
  Clock,
  ShieldCheck,
  MessageCircle,
  Briefcase,
  Target,
  Lightbulb,
  Palette,
  Quote,
  ChevronLeft,
  Heart,
  Share2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { getServiceBySlug } from "@/lib/api";
import Button from "@/components/Button";
import { useCartStore, AddOn } from "@/store/cart";
import { trackInteraction } from "@/lib/analytics";

type Testimonial = {
  name: string;
  role?: string;
  comment: string;
  rating?: number;
};

type Highlight = ServiceHighlight;

type ServiceDetailData = Omit<Service, 'category' | 'category_slug'> & {
  category: { id: number; name: string; slug: string; };
  add_ons?: AddOn[];
  gallery_images?: string[];
  highlights?: Highlight[];
  testimonials?: Testimonial[];
};

const DEFAULT_SERVICE_HIGHLIGHTS: Highlight[] = [
  {
    title: "Signature Quality",
    description: "Meticulous storytelling, colour grading, and sound design crafted for premium campaigns.",
    icon: "sparkles",
  },
  {
    title: "Guided Collaboration",
    description: "Dedicated consultation touchpoints keep your team aligned at every project milestone.",
    icon: "message-circle",
  },
  {
    title: "Dependable Timelines",
    description: "Clear roadmaps, agile revisions, and on-time delivery anchored by professional workflows.",
    icon: "clock",
  },
];

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    name: "Ayu Pratiwi",
    role: "Marketing Lead, Studio Kupu",
    rating: 5,
    comment: "The video captured our brand energy perfectly. Communication was effortless and timelines were spot on.",
  },
  {
    name: "Raditya Mahesa",
    role: "Founder, Mahesa Property",
    rating: 5,
    comment: "They translated our complex brief into a compelling story that our clients still mention months later.",
  },
  {
    name: "Clara Nugroho",
    role: "Product Manager, NeuraTech",
    rating: 4,
    comment: "Smooth process from start to finish. Loved the creative direction and attention to detail during edits.",
  },
];

const HIGHLIGHT_ICON_MAP: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  "message-circle": MessageCircle,
  clock: Clock,
  "shield-check": ShieldCheck,
  briefcase: Briefcase,
  target: Target,
  lightbulb: Lightbulb,
  palette: Palette,
};

const ServiceDetailSkeleton = () => (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-pulse">
        <div className="h-5 w-1/3 bg-light rounded-md mb-12"></div>
        <div className="grid md:grid-cols-2 gap-12 lg:gap-16">
            <div>
                <div className="aspect-square w-full bg-light rounded-2xl mb-4"></div>
                <div className="grid grid-cols-4 gap-4">
                    <div className="aspect-square bg-light rounded-lg"></div>
                    <div className="aspect-square bg-light rounded-lg"></div>
                    <div className="aspect-square bg-light rounded-lg"></div>
                    <div className="aspect-square bg-light rounded-lg"></div>
                </div>
            </div>
            <div className="space-y-6 pt-4">
                <div className="h-5 w-1/4 bg-light rounded-md"></div>
                <div className="h-10 w-3/4 bg-light rounded-md"></div>
                <div className="h-12 w-1/3 bg-light rounded-md"></div>
                <div className="space-y-2">
                    <div className="h-4 w-full bg-light rounded-md"></div>
                    <div className="h-4 w-full bg-light rounded-md"></div>
                    <div className="h-4 w-5/6 bg-light rounded-md"></div>
                </div>
                <div className="h-14 w-full bg-light rounded-xl"></div>
            </div>
        </div>
    </div>
);

export default function ServiceDetailPage({ params: paramsPromise }: { params: Promise<{ slug: string }> }) {
  const params = use(paramsPromise);
  const addToCart = useCartStore((state) => state.addToCart);
  
  const [service, setService] = useState<ServiceDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [showNotification, setShowNotification] = useState(false);
  const [selectedAddOns, setSelectedAddOns] = useState<AddOn[]>([]);

  useEffect(() => {
    const fetchService = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getServiceBySlug(params.slug);
            setService(data);
            if (data.thumbnail) {
                setActiveImage(data.thumbnail);
            } else if (data.gallery_images && data.gallery_images.length > 0) {
                setActiveImage(data.gallery_images[0]);
            }
        } catch (err) {
            setError("Service not found or failed to load.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    fetchService();
  }, [params.slug]);

  useEffect(() => {
    if (!service) return;
    trackInteraction("product_view", {
      service_id: String(service.id),
      service_title: service.title,
      category: service.category?.name ?? "",
    });
  }, [service]);

  const handleAddOnToggle = (addOn: AddOn) => {
    setSelectedAddOns(prev =>
      prev.some(a => a.name === addOn.name)
        ? prev.filter(a => a.name !== addOn.name)
        : [...prev, addOn]
    );
  };

  const handleAddToCart = () => {
    if (!service) return;
    addToCart({
        id: service.id,
        title: service.title,
        price: service.price,
        slug: service.slug,
        img: service.thumbnail || "https://placehold.co/150x150/e0e0e0/333?text=Service",
        category: service.category.name,
    }, quantity, selectedAddOns);
    trackInteraction("add_to_cart", {
      service_id: String(service.id),
      service_title: service.title,
      quantity: String(quantity),
    });
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  if (loading) {
    return <ServiceDetailSkeleton />;
  }

  if (error || !service) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold mb-4">{error || "Service not found."}</h2>
        <Link href="/services" className="text-primary hover:underline">
          Back to Services
        </Link>
      </div>
    );
  }

  const averageRating = service.average_rating ?? 0;
  const ratingCount = service.rating_count ?? 0;
  const hasRatings = ratingCount > 0;
  const averageDisplay = hasRatings ? averageRating.toFixed(1) : "New";
  const completedCount = service.completed_count ?? 0;
  const completedLabel =
    completedCount > 0
      ? `${new Intl.NumberFormat("id-ID").format(completedCount)} ${completedCount === 1 ? "project" : "projects"} completed`
      : "Be the first to book this service";
  const gallery = [service.thumbnail, ...(service.gallery_images || [])].filter(Boolean) as string[];
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount * 15000);
  };
  const testimonials = service.testimonials && service.testimonials.length > 0 ? service.testimonials : DEFAULT_TESTIMONIALS;
  const quickHighlights: Array<{ icon: LucideIcon; label: string }> = [
     { icon: ShieldCheck, label: "High-Quality Deliverables" },
     { icon: MessageCircle, label: "Professional Consultation" },
     { icon: Clock, label: "Fast Turnaround Time" },
   ];
  const serviceHighlights: Highlight[] =
    service.highlights && service.highlights.length > 0
      ? service.highlights
      : DEFAULT_SERVICE_HIGHLIGHTS;

  const totalAddOnsPrice = selectedAddOns.reduce((sum, addon) => sum + addon.price, 0);
  const totalPrice = (service.price + totalAddOnsPrice) * quantity;

  return (
    <main className="font-sans bg-white text-dark antialiased">
      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 md:bottom-10 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-md"
          >
            <div className="flex items-center gap-3 bg-dark text-white py-3 px-6 rounded-full shadow-lg">
              <CheckCircle size={20} />
              <span className="font-semibold text-sm md:text-base">{quantity}x {service.title} added to cart!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="md:hidden sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-light transition"
          >
            <ChevronLeft size={24} className="text-dark" />
          </button>
          <div className="flex items-center gap-3">
            <button className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-light transition">
              <Share2 size={20} className="text-muted" />
            </button>
            <button className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-light transition">
              <Heart size={20} className="text-muted" />
            </button>
          </div>
        </div>
      </div>

      <div className="md:max-w-7xl md:mx-auto md:px-4 sm:px-6 lg:px-8 md:pt-12 md:pb-24">
        <section className="md:grid md:gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div className="md:block">
            <div className="relative aspect-square w-full bg-light md:rounded-2xl overflow-hidden">
              <Image
                src={activeImage || "https://placehold.co/800x800/e0e0e0/333?text=Image"}
                alt={service.title}
                fill
                className="object-cover transition-transform duration-500 hover:scale-105"
                sizes="(min-width: 1024px) 540px, 100vw"
                priority
              />
            </div>
            {gallery.length > 1 && (
              <div className="mt-0 md:mt-4 px-4 md:px-0 py-3 md:py-0 overflow-x-auto scrollbar-hide">
                <div className="flex md:grid md:grid-cols-4 gap-2 md:gap-3">
                  {gallery.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveImage(img)}
                      className={`relative flex-shrink-0 w-20 h-20 md:w-auto md:aspect-square rounded-lg md:rounded-xl overflow-hidden border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                        activeImage === img ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-accent/20"
                      }`}
                      aria-label={`Preview ${service.title} image ${index + 1}`}
                    >
                      <Image src={img} alt={`${service.title} - thumbnail ${index + 1}`} fill className="object-cover" sizes="80px" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="px-4 md:px-0 pt-4 md:pt-0 space-y-6 md:space-y-8 pb-32 md:pb-0">
            <div className="space-y-3 md:space-y-4">
              <span className="text-xs md:text-sm font-semibold text-primary uppercase tracking-wider">{service.category.name}</span>
              <h1 className="text-2xl md:text-4xl lg:text-5xl font-display font-bold text-dark leading-tight">{service.title}</h1>
              
              <div className="flex items-center justify-between md:block">
                <p className="text-2xl md:text-3xl font-semibold text-dark">{formatPrice(service.price)}</p>
                <div className="flex items-center gap-2 md:hidden">
                  <Star size={16} className="fill-primary text-primary" />
                  <span className="font-semibold text-dark text-sm">{averageDisplay}</span>
                  {hasRatings && <span className="text-xs text-muted/80">({ratingCount})</span>}
                </div>
              </div>

              <div className="hidden md:flex flex-wrap items-center gap-4 text-sm text-muted">
                <div className="flex items-center gap-2">
                  <Star size={18} className="fill-primary text-primary" />
                  <span className="font-semibold text-dark">{averageDisplay}</span>
                  {hasRatings && <span className="text-xs text-muted/80">({ratingCount})</span>}
                </div>
                <span className="text-xs text-muted">{completedLabel}</span>
              </div>

              <div className="md:hidden text-xs text-muted">{completedLabel}</div>
            </div>

            <p className="text-base md:text-lg leading-relaxed text-muted">
              {service.summary || "We craft memorable, high-performing visuals tailored to your audience."}
            </p>

            <div className="hidden md:grid gap-4 sm:grid-cols-3">
              {quickHighlights.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 text-primary">
                    <Icon size={18} />
                  </div>
                  <span className="text-sm font-semibold text-muted">{label}</span>
                </div>
              ))}
            </div>

            <div className="md:hidden flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
              {quickHighlights.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 px-3 py-2 bg-light rounded-full whitespace-nowrap flex-shrink-0">
                  <Icon size={14} className="text-primary" />
                  <span className="text-xs font-medium text-muted">{label}</span>
                </div>
              ))}
            </div>

            {service.add_ons && service.add_ons.length > 0 && (
              <div className="space-y-3 border border-slate-200 rounded-xl p-4">
                <h3 className="text-base md:text-lg font-semibold text-dark">Tailor Your Package</h3>
                <p className="text-xs md:text-sm text-muted">
                  Add optional enhancements to personalise your experience.
                </p>
                <div className="space-y-2">
                  {service.add_ons.map((addon) => (
                    <label
                      key={addon.name}
                      className="flex items-center gap-3 border border-slate-200 rounded-lg p-3 cursor-pointer hover:border-primary transition"
                    >
                      <input
                        type="checkbox"
                        onChange={() => handleAddOnToggle(addon)}
                        className="h-4 w-4 md:h-5 md:w-5 rounded border-slate-300 text-primary focus:ring-primary/40 flex-shrink-0"
                      />
                      <span className="flex-grow font-medium text-muted text-sm md:text-base">{addon.name}</span>
                      <span className="text-xs md:text-sm font-semibold text-primary/80 whitespace-nowrap">+{formatPrice(addon.price)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="hidden md:block space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center rounded-xl border border-slate-200">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-4 text-muted transition hover:text-primary disabled:opacity-40"
                    aria-label="Decrease quantity"
                    disabled={quantity <= 1}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-12 text-center text-lg font-semibold text-dark">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="p-4 text-muted transition hover:text-primary"
                    aria-label="Increase quantity"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <Button
                  size="lg"
                  className="w-full sm:flex-1"
                  onClick={handleAddToCart}
                  data-track-click="add_to_cart"
                  data-track-label={service.title}
                >
                  <ShoppingCart size={20} className="mr-2" />
                  Add to Cart
                </Button>
              </div>
              <Button
                size="lg"
                variant="outline"
                className="w-full border-slate-300 text-muted hover:border-primary hover:text-primary"
                onClick={() => window.history.back()}
              >
                <ArrowLeft size={20} className="mr-2" />
                Go Back
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-8 md:mt-16 space-y-4 md:space-y-6 px-4 md:px-0">
          <h2 className="text-xl md:text-2xl font-display font-bold text-dark">What's Included</h2>
          <div className="grid gap-4 md:gap-6 md:grid-cols-3">
            {serviceHighlights.map((highlight, index) => {
              const { title, description, icon } = highlight;
              const iconKey = icon?.toLowerCase() ?? "";
              const IconComponent = HIGHLIGHT_ICON_MAP[iconKey] ?? Sparkles;
              return (
                <div key={`${index}-${iconKey}`} className="flex gap-3 p-4 md:p-0 bg-light md:bg-transparent rounded-xl md:rounded-none md:flex-col">
                  <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full border border-primary/20 text-primary flex-shrink-0">
                    <IconComponent size={18} className="md:w-5 md:h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base md:text-lg font-semibold text-dark mb-1 md:mb-2">{title}</h3>
                    <p className="text-xs md:text-sm text-muted leading-relaxed">{description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {service.description && (
          <section className="mt-8 md:mt-16 space-y-3 md:space-y-4 px-4 md:px-0">
            <h2 className="text-xl md:text-2xl font-display font-bold text-dark">Project Overview</h2>
            <div className="prose prose-sm md:prose-lg prose-slate max-w-none text-muted">
              <div dangerouslySetInnerHTML={{ __html: service.description }} />
            </div>
          </section>
        )}

        <section className="mt-8 md:mt-16 space-y-6 md:space-y-8 px-4 md:px-0">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 md:gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-display font-bold text-dark">Client Impressions</h2>
              <p className="text-muted text-sm md:text-base mt-1 md:mt-2 max-w-2xl">
                Hear how teams like yours describe their experience partnering with us on high-impact visual stories.
              </p>
            </div>
            {hasRatings && (
              <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-primary">
                <Star size={16} className="fill-primary text-primary md:w-[18px] md:h-[18px]" />
                <span>{averageDisplay} from {ratingCount} review{ratingCount > 1 ? "s" : ""}</span>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:gap-8 md:grid-cols-2 xl:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <article key={`${testimonial.name}-${index}`} className="flex flex-col gap-3 md:gap-4 p-4 md:p-0 bg-light md:bg-transparent rounded-xl md:rounded-none">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full border border-primary/20 text-primary font-semibold text-xs md:text-sm flex-shrink-0">
                    {testimonial.name
                      .split(" ")
                      .map((part) => part.charAt(0))
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm md:text-base font-semibold text-dark truncate">{testimonial.name}</p>
                    {testimonial.role && <p className="text-xs text-muted truncate">{testimonial.role}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-primary">
                  {Array.from({ length: 5 }, (_, starIndex) => {
                    const filled = (testimonial.rating ?? 5) > starIndex;
                    return <Star key={starIndex} size={14} className={`md:w-4 md:h-4 ${filled ? "fill-primary text-primary" : "text-muted/30"}`} />;
                  })}
                </div>
                <p className="text-xs md:text-sm leading-relaxed text-muted">{testimonial.comment}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 z-30">
          <div className="flex items-end justify-between mb-2">
            <div className="flex items-center rounded-lg border border-slate-200 flex-shrink-0">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="p-2 text-muted transition hover:text-primary disabled:opacity-40"
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
              >
                <Minus size={16} />
              </button>
              <span className="w-10 text-center text-base font-semibold text-dark">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="p-2 text-muted transition hover:text-primary"
                aria-label="Increase quantity"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="flex flex-col items-end ml-auto">
              <p className="text-xs text-muted mb-0.5 leading-none">Total Price</p>
              <p className="text-lg font-bold text-dark whitespace-nowrap">{formatPrice(totalPrice)}</p>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={handleAddToCart}
            data-track-click="add_to_cart"
            data-track-label={service.title}
          >
            <ShoppingCart size={18} className="mr-2" />
            Add to Cart
          </Button>
        </div>
    </main>
  );
}
