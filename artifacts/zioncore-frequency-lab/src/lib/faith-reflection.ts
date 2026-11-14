export type FaithReflectionParts = {
  paragraphs: string[];
  sacredTextEcho: string | null;
};

export function splitFaithReflection(text: string): FaithReflectionParts {
  const marker = /(?:^|\n\s*\n)Optional sacred-text echo:\s*/i.exec(text);
  const reflectionText = (marker ? text.slice(0, marker.index) : text).trim();
  const paragraphs = reflectionText
    .split(/\n\s*\n+/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);

  return {
    paragraphs,
    sacredTextEcho: marker
      ? text.slice(marker.index + marker[0].length).trim() || null
      : null,
  };
}
