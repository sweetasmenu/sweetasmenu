'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import {
  Sparkles,
  QrCode,
  Globe,
  Zap,
  Shield,
  TrendingUp,
  Users,
  Clock,
  CheckCircle,
  ArrowRight,
  Star,
  Menu,
  Upload,
  BarChart3,
  Wand2,
  Languages,
  Smartphone,
  ChevronRight,
  Play,
  X,
  ChevronDown,
  Award,
  Utensils
} from 'lucide-react';

export default function HomePage() {
  const [activeEnhancement, setActiveEnhancement] = useState(0);
  const [showComparison, setShowComparison] = useState<number | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Track scroll for navbar effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Before/After enhancement examples
  const enhancementExamples = [
    {
      id: 1,
      name: 'Sweet & Sour Chicken',
      cuisine: 'Chinese',
      before: '/images/showcase/sweet_sour_before.jpg',
      after: '/images/showcase/sweet_sour_after.png',
      description: 'Plain green background → Professional restaurant setting',
      isReal: true
    },
    {
      id: 2,
      name: 'Pad Thai',
      cuisine: 'Thai',
      before: '/images/showcase/pad_thai_before.jpg',
      after: '/images/showcase/pad_thai_after.png',
      description: 'Simple product shot → Appetizing shrimp presentation',
      isReal: true
    },
    {
      id: 3,
      name: 'Kimchi Tofu Soup',
      cuisine: 'Korean',
      before: '/images/showcase/kimchi_before.webp',
      after: '/images/showcase/kimchi_after.webp',
      description: 'Simple photo → Appetizing AI-enhanced presentation',
      isReal: true
    },
    {
      id: 4,
      name: 'Spaghetti Carbonara',
      cuisine: 'Italian',
      before: '/images/showcase/spaghetti_before.jpg',
      after: '/images/showcase/spaghetti_after.webp',
      description: 'Basic shot → Professional restaurant quality',
      isReal: true
    }
  ];

  // Auto-rotate examples
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveEnhancement((prev) => (prev + 1) % enhancementExamples.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [enhancementExamples.length]);

  const features = [
    {
      icon: <Wand2 className="w-6 h-6" />,
      title: "AI Photo Enhancement",
      description: "Transform ordinary food photos into stunning, magazine-quality images with intelligent lighting and color correction."
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: "AI Image Generation",
      description: "No photo? Describe your dish and our AI creates beautiful, realistic food images for your menu."
    },
    {
      icon: <Languages className="w-6 h-6" />,
      title: "Smart Translation",
      description: "Translate your menu into 13+ languages automatically. Perfect for international tourists."
    },
    {
      icon: <QrCode className="w-6 h-6" />,
      title: "Instant QR Menus",
      description: "Generate elegant QR codes in seconds. Customers scan and view your digital menu instantly."
    },
    {
      icon: <Smartphone className="w-6 h-6" />,
      title: "Complete POS System",
      description: "Order management with Kitchen Display System. Real-time tracking and service requests."
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Analytics Dashboard",
      description: "Track menu views, popular items, and customer behavior with data-driven insights."
    }
  ];

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-neutral-950 overflow-x-hidden">
      {/* Navigation - Premium Style */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-700 ${
        isScrolled
          ? 'bg-neutral-950/98 backdrop-blur-2xl border-b border-amber-900/20'
          : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between h-20 lg:h-24">
            <button
              onClick={scrollToTop}
              className="flex items-center space-x-3 group"
            >
              <Image
                src="/images/app-logo.png"
                alt="SweetAsMenu"
                width={600}
                height={150}
                className="h-12 lg:h-14 w-auto opacity-90 group-hover:opacity-100 transition-opacity"
                priority
              />
            </button>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-12">
              {[
                { href: '#features', label: 'Features' },
                { href: '#showcase', label: 'Showcase' },
                { href: '#pricing', label: 'Pricing' },
                { href: '#testimonials', label: 'Testimonials' }
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-neutral-400 hover:text-white text-sm font-medium tracking-wide uppercase transition-colors duration-300"
                >
                  {item.label}
                </a>
              ))}
            </div>

            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="hidden sm:inline-flex text-neutral-400 hover:text-white text-sm font-medium tracking-wide transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/login?tab=signup"
                className="relative bg-gradient-to-r from-amber-600 to-amber-500 text-white px-6 lg:px-8 py-2.5 lg:py-3 text-sm font-semibold tracking-wide uppercase transition-all duration-300 hover:from-amber-500 hover:to-amber-400"
                style={{ clipPath: 'polygon(0 0, 100% 0, 95% 100%, 5% 100%)' }}
              >
                Start Free
              </Link>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-neutral-400 hover:text-white"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          <div className={`lg:hidden overflow-hidden transition-all duration-500 ${mobileMenuOpen ? 'max-h-80 pb-8' : 'max-h-0'}`}>
            <div className="flex flex-col space-y-1 pt-4 border-t border-neutral-800">
              {[
                { href: '#features', label: 'Features' },
                { href: '#showcase', label: 'Showcase' },
                { href: '#pricing', label: 'Pricing' },
                { href: '#testimonials', label: 'Testimonials' }
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-3 text-neutral-400 hover:text-white text-sm font-medium tracking-wide uppercase transition-colors"
                >
                  {item.label}
                </a>
              ))}
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-3 text-neutral-400 hover:text-white text-sm font-medium tracking-wide uppercase transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Premium & Elegant */}
      <section className="relative min-h-screen flex items-center pt-28 lg:pt-24">
        {/* Premium Background */}
        <div className="absolute inset-0">
          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/30 via-transparent to-transparent" />

          {/* Subtle Gold Accent Lines */}
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-700/30 to-transparent" />
          <div className="absolute top-1/3 left-0 w-1/2 h-px bg-gradient-to-r from-amber-700/20 to-transparent" />
          <div className="absolute top-2/3 right-0 w-1/3 h-px bg-gradient-to-l from-amber-700/20 to-transparent" />

          {/* Elegant Pattern */}
          <div className="absolute inset-0 opacity-[0.015]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30L30 0z' fill='%23D4AF37' fill-opacity='1'/%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px'
          }} />
        </div>

        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 xl:gap-20 items-center py-16 lg:py-0">
            {/* Left Content */}
            <div className="max-w-xl">
              {/* Premium Badge - positioned below navbar */}
              <div className="inline-flex items-center mb-6 lg:mb-8 mt-4 lg:mt-0">
                <div className="flex items-center bg-neutral-900/80 border border-amber-800/30 px-4 lg:px-5 py-1.5 lg:py-2">
                  <Award className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-amber-500 mr-2" />
                  <span className="text-amber-500 text-[10px] lg:text-xs font-semibold tracking-[0.15em] lg:tracking-[0.2em] uppercase">
                    Premium AI Technology
                  </span>
                </div>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-light text-white mb-6 sm:mb-8 leading-[1.1] tracking-tight">
                Elevate Your
                <span className="block font-semibold bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent mt-1 sm:mt-2">
                  Restaurant Menu
                </span>
              </h1>

              <p className="text-base sm:text-lg lg:text-xl text-neutral-400 mb-8 sm:mb-12 leading-relaxed font-light">
                Transform ordinary food photography into extraordinary visual experiences.
                AI-powered enhancement, seamless translations, and elegant digital menus.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8 sm:mb-12">
                <Link
                  href="/login?tab=signup"
                  className="group inline-flex items-center justify-center bg-gradient-to-r from-amber-600 to-amber-500 text-white px-8 sm:px-10 py-3.5 sm:py-4 font-semibold tracking-wide uppercase text-sm transition-all duration-500 hover:from-amber-500 hover:to-amber-400 hover:shadow-lg hover:shadow-amber-500/20"
                >
                  Begin Free Trial
                  <ArrowRight className="ml-2 sm:ml-3 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a
                  href="#showcase"
                  className="group inline-flex items-center justify-center border border-neutral-700 text-white px-8 sm:px-10 py-3.5 sm:py-4 font-medium tracking-wide uppercase text-sm transition-all duration-500 hover:border-amber-700/50 hover:bg-amber-950/20"
                >
                  <Play className="w-4 h-4 mr-2 sm:mr-3 text-amber-500" />
                  View Showcase
                </a>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-wrap items-center gap-4 sm:gap-8 text-xs sm:text-sm text-neutral-500">
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-amber-600 mr-2 flex-shrink-0" />
                  <span>14-day free trial</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-amber-600 mr-2 flex-shrink-0" />
                  <span>No credit card</span>
                </div>
              </div>
            </div>

            {/* Right - Premium Showcase */}
            <div className="relative">
              {/* Main Card */}
              <div className="relative bg-neutral-900/50 border border-neutral-800 p-6 lg:p-8">
                {/* Gold Corner Accents */}
                <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-amber-700/50" />
                <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-amber-700/50" />
                <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-amber-700/50" />
                <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-amber-700/50" />

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <span className="text-amber-500 text-xs font-semibold tracking-[0.15em] uppercase">
                    AI Enhancement Demo
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <div className="w-2 h-2 rounded-full bg-neutral-700" />
                    <div className="w-2 h-2 rounded-full bg-neutral-700" />
                  </div>
                </div>

                {/* Before/After */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="relative aspect-square overflow-hidden bg-neutral-800">
                    <Image
                      src={enhancementExamples[activeEnhancement].before}
                      alt="Before enhancement"
                      fill
                      className="object-cover opacity-80"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/80 to-transparent" />
                    <span className="absolute bottom-3 left-3 text-neutral-400 text-xs font-medium tracking-wider uppercase">
                      Before
                    </span>
                  </div>
                  <div className="relative aspect-square overflow-hidden border-2 border-amber-700/50">
                    <Image
                      src={enhancementExamples[activeEnhancement].after}
                      alt="After AI enhancement"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/60 to-transparent" />
                    <span className="absolute bottom-3 left-3 flex items-center text-amber-400 text-xs font-medium tracking-wider uppercase">
                      <Sparkles className="w-3 h-3 mr-1.5" />
                      Enhanced
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="flex items-center justify-between py-4 border-t border-neutral-800">
                  <div>
                    <p className="text-white font-medium">{enhancementExamples[activeEnhancement].name}</p>
                    <p className="text-neutral-500 text-sm">{enhancementExamples[activeEnhancement].cuisine} Cuisine</p>
                  </div>
                  <div className="flex gap-2">
                    {enhancementExamples.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setActiveEnhancement(index)}
                        className={`w-8 h-1 transition-all duration-300 ${
                          index === activeEnhancement
                            ? 'bg-amber-500'
                            : 'bg-neutral-700 hover:bg-neutral-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating Stats */}
              <div className="absolute -bottom-6 -left-6 xl:-bottom-8 xl:-left-8 bg-neutral-900 border border-amber-800/30 p-4 xl:p-5 hidden lg:block z-10">
                <div className="flex items-center gap-3 xl:gap-4">
                  <div className="w-10 h-10 xl:w-12 xl:h-12 bg-gradient-to-br from-amber-600 to-amber-500 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 xl:w-6 xl:h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xl xl:text-2xl font-semibold text-white">+340%</p>
                    <p className="text-neutral-500 text-xs xl:text-sm">Menu Engagement</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator - positioned to the right to avoid floating stats */}
        <div className="absolute bottom-8 right-12 xl:right-16 hidden lg:flex flex-col items-center gap-3 text-neutral-600">
          <span className="text-xs tracking-widest uppercase">Scroll</span>
          <div className="w-px h-12 bg-gradient-to-b from-amber-700/50 to-transparent" />
        </div>
      </section>

      {/* Stats Bar - Premium */}
      <section className="relative py-16 lg:py-20 border-y border-neutral-800">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950" />

        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-12">
            {[
              { number: "500+", label: "Restaurants" },
              { number: "25,000+", label: "Photos Enhanced" },
              { number: "13+", label: "Languages" },
              { number: "4.9", label: "Average Rating", suffix: "★" }
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-2xl sm:text-3xl lg:text-4xl font-light text-white mb-1 sm:mb-2">
                  {stat.number}
                  {stat.suffix && <span className="text-amber-500">{stat.suffix}</span>}
                </div>
                <div className="text-neutral-500 text-xs sm:text-sm tracking-wider sm:tracking-widest uppercase">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - Premium Grid */}
      <section id="features" className="py-24 lg:py-32 relative">
        <div className="absolute inset-0 bg-neutral-950" />

        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative">
          {/* Section Header */}
          <div className="text-center mb-12 sm:mb-16 lg:mb-20">
            <div className="inline-flex items-center justify-center mb-4 sm:mb-6">
              <div className="w-8 sm:w-12 h-px bg-amber-700/50" />
              <span className="mx-3 sm:mx-4 text-amber-500 text-xs font-semibold tracking-[0.15em] sm:tracking-[0.2em] uppercase">Features</span>
              <div className="w-8 sm:w-12 h-px bg-amber-700/50" />
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light text-white mb-4 sm:mb-6 px-4">
              Exceptional <span className="font-semibold text-amber-400">Capabilities</span>
            </h2>
            <p className="text-neutral-400 max-w-2xl mx-auto text-base sm:text-lg font-light px-4">
              Everything you need to create a world-class digital menu experience
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group relative bg-neutral-900/30 border border-neutral-800 p-5 sm:p-6 lg:p-8 transition-all duration-500 hover:border-amber-800/50 hover:bg-neutral-900/50"
              >
                {/* Corner Accent */}
                <div className="absolute top-0 right-0 w-10 sm:w-12 h-10 sm:h-12 border-t border-r border-amber-700/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-amber-600/20 to-amber-700/10 border border-amber-700/30 flex items-center justify-center mb-4 sm:mb-6 text-amber-500">
                  {feature.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-medium text-white mb-2 sm:mb-3 group-hover:text-amber-400 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-neutral-500 leading-relaxed font-light text-sm sm:text-base">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Showcase Section */}
      <section id="showcase" className="py-24 lg:py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950" />

        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative">
          <div className="text-center mb-12 sm:mb-16 lg:mb-20">
            <div className="inline-flex items-center justify-center mb-4 sm:mb-6">
              <div className="w-8 sm:w-12 h-px bg-amber-700/50" />
              <span className="mx-3 sm:mx-4 text-amber-500 text-xs font-semibold tracking-[0.15em] sm:tracking-[0.2em] uppercase">AI Showcase</span>
              <div className="w-8 sm:w-12 h-px bg-amber-700/50" />
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light text-white mb-4 sm:mb-6 px-4">
              Before & After <span className="font-semibold text-amber-400">Transformations</span>
            </h2>
            <p className="text-neutral-400 max-w-2xl mx-auto text-base sm:text-lg font-light px-4">
              Witness the power of AI enhancement on real restaurant dishes
            </p>
          </div>

          {/* Gallery */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            {enhancementExamples.map((example, index) => (
              <div
                key={example.id}
                className="group cursor-pointer"
                onClick={() => setShowComparison(index)}
              >
                <div className="relative aspect-square overflow-hidden bg-neutral-900 border border-neutral-800 transition-all duration-500 group-hover:border-amber-700/50">
                  {/* Split View */}
                  <div className="absolute inset-0 flex">
                    <div className="w-1/2 h-full relative overflow-hidden">
                      <Image
                        src={example.before}
                        alt={`${example.name} before`}
                        fill
                        className="object-cover opacity-70"
                        sizes="25vw"
                      />
                    </div>
                    <div className="w-1/2 h-full relative overflow-hidden">
                      <Image
                        src={example.after}
                        alt={`${example.name} after`}
                        fill
                        className="object-cover"
                        sizes="25vw"
                      />
                    </div>
                  </div>

                  {/* Center Line */}
                  <div className="absolute inset-y-0 left-1/2 w-px bg-amber-500 transform -translate-x-1/2" />

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                    <span className="text-white text-sm font-medium flex items-center gap-2">
                      <Play className="w-4 h-4" />
                      View Comparison
                    </span>
                  </div>
                </div>

                <div className="mt-3 sm:mt-4 text-center">
                  <h3 className="text-white font-medium text-sm sm:text-base group-hover:text-amber-400 transition-colors truncate px-1">{example.name}</h3>
                  <p className="text-neutral-500 text-xs sm:text-sm">{example.cuisine}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Modal */}
      {showComparison !== null && (
        <div className="fixed inset-0 bg-neutral-950/98 backdrop-blur-xl z-50 flex items-center justify-center p-4" onClick={() => setShowComparison(null)}>
          <div className="relative max-w-5xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowComparison(null)}
              className="absolute -top-14 right-0 text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-8 h-8" />
            </button>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="relative aspect-square overflow-hidden bg-neutral-900 border border-neutral-800">
                <Image
                  src={enhancementExamples[showComparison].before}
                  alt="Before"
                  fill
                  className="object-cover"
                />
                <span className="absolute top-4 left-4 bg-neutral-900/90 text-neutral-400 px-4 py-2 text-sm tracking-wider uppercase">
                  Before
                </span>
              </div>
              <div className="relative aspect-square overflow-hidden border-2 border-amber-700/50">
                <Image
                  src={enhancementExamples[showComparison].after}
                  alt="After"
                  fill
                  className="object-cover"
                />
                <span className="absolute top-4 left-4 bg-amber-600 text-white px-4 py-2 text-sm tracking-wider uppercase flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  AI Enhanced
                </span>
              </div>
            </div>
            <div className="text-center mt-8">
              <h3 className="text-2xl font-medium text-white mb-2">{enhancementExamples[showComparison].name}</h3>
              <p className="text-neutral-500">{enhancementExamples[showComparison].description}</p>
            </div>
          </div>
        </div>
      )}

      {/* How It Works */}
      <section className="py-24 lg:py-32 relative">
        <div className="absolute inset-0 bg-neutral-950" />

        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative">
          <div className="text-center mb-12 sm:mb-16 lg:mb-20">
            <div className="inline-flex items-center justify-center mb-4 sm:mb-6">
              <div className="w-8 sm:w-12 h-px bg-amber-700/50" />
              <span className="mx-3 sm:mx-4 text-amber-500 text-xs font-semibold tracking-[0.15em] sm:tracking-[0.2em] uppercase">Process</span>
              <div className="w-8 sm:w-12 h-px bg-amber-700/50" />
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light text-white mb-4 sm:mb-6">
              How It <span className="font-semibold text-amber-400">Works</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 lg:gap-12">
            {[
              {
                step: "01",
                title: "Upload Your Menu",
                description: "Simply upload photos of your dishes. Our system accepts any quality - we'll make them shine.",
                icon: <Upload className="w-5 h-5 sm:w-6 sm:h-6" />
              },
              {
                step: "02",
                title: "AI Enhancement",
                description: "Our AI automatically enhances photos, generates descriptions, and translates content.",
                icon: <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
              },
              {
                step: "03",
                title: "Go Live",
                description: "Get your elegant QR code, share your digital menu, and start receiving orders.",
                icon: <QrCode className="w-5 h-5 sm:w-6 sm:h-6" />
              }
            ].map((step, index) => (
              <div key={index} className="relative text-center">
                {/* Connector Line */}
                {index < 2 && (
                  <div className="hidden sm:block absolute top-10 sm:top-12 left-[55%] w-[90%] lg:left-[60%] lg:w-[80%] h-px bg-gradient-to-r from-amber-700/30 to-transparent" />
                )}

                <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 border border-amber-700/30 mb-6 sm:mb-8 relative">
                  <span className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 text-3xl sm:text-4xl font-light text-amber-700/30">{step.step}</span>
                  <div className="text-amber-500">{step.icon}</div>
                </div>
                <h3 className="text-lg sm:text-xl font-medium text-white mb-3 sm:mb-4">{step.title}</h3>
                <p className="text-neutral-500 font-light leading-relaxed text-sm sm:text-base">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10 sm:mt-16">
            <Link
              href="/login?tab=signup"
              className="inline-flex items-center bg-gradient-to-r from-amber-600 to-amber-500 text-white px-8 sm:px-10 py-3.5 sm:py-4 font-semibold tracking-wide uppercase text-sm transition-all duration-500 hover:from-amber-500 hover:to-amber-400"
            >
              Get Started Now
              <ArrowRight className="ml-2 sm:ml-3 w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-16 sm:py-24 lg:py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950" />

        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative">
          <div className="text-center mb-12 sm:mb-16 lg:mb-20">
            <div className="inline-flex items-center justify-center mb-4 sm:mb-6">
              <div className="w-8 sm:w-12 h-px bg-amber-700/50" />
              <span className="mx-3 sm:mx-4 text-amber-500 text-xs font-semibold tracking-[0.15em] sm:tracking-[0.2em] uppercase">Testimonials</span>
              <div className="w-8 sm:w-12 h-px bg-amber-700/50" />
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light text-white mb-4 sm:mb-6 px-4">
              Trusted by <span className="font-semibold text-amber-400">Industry Leaders</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {[
              {
                name: "Marco R.",
                location: "Auckland",
                cuisine: "Italian Restaurant",
                avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=96&h=96&fit=crop&crop=face",
                text: "The AI photo enhancement is incredible! Our pasta dishes look like they're from a magazine. A complete game changer."
              },
              {
                name: "Yuki T.",
                location: "Wellington",
                cuisine: "Japanese Restaurant",
                avatar: "/images/showcase/yuki_avatar.jpg",
                text: "Finally, a system that understands Asian cuisine! The translations are perfect and the QR menu is so convenient."
              },
              {
                name: "Raj P.",
                location: "Christchurch",
                cuisine: "Indian Restaurant",
                avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=96&h=96&fit=crop&crop=face",
                text: "Orders increased by 40% since we started using SweetAsMenu. The AI made our curry photos look absolutely delicious!"
              }
            ].map((testimonial, index) => (
              <div
                key={index}
                className="bg-neutral-900/30 border border-neutral-800 p-5 sm:p-6 lg:p-8"
              >
                {/* Stars */}
                <div className="flex gap-1 mb-4 sm:mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 fill-current" />
                  ))}
                </div>

                <p className="text-neutral-300 mb-6 sm:mb-8 leading-relaxed font-light italic text-sm sm:text-base">
                  &ldquo;{testimonial.text}&rdquo;
                </p>

                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-amber-700/30 flex-shrink-0">
                    <Image
                      src={testimonial.avatar}
                      alt={testimonial.name}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-medium text-sm sm:text-base truncate">{testimonial.name}</div>
                    <div className="text-neutral-500 text-xs sm:text-sm truncate">{testimonial.cuisine}</div>
                    <div className="text-amber-600 text-xs">{testimonial.location}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 sm:py-24 lg:py-32 relative">
        <div className="absolute inset-0 bg-neutral-950" />

        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative">
          <div className="text-center mb-12 sm:mb-16 lg:mb-20">
            <div className="inline-flex items-center justify-center mb-4 sm:mb-6">
              <div className="w-8 sm:w-12 h-px bg-amber-700/50" />
              <span className="mx-3 sm:mx-4 text-amber-500 text-xs font-semibold tracking-[0.15em] sm:tracking-[0.2em] uppercase">Pricing</span>
              <div className="w-8 sm:w-12 h-px bg-amber-700/50" />
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light text-white mb-4 sm:mb-6">
              Investment <span className="font-semibold text-amber-400">Plans</span>
            </h2>
            <p className="text-neutral-400 max-w-2xl mx-auto text-base sm:text-lg font-light px-4">
              Choose the plan that fits your establishment
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 items-start max-w-5xl mx-auto">
            {/* Starter */}
            <div className="bg-neutral-900/30 border border-neutral-800 p-5 sm:p-6 lg:p-8">
              <div className="text-center mb-6 sm:mb-8">
                <h3 className="text-lg sm:text-xl font-medium text-white mb-2">Starter</h3>
                <div className="text-3xl sm:text-4xl font-light text-white mb-1">
                  $39<span className="text-neutral-500 text-base sm:text-lg">/mo</span>
                </div>
                <p className="text-neutral-500 text-xs sm:text-sm">For small takeaways</p>
              </div>

              <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                {[
                  "30 menu items",
                  "30 AI enhancements/month",
                  "Original + English",
                  "QR Menu & POS",
                  "Custom logo"
                ].map((feature, i) => (
                  <li key={i} className="flex items-center text-neutral-400 text-xs sm:text-sm">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 mr-2 sm:mr-3 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/pricing"
                className="block text-center border border-neutral-700 text-white py-2.5 sm:py-3 font-medium tracking-wide uppercase text-xs sm:text-sm transition-all duration-300 hover:border-amber-700/50 hover:bg-amber-950/20"
              >
                Get Started
              </Link>
            </div>

            {/* Professional - Featured */}
            <div className="relative bg-neutral-900/50 border-2 border-amber-700/50 p-5 sm:p-6 lg:p-8 sm:col-span-2 lg:col-span-1 lg:-mt-6 lg:mb-6 xl:-mt-8 xl:mb-8">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-600 to-amber-500 text-white px-4 sm:px-6 py-1 sm:py-1.5 text-xs font-semibold tracking-wider sm:tracking-widest uppercase whitespace-nowrap z-10">
                Most Popular
              </div>

              <div className="text-center mb-6 sm:mb-8 pt-3 sm:pt-4">
                <h3 className="text-lg sm:text-xl font-medium text-white mb-2">Professional</h3>
                <div className="text-3xl sm:text-4xl font-light text-amber-400 mb-1">
                  $89<span className="text-neutral-500 text-base sm:text-lg">/mo</span>
                </div>
                <p className="text-neutral-500 text-xs sm:text-sm">For casual dining</p>
              </div>

              <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                {[
                  "Unlimited menu items",
                  "200 AI enhancements/month",
                  "Original + English",
                  "Full POS System",
                  "Custom logo & theme",
                  "Cover image"
                ].map((feature, i) => (
                  <li key={i} className="flex items-center text-neutral-300 text-xs sm:text-sm">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 mr-2 sm:mr-3 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/pricing"
                className="block text-center bg-gradient-to-r from-amber-600 to-amber-500 text-white py-2.5 sm:py-3 font-semibold tracking-wide uppercase text-xs sm:text-sm transition-all duration-300 hover:from-amber-500 hover:to-amber-400"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Enterprise */}
            <div className="bg-neutral-900/30 border border-neutral-800 p-5 sm:p-6 lg:p-8">
              <div className="text-center mb-6 sm:mb-8">
                <h3 className="text-lg sm:text-xl font-medium text-white mb-2">Enterprise</h3>
                <div className="text-3xl sm:text-4xl font-light text-white mb-1">
                  $199<span className="text-neutral-500 text-base sm:text-lg">/mo</span>
                </div>
                <p className="text-neutral-500 text-xs sm:text-sm">Fine dining & chains</p>
              </div>

              <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                {[
                  "Unlimited everything",
                  "500 AI enhancements/month",
                  "13+ languages",
                  "White label branding",
                  "Multi-branch support",
                  "Priority support"
                ].map((feature, i) => (
                  <li key={i} className="flex items-center text-neutral-400 text-xs sm:text-sm">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 mr-2 sm:mr-3 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/login?tab=signup"
                className="block text-center bg-gradient-to-r from-amber-600 to-amber-500 text-white py-2.5 sm:py-3 font-semibold tracking-wide uppercase text-xs sm:text-sm transition-all duration-300 hover:from-amber-500 hover:to-amber-400"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 lg:py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-950/50 via-amber-900/30 to-amber-950/50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-900/20 via-transparent to-transparent" />

        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center relative">
          <Utensils className="w-10 h-10 sm:w-12 sm:h-12 text-amber-600 mx-auto mb-6 sm:mb-8" />

          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light text-white mb-4 sm:mb-6 px-4">
            Ready to <span className="font-semibold text-amber-400">Transform</span> Your Restaurant?
          </h2>
          <p className="text-neutral-400 mb-8 sm:mb-12 text-base sm:text-lg font-light max-w-2xl mx-auto px-4">
            Join hundreds of premium restaurants across New Zealand.
            Start your complimentary 14-day trial today.
          </p>

          <Link
            href="/login?tab=signup"
            className="inline-flex items-center bg-white text-neutral-900 px-8 sm:px-12 py-3.5 sm:py-4 font-semibold tracking-wide uppercase text-sm transition-all duration-300 hover:bg-amber-400"
          >
            Begin Your Journey
            <ArrowRight className="ml-2 sm:ml-3 w-4 h-4" />
          </Link>

          <p className="text-neutral-500 text-xs sm:text-sm mt-6 sm:mt-8">
            No credit card required • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer - Premium */}
      <footer className="bg-neutral-950 border-t border-neutral-800 py-12 sm:py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 lg:gap-12 mb-10 sm:mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <Image
                src="/images/app-logo.png"
                alt="SweetAsMenu"
                width={300}
                height={75}
                className="h-10 sm:h-12 w-auto mb-4 sm:mb-6 opacity-80"
              />
              <p className="text-neutral-500 text-xs sm:text-sm leading-relaxed mb-4 sm:mb-6">
                AI-powered digital menus for discerning restaurants in New Zealand.
              </p>
              <a
                href="https://zestiotech.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-neutral-600 hover:text-amber-500 transition-colors"
              >
                Powered by Zestio Tech Limited
              </a>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-white font-medium mb-4 sm:mb-6 tracking-wide uppercase text-xs sm:text-sm">Product</h4>
              <ul className="space-y-2 sm:space-y-3">
                <li><a href="#features" className="text-neutral-500 hover:text-amber-500 text-xs sm:text-sm transition-colors">Features</a></li>
                <li><Link href="/pricing" className="text-neutral-500 hover:text-amber-500 text-xs sm:text-sm transition-colors">Pricing</Link></li>
                <li><a href="#showcase" className="text-neutral-500 hover:text-amber-500 text-xs sm:text-sm transition-colors">Showcase</a></li>
              </ul>
            </div>

            {/* Contact */}
            <div className="col-span-2 md:col-span-1">
              <h4 className="text-white font-medium mb-4 sm:mb-6 tracking-wide uppercase text-xs sm:text-sm">Contact</h4>
              <ul className="space-y-2 sm:space-y-3 text-neutral-500 text-xs sm:text-sm">
                <li><a href="mailto:support@zestiotech.com" className="hover:text-amber-500 transition-colors break-all">support@zestiotech.com</a></li>
                <li>8/28 Setthasiri Rama 5</li>
                <li>Nonthaburi, Thailand 11000</li>
              </ul>

              {/* Social Links */}
              <div className="flex gap-3 sm:gap-4 mt-4 sm:mt-6">
                <a href="https://www.facebook.com/profile.php?id=61586578678116" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 border border-neutral-800 flex items-center justify-center text-neutral-500 hover:text-amber-500 hover:border-amber-700/50 transition-all" aria-label="Facebook">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href="https://www.instagram.com/zestiotech/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 border border-neutral-800 flex items-center justify-center text-neutral-500 hover:text-amber-500 hover:border-amber-700/50 transition-all" aria-label="Instagram">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
                <a href="https://www.linkedin.com/in/phawat-thirachotkonkasem-9057713a5/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 border border-neutral-800 flex items-center justify-center text-neutral-500 hover:text-amber-500 hover:border-amber-700/50 transition-all" aria-label="LinkedIn">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
              </div>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-white font-medium mb-4 sm:mb-6 tracking-wide uppercase text-xs sm:text-sm">Legal</h4>
              <ul className="space-y-2 sm:space-y-3">
                <li><Link href="/privacy" className="text-neutral-500 hover:text-amber-500 text-xs sm:text-sm transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-neutral-500 hover:text-amber-500 text-xs sm:text-sm transition-colors">Terms of Service</Link></li>
                <li><Link href="/refunds" className="text-neutral-500 hover:text-amber-500 text-xs sm:text-sm transition-colors">Refund Policy</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="border-t border-neutral-800 pt-6 sm:pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-center sm:text-left">
            <p className="text-neutral-600 text-xs sm:text-sm">
              &copy; {new Date().getFullYear()} Zestio Tech Limited. All rights reserved.
            </p>
            <p className="text-neutral-700 text-xs">
              SweetAsMenu — Crafted with precision in New Zealand
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
