"use client";

import Link from "next/link";
import Image from "next/image";
import { Facebook, Instagram, Linkedin, Mail, MapPin, Twitter } from "lucide-react";
import { useEffect, useState } from "react";
import { getCategories } from "@/lib/api";
import { Category } from "@/lib/types";

export default function Footer() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getCategories();
        setCategories(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to fetch categories for footer:", error);
      }
    };
    fetchCategories();
  }, []);

  const footerColumns = [
    {
      heading: "Company",
      links: [
        { label: "Services", href: "/services" },
        { label: "About Us", href: "/about" },
        { label: "Contact Us", href: "/contact" },
      ],
    },
    {
      heading: "Services",
      links: categories.map((cat) => ({
        label: cat.name,
        href: `/services?category=${cat.slug}`,
      })),
    },
    {
      heading: "Gallery",
      links: [
        { label: "All Collections", href: "/gallery" },
        { label: "Photography", href: "/gallery#photography" },
        { label: "Videography", href: "/gallery#videography" },
        { label: "Design", href: "/gallery#design" },
        { label: "Web Development", href: "/gallery#web" },
      ],
    },
    {
      heading: "Account",
      links: [
        { label: "My Account", href: "/account" },
        { label: "Order History", href: "/history" },
        { label: "Cart", href: "/cart" },
        { label: "Login", href: "/login" },
      ],
    },
    {
      heading: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms & Conditions", href: "/terms" },
      ],
    },
  ];

  const socialLinks = [
    {
      href: "https://www.facebook.com/devaracreative20",
      label: "Facebook",
      Icon: Facebook,
    },
    {
      href: "https://www.instagram.com/devara.creative/",
      label: "Instagram",
      Icon: Instagram,
    },
    {
      href: "https://x.com/devaracreative",
      label: "X",
      Icon: Twitter,
    },
    {
      href: "https://www.linkedin.com/company/devara-creative",
      label: "LinkedIn",
      Icon: Linkedin,
    },
  ];

  return (
    <footer className="border-t border-accent/20 bg-white text-dark px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto pt-10 pb-6 sm:pt-12 sm:pb-8 md:pt-16 md:pb-10">
        <div className="grid grid-cols-1 gap-8 sm:gap-10 lg:gap-12 lg:grid-cols-12">
          <div className="col-span-1 lg:col-span-4 flex flex-col gap-5 sm:gap-6 items-start text-left w-full">
            <Link href="/" className="inline-flex items-center">
              <Image
                src="/images/logo.svg"
                alt="Devara Creative Logo"
                width={64}
                height={64}
                className="h-14 w-14 sm:h-16 sm:w-16 object-contain"
              />
            </Link>
            <p className="text-sm sm:text-base text-muted leading-relaxed max-w-md text-justify">
              Devara Creative was born from the belief that every idea has a light within it. We exist to help brands discover and ignite that light through exceptional design, strategy, and visual experiences.
            </p>
            <div className="w-full">
              <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-primary mb-3 sm:mb-4">
                Follow Us On
              </p>
              <div className="flex gap-2.5 sm:gap-3 justify-start flex-wrap">
                {socialLinks.map(({ href, label, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-accent/15 bg-light text-dark transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30 active:scale-95"
                  >
                    <Icon size={16} className="sm:w-[18px] sm:h-[18px]" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-1 lg:col-span-8 grid gap-8 sm:gap-6 md:gap-8 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
            {footerColumns.map((column) => (
              <div key={column.heading} className="space-y-3 sm:space-y-4 text-left min-w-0">
                <h4 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-primary">
                  {column.heading}
                </h4>
                <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-muted flex flex-col items-start">
                  {column.links.length > 0 ? (
                    column.links.map((item) => (
                      <li key={item.label} className="w-full">
                        <Link
                          href={item.href}
                          className="transition-colors duration-200 hover:text-primary inline-block truncate w-full"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))
                  ) : (
                    <li>
                      {column.heading === "Services" && (
                        <span className="text-muted/70 text-xs">Loading...</span>
                      )}
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 sm:mt-12 md:mt-16 border-t border-accent/15 pt-6 sm:pt-6 md:pt-8 text-xs sm:text-sm text-muted">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-5 md:gap-4 text-left">
            <p className="text-xs sm:text-sm">
              &copy; {new Date().getFullYear()} Devara Creative. All rights reserved.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-start sm:justify-center gap-3 sm:gap-4 md:gap-6 w-full md:w-auto">
              <a
                href="mailto:devaracreative@gmail.com"
                className="flex items-center gap-2 hover:text-primary transition-colors duration-200 text-xs sm:text-sm"
              >
                <Mail size={14} className="sm:w-4 sm:h-4 text-primary flex-shrink-0" />
                <span className="break-all sm:break-normal">devaracreative@gmail.com</span>
              </a>
              <span className="hidden sm:block text-muted/40">|</span>
              <p className="flex items-center gap-2 text-xs sm:text-sm">
                <MapPin size={14} className="sm:w-4 sm:h-4 text-primary flex-shrink-0" />
                <span>Denpasar, Indonesia</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}