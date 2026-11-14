export type ResonanceVisual = {
  id: string;
  title: string;
  alt: string;
};

export const resonanceVisuals: ResonanceVisual[] = [
  {
    id: "community-globe",
    title: "Many paths, one world",
    alt: "A globe surrounded by a diverse circle of people, clouds, and peace symbols.",
  },
  {
    id: "radiant-convergence",
    title: "The shared horizon",
    alt: "A gathering of people and spiritual symbols around a luminous globe and central light.",
  },
  {
    id: "golden-gathering",
    title: "Gathered in light",
    alt: "A large crowd framed by religious and celestial motifs around a golden radiance.",
  },
  {
    id: "life-growth-map",
    title: "Life in motion",
    alt: "A colorful conceptual map of life, growth, experience, and transformation around a glowing geometric center.",
  },
  {
    id: "dove-circuit",
    title: "The luminous circuit",
    alt: "A gold circular diagram with white doves, geometric lines, and small embedded lettering.",
  },
  {
    id: "radiant-figure",
    title: "The listening figure",
    alt: "A luminous human-like figure standing amid blue and gold symbols and circular forms.",
  },
  {
    id: "path-to-light",
    title: "A path through the stars",
    alt: "A lone figure follows a radiant path toward a bright horizon beneath celestial symbols.",
  },
  {
    id: "golden-orbit",
    title: "Golden orbit",
    alt: "An ornate golden mandala of concentric rings, fine lines, and a bright central point.",
  },
  {
    id: "blueprint-of-resonance",
    title: "Blue centre",
    alt: "A dark blueprint-like composition with a blue circular centre and gold geometric markings.",
  },
  {
    id: "celestial-blueprint",
    title: "The celestial blueprint",
    alt: "A dense circular celestial diagram with gold linework, small symbols, and a blue central field.",
  },
  {
    id: "symbolic-atlas",
    title: "An atlas of symbols",
    alt: "A busy illustrated atlas of symbolic objects and small labels arranged around a radiant centre.",
  },
  {
    id: "blue-center-mandala",
    title: "A measured centre",
    alt: "A dark geometric wheel with a blue central circle, fine gold diagrams, and small labels.",
  },
  {
    id: "radiant-symbolic-wheel",
    title: "The radiant wheel",
    alt: "An elaborate gold-and-blue symbolic wheel with a bright centre and many small motifs.",
  },
  {
    id: "molecular-mandala",
    title: "Patterns in relation",
    alt: "A blue, violet, and gold geometric mandala with interlaced wave-like and molecular motifs.",
  },
  {
    id: "night-sky-diagram",
    title: "Night-sky diagram",
    alt: "A monochrome celestial blueprint with a blue-lit centre, cross-like symbol, and dense diagram details.",
  },
  {
    id: "radiant-city",
    title: "The radiant city",
    alt: "A vertical golden cityscape and bright column of light surrounded by symbolic linework.",
  },
  {
    id: "golden-flower",
    title: "The golden flower",
    alt: "A bright flower-like mandala formed from warm gold rings and radiating lines.",
  },
  {
    id: "cosmic-lattice",
    title: "The cosmic lattice",
    alt: "A blue-and-gold celestial lattice of intersecting geometric forms around a radiant centre.",
  },
  {
    id: "radiant-face",
    title: "A face in the cosmos",
    alt: "A stylized face with a golden halo, framed by a starfield and circular motifs.",
  },
];

export function resonanceVisualUrl(id: string): string {
  return `/api/resonance-visuals/${encodeURIComponent(id)}`;
}
