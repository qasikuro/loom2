/**
 * Drop-in replacement for @expo/vector-icons Feather.
 * Uses lucide-react-native (SVG-based) — no font file needed.
 * Font-based icons were unreliable in Expo Go on Android (New Architecture).
 *
 * Usage:  <Icon name="home" size={20} color="#fff" />
 */
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  Bell,
  BellOff,
  Bookmark,
  Book,
  BookOpen,
  Calendar,
  Camera,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Cloud,
  Compass,
  Droplet,
  Eye,
  EyeOff,
  Feather,
  Globe,
  Heart,
  Home,
  Image as ImageIcon,
  Key,
  Layers,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  Slash,
  Smile,
  Star,
  Sun,
  Sunrise,
  Trash2,
  TrendingUp,
  User,
  Users,
  Wind,
  X,
  Zap,
  type LucideProps,
} from 'lucide-react-native';
import React from 'react';

const ICON_MAP = {
  'alert-circle':  AlertCircle,
  'arrow-down':    ArrowDown,
  'arrow-left':    ArrowLeft,
  'bell':          Bell,
  'bell-off':      BellOff,
  'book':          Book,
  'book-open':     BookOpen,
  'bookmark':      Bookmark,
  'calendar':      Calendar,
  'camera':        Camera,
  'check':         Check,
  'check-circle':  CheckCircle,
  'chevron-down':  ChevronDown,
  'chevron-left':  ChevronLeft,
  'chevron-right': ChevronRight,
  'circle':        Circle,
  'clock':         Clock,
  'cloud':         Cloud,
  'compass':       Compass,
  'droplet':       Droplet,
  'edit-2':        Pencil,
  'eye':           Eye,
  'eye-off':       EyeOff,
  'feather':       Feather,
  'globe':         Globe,
  'heart':         Heart,
  'home':          Home,
  'image':         ImageIcon,
  'key':           Key,
  'layers':        Layers,
  'lock':          Lock,
  'log-out':       LogOut,
  'mail':          Mail,
  'map-pin':       MapPin,
  'moon':          Moon,
  'plus':          Plus,
  'refresh-cw':    RefreshCw,
  'search':        Search,
  'send':          Send,
  'settings':      Settings,
  'shield':        Shield,
  'slash':         Slash,
  'smile':         Smile,
  'star':          Star,
  'sun':           Sun,
  'sunrise':       Sunrise,
  'trash-2':       Trash2,
  'trending-up':   TrendingUp,
  'user':          User,
  'users':         Users,
  'wind':          Wind,
  'x':             X,
  'zap':           Zap,
} as const;

export type IconName = keyof typeof ICON_MAP;

interface IconProps extends Omit<LucideProps, 'ref'> {
  name: IconName | string;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 20, color = '#000', style, ...rest }: IconProps) {
  const Component = ICON_MAP[name as IconName];
  if (!Component) return null;
  return <Component size={size} color={color} style={style} {...rest} />;
}
