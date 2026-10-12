/**
 * Shared <defs> copied verbatim from the Lumi SVG asset pack (every part ships
 * the same gradient block and the same 512x512 viewBox). Originals live in
 * ./original for provenance; nothing here alters paths, proportions or colours.
 */
export const LUMI_VIEWBOX = 512;

const DEFS = `<defs>
 <radialGradient id="bodyGrad" cx="35%" cy="22%" r="82%">
  <stop offset="0%" stop-color="#FFF9E9"/>
  <stop offset="58%" stop-color="#FFF0D8"/>
  <stop offset="100%" stop-color="#F4C6AD"/>
 </radialGradient>
 <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0%" stop-color="#FF7A83"/><stop offset="48%" stop-color="#F52F48"/><stop offset="100%" stop-color="#B90E35"/>
 </linearGradient>
 <radialGradient id="eyeGrad" cx="35%" cy="25%" r="80%">
  <stop offset="0%" stop-color="#7B351B"/><stop offset="58%" stop-color="#4C1F16"/><stop offset="100%" stop-color="#1E0D0B"/>
 </radialGradient>
 <radialGradient id="blushGrad">
  <stop offset="0%" stop-color="#FF9D9F" stop-opacity=".75"/><stop offset="100%" stop-color="#FF9D9F" stop-opacity="0"/>
 </radialGradient>
 <linearGradient id="heartGrad" x1="0" y1="0" x2="0.8" y2="1">
  <stop offset="0%" stop-color="#FF879F"/><stop offset="100%" stop-color="#F52E61"/>
 </linearGradient>
</defs>`;

/** Wraps original shape markup in the pack's shared viewBox + defs. */
export function lumiSvg(shapes: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${DEFS}${shapes}</svg>`;
}
