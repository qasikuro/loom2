import { lumiSvg } from './defs';

/**
 * 02_Face_Expressions. The open eyes are split into the existing white sclera
 * ellipse and the existing pupil/highlight shapes so the pupils can glance.
 */
export const FACE_ART = {
  eyeWhiteLeft: lumiSvg('<ellipse cx="196" cy="269" rx="35" ry="43" fill="#FFFFFF"/>'),
  eyeWhiteRight: lumiSvg('<ellipse cx="316" cy="269" rx="35" ry="43" fill="#FFFFFF"/>'),
  pupilLeft: lumiSvg(
    '<ellipse cx="198" cy="274" rx="26" ry="34" fill="url(#eyeGrad)"/>'
    + '<ellipse cx="190" cy="258" rx="10" ry="12" fill="#FFFFFF"/>'
    + '<circle cx="209" cy="287" r="5" fill="#F8C49A" opacity=".9"/>',
  ),
  pupilRight: lumiSvg(
    '<ellipse cx="314" cy="274" rx="26" ry="34" fill="url(#eyeGrad)"/>'
    + '<ellipse cx="306" cy="258" rx="10" ry="12" fill="#FFFFFF"/>'
    + '<circle cx="325" cy="287" r="5" fill="#F8C49A" opacity=".9"/>',
  ),
  eyesClosed: lumiSvg(
    '<path d="M163 271 Q196 300 228 270" fill="none" stroke="#4A211A" stroke-width="9" stroke-linecap="round"/>'
    + '<path d="M284 270 Q316 300 349 271" fill="none" stroke="#4A211A" stroke-width="9" stroke-linecap="round"/>',
  ),
  eyelids: lumiSvg(
    '<path d="M158 276 Q194 230 232 276 Q195 302 158 276Z" fill="#F5D7BD"/>'
    + '<path d="M280 276 Q317 230 354 276 Q317 302 280 276Z" fill="#F5D7BD"/>',
  ),
  blush: lumiSvg(
    '<ellipse cx="151" cy="319" rx="44" ry="27" fill="url(#blushGrad)"/>'
    + '<ellipse cx="361" cy="319" rx="44" ry="27" fill="url(#blushGrad)"/>',
  ),
  brows: lumiSvg('<path d="M165 214 Q187 198 208 211 M304 211 Q326 198 347 214" fill="none" stroke="#8D382B" stroke-width="7" stroke-linecap="round"/>'),
  mouthSmile: lumiSvg('<path d="M236 326 Q256 345 278 326" fill="none" stroke="#8D382B" stroke-width="7" stroke-linecap="round"/>'),
  mouthLaugh: lumiSvg(
    '<path d="M231 321 Q256 355 282 321 Q278 351 256 352 Q236 349 231 321Z" fill="#9F2938"/>'
    + '<path d="M240 329 Q256 337 273 329" fill="none" stroke="#FFD7C9" stroke-width="4" stroke-linecap="round"/>',
  ),
  mouthSurprised: lumiSvg('<ellipse cx="256" cy="331" rx="11" ry="15" fill="#8D382B"/>'),
  mouthSad: lumiSvg('<path d="M238 339 Q256 320 276 339" fill="none" stroke="#8D382B" stroke-width="7" stroke-linecap="round"/>'),
} as const;
