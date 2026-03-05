'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ImageOff } from 'lucide-react';
import { getOptimizedImageUrl } from '@/lib/utils/imageOptimization';

interface ProtectedImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  fallback?: string;
  onLoad?: () => void;
  onError?: () => void;
  onClick?: () => void;
  /** Enable protection features (default: true) */
  protected?: boolean;
}

/**
 * ProtectedImage - Image component with download/save protection
 *
 * Features:
 * - Disables right-click context menu
 * - Prevents drag and drop
 * - Adds transparent overlay to prevent direct interaction
 * - Disables pointer events on the actual image
 * - CSS protection against selection
 * - Keyboard shortcut prevention (Ctrl+S, etc.)
 */
export default function ProtectedImage({
  src,
  alt,
  className = '',
  containerClassName = '',
  width,
  height,
  priority = false,
  fallback,
  onLoad,
  onError,
  onClick,
  protected: isProtected = true
}: ProtectedImageProps) {
  // Optimize Supabase image URLs with CDN transforms (WebP, resize, compression)
  const optimizedSrc = src.includes('supabase')
    ? getOptimizedImageUrl(src, { width: width || 600, quality: 80, format: 'webp' })
    : src;

  const [imageSrc, setImageSrc] = useState<string>(priority ? optimizedSrc : '');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Lazy loading with Intersection Observer
  useEffect(() => {
    if (priority) {
      setImageSrc(optimizedSrc);
      return;
    }

    if (!containerRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setImageSrc(optimizedSrc);
            if (observerRef.current && containerRef.current) {
              observerRef.current.unobserve(containerRef.current);
            }
          }
        });
      },
      {
        rootMargin: '300px',
        threshold: 0.01
      }
    );

    observerRef.current.observe(containerRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [optimizedSrc, priority]);

  // Protection: Prevent context menu (right-click)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (isProtected) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, [isProtected]);

  // Protection: Prevent drag
  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (isProtected) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, [isProtected]);

  // Protection: Prevent keyboard shortcuts when focused
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isProtected) {
      // Block Ctrl+S, Ctrl+Shift+S, etc.
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
  }, [isProtected]);

  const handleLoad = () => {
    setIsLoading(false);
    if (onLoad) onLoad();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);

    if (fallback && imageSrc !== fallback) {
      setImageSrc(fallback);
      setHasError(false);
      return;
    }

    if (onError) onError();
  };

  // Protection styles
  const protectionStyles: React.CSSProperties = isProtected ? {
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none',
    WebkitTouchCallout: 'none',
    pointerEvents: 'none',
  } : {};

  const containerProtectionStyles: React.CSSProperties = isProtected ? {
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none',
    WebkitTouchCallout: 'none',
    touchAction: 'manipulation',
  } : {};

  // Show loading skeleton
  if (!imageSrc) {
    return (
      <div
        ref={containerRef}
        className={`bg-gray-200 animate-pulse ${containerClassName}`}
        style={{ width, height }}
      />
    );
  }

  // Show error state
  if (hasError) {
    return (
      <div
        className={`bg-gray-100 flex items-center justify-center ${containerClassName}`}
        style={{ width, height }}
      >
        <ImageOff className="w-8 h-8 text-gray-400" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${isProtected ? 'protected-image-wrapper' : ''} ${containerClassName}`}
      style={{ ...containerProtectionStyles, width, height }}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
      onKeyDown={handleKeyDown}
      tabIndex={isProtected ? -1 : undefined}
    >
      {/* Loading skeleton */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse z-10" />
      )}

      {/* Actual image with protection */}
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
        draggable={!isProtected}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        style={{
          ...protectionStyles,
        }}
      />

      {/* Transparent overlay to block right-click/save interactions */}
      {isProtected && (
        <div
          className="absolute inset-0"
          style={{
            background: 'rgba(0,0,0,0)',
            cursor: onClick ? 'pointer' : 'default',
            zIndex: 50,
            WebkitTapHighlightColor: 'transparent',
          }}
          onClick={(e) => {
            if (onClick) {
              e.stopPropagation();
              onClick();
            }
          }}
          onTouchEnd={onClick ? (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
          } : undefined}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }}
          onDragStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }}
          onMouseDown={(e) => {
            // Block middle click
            if (e.button === 1) {
              e.preventDefault();
            }
          }}
        />
      )}
    </div>
  );
}
