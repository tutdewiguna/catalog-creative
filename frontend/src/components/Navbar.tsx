import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, User, ShoppingCart, History, LogIn } from "lucide-react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart";
import { useUserSession } from "@/store/userSession";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const items = useCartStore((state) => state.items);
  const user = useUserSession((state) => state.user);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Services", href: "/services" },
    { name: "About", href: "/about" },
    { name: "Gallery", href: "/gallery" },
    { name: "Contact", href: "/contact" },
  ];

  const secondaryNavLinks = user
    ? [
        { name: "My Account", href: "/account", icon: User },
        { name: "Order History", href: "/history", icon: History },
      ]
    : [
        { name: "Sign In", href: "/login", icon: LogIn },
        { name: "Sign Up", href: "/register", icon: User },
      ];

  const cartItemCount = isClient
    ? items.reduce((count, item) => count + item.quantity, 0)
    : 0;

  const isHomeRoute = pathname === "/";
  const showHeroStyle = isHomeRoute && !isScrolled && !menuOpen;

  const navLinkVariants = {
    hover: { scale: 1.05 },
    tap: { scale: 0.95 },
  };

  const mobileMenuOverlayVariants = {
    closed: { opacity: 0, transition: { duration: 0.3 } },
    open: { opacity: 1, transition: { duration: 0.3 } },
  };

  const mobileMenuPanelVariants = {
    closed: { x: "100%", transition: { type: "tween", ease: "easeOut", duration: 0.3 } },
    open: { x: "0%", transition: { type: "tween", ease: "easeIn", duration: 0.3 } },
  };

  const mobileLinkVariants = {
    closed: { opacity: 0, x: 20 },
    open: { opacity: 1, x: 0 },
  };

  const logoPath = showHeroStyle ? "/images/logo-white.svg" : "/images/logo.svg";
  const logoSize = 52;
  const desktopLinkBase = showHeroStyle
    ? "text-white/80 hover:text-white"
    : "text-dark/70 hover:text-primary";
  const desktopLinkActive = showHeroStyle
    ? "text-white font-semibold"
    : "text-primary font-semibold";
  const iconLinkBase = showHeroStyle
    ? "text-white/80 hover:text-white"
    : "text-dark/70 hover:text-primary";
  const menuButtonClasses = showHeroStyle
    ? "text-white hover:bg-white/10"
    : "text-dark/80 hover:bg-dark/5";

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-colors transition-shadow duration-300 ease-in-out h-20",
          showHeroStyle
            ? "bg-transparent text-white border-b border-transparent shadow-none"
            : "bg-white/90 dark:bg-white/95 text-dark backdrop-blur-lg",
          !showHeroStyle && isScrolled
            ? "border-b border-gray-100 dark:border-gray-800/10 shadow-sm"
            : !showHeroStyle
              ? "border-b border-transparent shadow-none"
              : null
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-between h-20">

            <div className="flex items-center">
              <Link href="/" className="flex-shrink-0">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Image
                    src={logoPath}
                    alt="Devara Creative Logo"
                    width={logoSize}
                    height={logoSize}
                    priority
                    className="h-auto"
                  />
                </motion.div>
              </Link>
            </div>

            <nav className="hidden md:flex absolute left-1/2 transform -translate-x-1/2">
              <ul className="flex items-center gap-10">
                {navLinks.map((link) => (
                  <motion.li key={link.name} variants={navLinkVariants} whileHover="hover" whileTap="tap">
                    <Link
                      href={link.href}
                      className={cn(
                        "relative text-base font-medium transition-colors duration-200 group px-1 py-1",
                        desktopLinkBase,
                        pathname === link.href && desktopLinkActive
                      )}
                    >
                      {link.name}
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </nav>

            <div className="flex items-center gap-5">
              <motion.div variants={navLinkVariants} whileHover="hover" whileTap="tap" className="hidden md:block">
                  <Link
                    href={user ? "/account" : "/login"}
                    className={cn("transition-colors duration-200", iconLinkBase)}
                    aria-label={user ? "My Account" : "Sign in"}
                  >
                    <User size={22} />
                  </Link>
              </motion.div>
              <motion.div variants={navLinkVariants} whileHover="hover" whileTap="tap" className="hidden md:block">
                 <Link
                    href="/history"
                    className={cn("transition-colors duration-200", iconLinkBase)}
                    aria-label="Order history"
                  >
                    <History size={22} />
                  </Link>
              </motion.div>

              <motion.div variants={navLinkVariants} whileHover="hover" whileTap="tap">
                <Link
                  href="/cart"
                  className={cn("relative transition-colors duration-200", iconLinkBase)}
                  aria-label="Cart"
                >
                  <ShoppingCart size={24} />
                  {cartItemCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white ring-2 ring-white"
                    >
                      {cartItemCount}
                    </motion.span>
                  )}
                </Link>
              </motion.div>

              <motion.button
                onClick={() => setMenuOpen(!menuOpen)}
                className={cn(
                  "inline-flex rounded-full p-2 transition-colors md:hidden",
                  menuButtonClasses
                )}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu-panel"
                aria-label="Toggle menu"
                type="button"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                 <AnimatePresence initial={false} mode="wait">
                  <motion.div
                    key={menuOpen ? "close-icon" : "menu-icon"}
                    initial={{ opacity: 0, rotate: -90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 90 }}
                    transition={{ duration: 0.2 }}
                  >
                    {menuOpen ? (
                      <X size={24} className="text-dark/80" />
                    ) : (
                      <Menu size={24} className={showHeroStyle ? "text-white" : "text-dark/80"} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-30 bg-black/40 md:hidden"
              variants={mobileMenuOverlayVariants}
              initial="closed"
              animate="open"
              exit="closed"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              id="mobile-menu-panel"
              className="fixed inset-y-0 right-0 z-40 w-full bg-white shadow-xl md:hidden flex flex-col"
              variants={mobileMenuPanelVariants}
              initial="closed"
              animate="open"
              exit="closed"
            >
              <div className="flex items-center justify-between h-20 px-4 border-b border-gray-100 flex-shrink-0">
                  <Link href="/" className="inline-flex items-center">
                    <Image src={logoPath} alt="Devara Creative Logo" width={40} height={40} />
                  </Link>
                   <button
                        onClick={() => setMenuOpen(false)}
                        className="p-2 text-dark/60 hover:text-dark"
                        aria-label="Close menu"
                    >
                        <X size={24} />
                    </button>
              </div>

              <motion.nav
                 className="flex-grow p-6 overflow-y-auto"
                 variants={{ open: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } }, closed: { transition: { staggerChildren: 0.05, staggerDirection: -1 } } }}
                 initial="closed"
                 animate="open"
                 exit="closed"
              >
                <ul className="space-y-1">
                  {navLinks.map((link) => (
                    <motion.li key={link.name} variants={mobileLinkVariants}>
                      <Link
                        href={link.href}
                        className={cn(
                          "block text-lg font-medium text-dark/80 transition-colors hover:text-primary rounded-md px-3 py-3",
                          { "text-primary bg-primary/5 font-semibold": pathname === link.href }
                        )}
                      >
                        {link.name}
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </motion.nav>

              <motion.div
                className="mt-auto p-6 border-t border-gray-100"
                variants={{ open: { transition: { staggerChildren: 0.05, delayChildren: 0.3 } }, closed: {} }}
                initial="closed"
                animate="open"
                exit="closed"
              >
                <ul className="space-y-2">
                  {secondaryNavLinks.map((link) => (
                    <motion.li key={link.name} variants={mobileLinkVariants}>
                      <Link
                        href={link.href}
                        className="flex items-center gap-4 text-base font-medium text-dark/70 transition-colors hover:text-primary px-3 py-2 rounded-md hover:bg-primary/5"
                      >
                        <link.icon size={20} className="opacity-70" />
                        <span>{link.name}</span>
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}