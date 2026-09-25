import type {
  MapImageAttachment,
  TerrainElement,
} from "@/lib/terrains";

export const inputClass =
  "w-full border border-cream/30 bg-charcoal px-2 py-1 text-xs text-cream";

export const labelClass = "block font-block text-[10px] uppercase text-cream/60";

export type ImageAttachableElement = Extract<
  TerrainElement,
  { type: "title" | "caption" | "button" }
>;

export function isImageAttachableElement(
  element: TerrainElement,
): element is ImageAttachableElement {
  return (
    element.type === "title" ||
    element.type === "caption" ||
    element.type === "button"
  );
}

export function defaultAttachment(
  element: ImageAttachableElement,
): MapImageAttachment {
  return {
    src: "",
    alt: "",
    side: "left",
    size: element.type === "title" ? 3 : element.type === "caption" ? 1.2 : 1,
    gap: element.type === "title" ? 0.5 : 0.35,
  };
}
