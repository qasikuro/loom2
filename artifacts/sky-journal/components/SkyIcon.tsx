/**
 * Custom dreamy SVG icons designed for Sky Journal / Skyloom.
 * All icons use a 24×24 viewBox, stroke-based with rounded caps.
 * Built with react-native-svg (already installed).
 */
import React from 'react';
import Svg, { Path, Circle, Line, Rect, G } from 'react-native-svg';

export type SkyIconName =
  | 'sky-home'         // Soft cloud with sparkle star
  | 'sky-journal'      // Open book with feather quill
  | 'sky-lantern'      // Floating sky lantern (for Discover)
  | 'sky-profile'      // Sky kid silhouette with wings
  | 'sky-create'       // Blooming star / plus-star
  | 'sky-star'         // 4-point sparkle star
  | 'sky-moon-star'    // Crescent moon + small star (Moments)
  | 'sky-quill'        // Feather quill pen (Diary)
  | 'sky-friends'      // Two small figures side by side (Friends)
  | 'sky-constellation'// 3 stars connected (All entries)
  | 'sky-calendar'     // Moon phase calendar
  | 'sky-search-star'  // Magnifier with star inside
  | 'sky-witness'      // Eye with sparkle (witness/seen)
  | 'sky-compass';     // Minimalist compass rose

interface SkyIconProps {
  name: SkyIconName;
  size?: number;
  color?: string;
  accentColor?: string;
  strokeWidth?: number;
}

export function SkyIcon({
  name,
  size = 24,
  color = '#EDEAFF',
  accentColor,
  strokeWidth = 1.6,
}: SkyIconProps) {
  const accent = accentColor ?? color;
  const sw = strokeWidth;
  const common = {
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  const renderIcon = () => {
    switch (name) {

      // ── Cloud with sparkle star (Home tab) ─────────────────────────────────
      case 'sky-home':
        return (
          <G>
            {/* Cloud body */}
            <Path
              {...common}
              d="M5 16.5C5 14 6.8 12 9.2 12C9.5 9.8 11 8 13 8C15 8 16.5 9.8 16.8 12C18.6 12.4 20 13.9 20 15.8C20 17.8 18.5 19.5 16.5 19.5H8C6.3 19.5 5 18.2 5 16.5Z"
            />
            {/* 4-point sparkle star top-left */}
            <Path
              {...common}
              stroke={accent}
              d="M7 5L7.7 7L9.5 7.7L7.7 8.4L7 10.4L6.3 8.4L4.5 7.7L6.3 7Z"
            />
          </G>
        );

      // ── Open book with quill (Journal tab) ─────────────────────────────────
      case 'sky-journal':
        return (
          <G>
            {/* Left page */}
            <Path
              {...common}
              d="M4 6C4 5.4 4.4 5 5 5L11.5 5L11.5 18.5C9 18 6.5 18 4 18.8Z"
            />
            {/* Right page */}
            <Path
              {...common}
              d="M12.5 5L19 5C19.6 5 20 5.4 20 6L20 18.8C17.5 18 15 18 12.5 18.5Z"
            />
            {/* Center spine */}
            <Line {...common} x1="12" y1="5" x2="12" y2="18.5" />
            {/* Tiny quill in top-right corner */}
            <Path
              {...common}
              stroke={accent}
              d="M18 2.5C16 4.5 15 6 15 8L16.5 8C16.5 6 17.5 4.5 18 2.5Z"
            />
            <Path
              {...common}
              stroke={accent}
              d="M15 8L14.5 10.5"
            />
          </G>
        );

      // ── Sky lantern (Discover tab) ──────────────────────────────────────────
      case 'sky-lantern':
        return (
          <G>
            {/* String */}
            <Line {...common} x1="12" y1="2" x2="12" y2="4.5" />
            {/* Top cap */}
            <Path
              {...common}
              d="M9 4.5L15 4.5Q15.5 4.5 15.5 5L15.5 7.5L8.5 7.5L8.5 5Q8.5 4.5 9 4.5Z"
            />
            {/* Lantern body */}
            <Path
              {...common}
              d="M8.5 7.5Q6 11 6 14.5Q6 18 12 19Q18 18 18 14.5Q18 11 15.5 7.5Z"
            />
            {/* Inner flame dot (filled) */}
            <Circle
              cx="12" cy="13.5" r="2"
              fill={accent}
              fillOpacity={0.7}
              stroke="none"
            />
            {/* Bottom crossbar */}
            <Line {...common} x1="8" y1="19" x2="16" y2="19" />
          </G>
        );

      // ── Sky kid silhouette (Profile tab) ───────────────────────────────────
      case 'sky-profile':
        return (
          <G>
            {/* Head */}
            <Circle {...common} cx="12" cy="8" r="3.5" />
            {/* Small halo dots */}
            <Circle cx="10" cy="4.5" r="0.6" fill={accent} stroke="none" />
            <Circle cx="12" cy="3.8" r="0.8" fill={accent} stroke="none" />
            <Circle cx="14" cy="4.5" r="0.6" fill={accent} stroke="none" />
            {/* Body / flowing cape */}
            <Path
              {...common}
              d="M8.5 11.5Q8 15 12 19Q16 15 15.5 11.5Q14 12.5 12 12.5Q10 12.5 8.5 11.5Z"
            />
            {/* Left wing */}
            <Path
              {...common}
              d="M8.5 11.5Q5.5 10 4 13Q6 15.5 8.5 13.5"
            />
            {/* Right wing */}
            <Path
              {...common}
              d="M15.5 11.5Q18.5 10 20 13Q18 15.5 15.5 13.5"
            />
          </G>
        );

      // ── Blooming star plus (Create center button) ───────────────────────────
      case 'sky-create':
        return (
          <G>
            {/* 4-arm star bloom */}
            <Path
              {...common}
              d="M12 4L13 9L18 8L13.5 12L17 17L12 14L7 17L10.5 12L6 8L11 9Z"
            />
            {/* Center plus lines */}
            <Line {...common} x1="12" y1="9" x2="12" y2="15" />
            <Line {...common} x1="9" y1="12" x2="15" y2="12" />
          </G>
        );

      // ── 4-point sparkle star ────────────────────────────────────────────────
      case 'sky-star':
        return (
          <G>
            <Path
              {...common}
              d="M12 3L13.5 9L19.5 10.5L13.5 12L12 18L10.5 12L4.5 10.5L10.5 9Z"
            />
          </G>
        );

      // ── Crescent moon + star (Moments filter) ──────────────────────────────
      case 'sky-moon-star':
        return (
          <G>
            {/* Crescent */}
            <Path
              {...common}
              d="M18 13A8 8 0 1 1 11 4A6 6 0 0 0 18 13Z"
            />
            {/* Small sparkle star top-right */}
            <Path
              {...common}
              stroke={accent}
              d="M19 4L19.5 5.5L21 6L19.5 6.5L19 8L18.5 6.5L17 6L18.5 5.5Z"
            />
          </G>
        );

      // ── Feather quill (Diary filter) ────────────────────────────────────────
      case 'sky-quill':
        return (
          <G>
            {/* Quill feather */}
            <Path
              {...common}
              d="M20 3C15 5 12 9 11 14L9 14C9 14 10 10 13 7C10 9 8 13 8 16L6 21"
            />
            {/* Barb lines */}
            <Path {...common} d="M14.5 8.5L11.5 11.5" />
            <Path {...common} d="M16.5 6L13.5 9" />
            {/* Ink tip */}
            <Path {...common} stroke={accent} d="M8 16L7 19L6 21" />
          </G>
        );

      // ── Two figures (Friends filter) ────────────────────────────────────────
      case 'sky-friends':
        return (
          <G>
            {/* Left person */}
            <Circle {...common} cx="8.5" cy="7" r="2.5" />
            <Path {...common} d="M5 19C5 15.5 6.5 13 8.5 13C10.5 13 12 15.5 12 19" />
            {/* Right person */}
            <Circle {...common} cx="15.5" cy="7" r="2.5" />
            <Path {...common} d="M12 19C12 15.5 13.5 13 15.5 13C17.5 13 19 15.5 19 19" />
            {/* Small heart between them */}
            <Path
              {...common}
              stroke={accent}
              strokeWidth={1.2}
              d="M11 10.5C11 9.7 11.7 9 12 9.5C12.3 9 13 9.7 13 10.5C13 11.5 12 12.5 12 12.5C12 12.5 11 11.5 11 10.5Z"
            />
          </G>
        );

      // ── Constellation (All entries filter) ─────────────────────────────────
      case 'sky-constellation':
        return (
          <G>
            {/* Connecting lines */}
            <Line {...common} strokeOpacity={0.45} x1="8" y1="8" x2="16" y2="7" />
            <Line {...common} strokeOpacity={0.45} x1="16" y1="7" x2="14" y2="16" />
            <Line {...common} strokeOpacity={0.45} x1="14" y1="16" x2="8" y2="8" />
            {/* Stars at vertices */}
            <Circle cx="8" cy="8" r="2" fill={accent} fillOpacity={0.85} stroke="none" />
            <Circle cx="16" cy="7" r="1.5" fill={color} fillOpacity={0.7} stroke="none" />
            <Circle cx="14" cy="16" r="1.8" fill={color} fillOpacity={0.7} stroke="none" />
            {/* Tiny extra dot */}
            <Circle cx="11" cy="12" r="1" fill={accent} fillOpacity={0.4} stroke="none" />
          </G>
        );

      // ── Calendar (moon calendar) ────────────────────────────────────────────
      case 'sky-calendar':
        return (
          <G>
            {/* Calendar box */}
            <Rect {...common} x="3" y="5" width="18" height="16" rx="3" />
            {/* Top bar + hooks */}
            <Line {...common} x1="3" y1="10" x2="21" y2="10" />
            <Line {...common} x1="8" y1="3" x2="8" y2="7" />
            <Line {...common} x1="16" y1="3" x2="16" y2="7" />
            {/* Moon inside */}
            <Path
              {...common}
              stroke={accent}
              d="M15 16A4 4 0 1 1 10 13A3 3 0 0 0 15 16Z"
            />
          </G>
        );

      // ── Search with star (search icon for journal) ──────────────────────────
      case 'sky-search-star':
        return (
          <G>
            {/* Circle */}
            <Circle {...common} cx="10.5" cy="10.5" r="6.5" />
            {/* Handle */}
            <Line {...common} x1="15.5" y1="15.5" x2="21" y2="21" />
            {/* Star inside */}
            <Path
              {...common}
              stroke={accent}
              strokeWidth={1.2}
              d="M10.5 7.5L11.2 9.5L13 9.5L11.6 10.7L12.2 12.7L10.5 11.5L8.8 12.7L9.4 10.7L8 9.5L9.8 9.5Z"
            />
          </G>
        );

      // ── Eye with sparkle (witness/seen) ─────────────────────────────────────
      case 'sky-witness':
        return (
          <G>
            <Path {...common} d="M2 12C4 7 7.5 5 12 5C16.5 5 20 7 22 12C20 17 16.5 19 12 19C7.5 19 4 17 2 12Z" />
            <Circle {...common} cx="12" cy="12" r="3" />
            <Circle cx="12" cy="12" r="1.2" fill={accent} stroke="none" />
            {/* Sparkle top-right */}
            <Path
              {...common}
              stroke={accent}
              strokeWidth={1.2}
              d="M18 5L18.5 6.5L20 7L18.5 7.5L18 9L17.5 7.5L16 7L17.5 6.5Z"
            />
          </G>
        );

      // ── Compass rose (fallback for discover) ─────────────────────────────────
      case 'sky-compass':
        return (
          <G>
            <Circle {...common} cx="12" cy="12" r="9" />
            <Path {...common} fill={accent} fillOpacity={0.7} d="M12 4L13.5 11L12 10L10.5 11Z" />
            <Path {...common} d="M12 20L10.5 13L12 14L13.5 13Z" />
            <Path {...common} d="M4 12L11 10.5L10 12L11 13.5Z" />
            <Path {...common} d="M20 12L13 13.5L14 12L13 10.5Z" />
            <Circle cx="12" cy="12" r="1.5" fill={color} stroke="none" />
          </G>
        );

      default:
        return null;
    }
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {renderIcon()}
    </Svg>
  );
}
