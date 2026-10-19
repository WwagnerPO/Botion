import {
  AlignLeft,
  ArrowUpRight,
  Calendar,
  CircleChevronDown,
  Clock,
  FilePen,
  Hash,
  Link,
  Mail,
  Paperclip,
  Phone,
  Search,
  Sigma,
  SquareCheck,
  Tags,
  type LucideIcon,
} from "lucide-react";
import type { Kind } from "../lib/database";

/** Icono de cada tipo de propiedad, como en las columnas de Notion. */
export const KIND_ICONS: Record<Kind, LucideIcon> = {
  text: AlignLeft,
  number: Hash,
  checkbox: SquareCheck,
  date: Calendar,
  select: CircleChevronDown,
  tags: Tags,
  url: Link,
  email: Mail,
  phone: Phone,
  files: Paperclip,
  relation: ArrowUpRight,
  rollup: Search,
  formula: Sigma,
  created: Clock,
  edited: FilePen,
};
