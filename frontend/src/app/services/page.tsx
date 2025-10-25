"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Search, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { getCategories, getServices } from "../../lib/api";
import { Category, Service } from "../../lib/types";

const ServiceCardSkeleton = () => (
  <div className="bg-white rounded-lg overflow-hidden animate-pulse">
    <div className="w-full aspect-[4/5] bg-light" />
    <div className="pt-4">
      <div className="h-5 w-3/4 bg-light rounded mb-2" />
      <div className="h-6 w-1/2 bg-light rounded" />
    </div>
  </div>
);

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<string>("popularity");

  useEffect(() => {
    async function fetchAllData() {
      setLoading(true);
      try {
        const [servicesData, categoriesData] = await Promise.all([
          getServices(),
          getCategories(),
        ]);
        setServices(Array.isArray(servicesData) ? servicesData : []);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setServices([]);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    }
    fetchAllData();
  }, []);

  const filteredServices = services
    .filter(s => !activeCategory || s.category_slug === activeCategory)
    .filter(s => 
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.summary.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const sortedServices = [...filteredServices].sort((a, b) => {
    const completedA = a.completed_count ?? 0;
    const completedB = b.completed_count ?? 0;
    const ratingA = a.average_rating ?? 0;
    const ratingB = b.average_rating ?? 0;
    const ratingCountA = a.rating_count ?? 0;
    const ratingCountB = b.rating_count ?? 0;

    switch (sortOption) {
      case "price_asc":
        return (a.price ?? 0) - (b.price ?? 0);
      case "price_desc":
        return (b.price ?? 0) - (a.price ?? 0);
      case "latest":
        return (b.id ?? 0) - (a.id ?? 0);
      case "popularity":
      default: {
        const popularityDiff = completedB - completedA;
        if (popularityDiff !== 0) return popularityDiff;
        const ratingCountDiff = ratingCountB - ratingCountA;
        if (ratingCountDiff !== 0) return ratingCountDiff;
        if (ratingB !== ratingA) return ratingB - ratingA;
        return (b.id ?? 0) - (a.id ?? 0);
      }
    }
  });

  const totalCount = services?.length ?? 0;
  const filteredCount = filteredServices?.length ?? 0;
  const categoryOptions = [{ id: 0, name: "All", slug: "" }, ...categories];
  const activeLabel =
    categoryOptions.find((c) => c.slug === activeCategory)?.name || "All";

  return (
    <div className="bg-white text-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-display font-semibold text-dark">Services</h1>
            <p className="mt-2 text-sm text-muted">
              Showing {filteredCount} of {totalCount} services for "{activeLabel}"
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 md:flex md:w-auto md:gap-4">
            <div className="relative w-full block lg:hidden">
              <select
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value)}
                className="w-full appearance-none rounded-md border border-accent/15 bg-light py-2 pl-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {categoryOptions.map((cat) => (
                  <option key={cat.slug || `category-${cat.id}`} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <ChevronRight
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-muted/80"
                size={16}
              />
            </div>
            
            <div className="relative w-full md:w-60">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="w-full appearance-none rounded-md border border-accent/15 bg-light py-2 pl-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="popularity">Sort by Popularity</option>
                <option value="latest">Sort by Latest</option>
                <option value="price_asc">Sort by Price: Low to High</option>
                <option value="price_desc">Sort by Price: High to Low</option>
              </select>
              <ChevronRight
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-muted/80"
                size={16}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-12">
          <aside className="w-full lg:w-1/4">
            <div className="space-y-8 lg:sticky lg:top-24">
              <div className="relative">
                <input
                    type="text"
                    placeholder="Search services..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-accent/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/60" size={20}/>
              </div>
              
              <div className="hidden lg:block">
                <h3 className="font-semibold mb-4 text-lg">Category</h3>
                <ul className="space-y-2">
                  {categoryOptions.map((cat) => (
                    <li key={cat.slug || `category-${cat.id}`}>
                      <button
                        onClick={() => setActiveCategory(cat.slug)}
                        className={`w-full flex justify-between items-center py-1.5 text-left text-dark hover:text-primary transition-colors ${
                          activeCategory === cat.slug ? "font-semibold text-primary" : ""
                        }`}
                      >
                        <span>{cat.name}</span>
                        <ChevronRight size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>

          <main className="w-full lg:w-3/4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 xl:grid-cols-3">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <ServiceCardSkeleton key={i} />)
              ) : filteredCount > 0 ? (
                sortedServices.map((s) => {
                  const averageRating = s.average_rating ?? 0;
                  const ratingCount = s.rating_count ?? 0;
                  const hasRatings = ratingCount > 0;
                  const averageDisplay = hasRatings ? averageRating.toFixed(1) : "New";
                  const completedCount = s.completed_count ?? 0;
                  const completedLabel =
                    completedCount > 0
                      ? `${new Intl.NumberFormat("id-ID").format(completedCount)} ${
                          completedCount === 1 ? "project" : "projects"
                        } completed`
                      : "Be the first to book this service";

                  return (
                    <Link href={`/services/${s.slug}`} key={s.slug} className="group flex flex-col">
                      <div className="relative w-full aspect-[4/5] bg-light rounded-lg overflow-hidden">
                        <Image
                          src={
                            s.thumbnail ||
                            `https://placehold.co/400x500/e0e0e0/333?text=${encodeURIComponent(s.title || "Service")}`
                          }
                          alt={s.title || "Service Thumbnail"}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="pt-4 flex flex-1 flex-col">
                        <h3 className="font-semibold text-dark truncate">{s.title || "Untitled"}</h3>
                        <p className="font-bold text-lg text-primary mt-1">
                          {Intl.NumberFormat("id-ID", {
                            style: "currency",
                            currency: "IDR",
                            minimumFractionDigits: 0,
                          }).format((s.price || 0) * 15000)}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted mt-2">
                          <div className="flex items-center gap-1">
                            <Star size={16} className="text-primary fill-primary" fill="currentColor" />
                            <span>{averageDisplay}</span>
                          </div>
                          {hasRatings ? (
                            <span className="text-xs text-muted/80">({ratingCount})</span>
                          ) : (
                            <span className="text-xs text-muted/80">No ratings yet</span>
                          )}
                        </div>
                        <p className="text-xs text-muted/80 mt-1">{completedLabel}</p>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="col-span-full text-center py-20">
                  <h3 className="text-2xl font-bold mb-4">No Services Found</h3>
                  <p className="text-muted">Try adjusting your search or category filters.</p>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}