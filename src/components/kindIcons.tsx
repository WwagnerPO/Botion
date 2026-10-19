import {
  AlignLeft,
  Calendar,
  CircleChevronDown,
  Hash,
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
};
