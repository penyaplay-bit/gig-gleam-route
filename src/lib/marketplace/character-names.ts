// Copyright-safe marketplace category names for character performers.
// A performer may NOT use trademarked character names (e.g. "Spider-Man")
// unless they upload licensing proof AND it's verified by staff.
// UI should show these safe names by default; the raw trademarked name is
// only shown once verified_official = true.

export interface SafeCharacter {
  key: string;
  safeName: string;
  aliases: string[]; // strings we should DETECT and remap
  category: "superhero" | "princess" | "cartoon" | "movie" | "other";
}

export const SAFE_CHARACTERS: SafeCharacter[] = [
  { key: "spider_hero", safeName: "Spider Hero", aliases: ["spiderman", "spider-man", "spider man"], category: "superhero" },
  { key: "web_hero", safeName: "Web Hero", aliases: ["webslinger"], category: "superhero" },
  { key: "red_blue_hero", safeName: "Red-and-Blue Hero Performer", aliases: [], category: "superhero" },
  { key: "shield_hero", safeName: "Shield Hero", aliases: ["captain america"], category: "superhero" },
  { key: "iron_hero", safeName: "Armoured Hero", aliases: ["iron man", "ironman"], category: "superhero" },
  { key: "bat_hero", safeName: "Night Hero", aliases: ["batman"], category: "superhero" },
  { key: "ice_princess", safeName: "Ice Princess", aliases: ["elsa"], category: "princess" },
  { key: "sea_princess", safeName: "Sea Princess", aliases: ["ariel", "little mermaid"], category: "princess" },
  { key: "yellow_bear", safeName: "Honey-Loving Bear", aliases: ["winnie the pooh"], category: "cartoon" },
  { key: "mouse_host", safeName: "Cheerful Mouse Host", aliases: ["mickey mouse"], category: "cartoon" },
];

const NORMALIZE = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

/**
 * If the user typed a trademarked name (or common misspelling), return the
 * safe replacement + a friendly warning. Otherwise returns the original.
 */
export function sanitizeCharacterName(input: string): {
  displayName: string;
  wasReplaced: boolean;
  warning: string | null;
  matchedKey: string | null;
} {
  const normalised = NORMALIZE(input);
  if (!normalised) {
    return { displayName: input, wasReplaced: false, warning: null, matchedKey: null };
  }
  for (const c of SAFE_CHARACTERS) {
    if (c.aliases.some((a) => normalised.includes(NORMALIZE(a)))) {
      return {
        displayName: c.safeName,
        wasReplaced: true,
        matchedKey: c.key,
        warning:
          "We've updated the name to a copyright-safe version. Performers can only use official trademarked character names with verified licensing proof.",
      };
    }
  }
  return { displayName: input, wasReplaced: false, warning: null, matchedKey: null };
}
