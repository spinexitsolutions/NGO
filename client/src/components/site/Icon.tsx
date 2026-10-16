import {
  Accessibility, Award, BookOpen, Building2, Compass, Droplets, Eye, Globe2, GraduationCap, HandHeart, HandCoins, Handshake, HeartHandshake, Home, Leaf, Lightbulb, Megaphone,
  PawPrint, Scale, ShieldCheck, Sparkles, Sprout, Stethoscope, Target, Users, Utensils, type LucideIcon, type LucideProps,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  Accessibility, Award, BookOpen, Building2, Compass, Droplets, Eye, Globe2, GraduationCap, HandHeart, HandCoins, Handshake, HeartHandshake, Home, Leaf, Lightbulb, Megaphone,
  PawPrint, Scale, ShieldCheck, Sparkles, Sprout, Stethoscope, Target, Users, Utensils,
};

/** Renders one of the curated icons by name (names come from CMS content). */
export function Icon({ name, ...props }: { name?: string } & LucideProps) {
  const C = (name && ICONS[name]) || Sparkles;
  return <C aria-hidden {...props} />;
}
