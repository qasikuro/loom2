import { lumiSvg } from './defs';

/**
 * 01_Body_Parts. Body_Base is ONE continuous head/body silhouette; its ground
 * shadow ellipse is split into its own layer only so it can stay grounded
 * while the body floats. There is no separate head, ears, tail or hair.
 */
export const BODY_ART = {
  shadow: lumiSvg('<ellipse cx="256" cy="450" rx="118" ry="18" fill="#B78EAA" opacity=".12"/>'),
  body: lumiSvg(
    '<path d="M256 113 C164 113 104 180 100 281 C96 374 143 430 256 434 C369 430 416 374 412 281 C408 180 348 113 256 113Z" fill="url(#bodyGrad)" stroke="#EFCDBB" stroke-width="3"/>'
    + '<ellipse cx="183" cy="179" rx="52" ry="33" fill="#FFFFFF" opacity=".18"/>',
  ),
  armLeft: lumiSvg('<path d="M127 305 C99 302 83 329 89 360 C94 385 116 395 136 378 C151 365 151 327 127 305Z" fill="url(#bodyGrad)" stroke="#EFCDBB" stroke-width="3"/>'),
  armRight: lumiSvg('<path d="M385 304 C411 296 430 320 424 349 C420 375 400 392 381 374 C367 360 365 322 385 304Z" fill="url(#bodyGrad)" stroke="#EFCDBB" stroke-width="3"/>'),
  legLeft: lumiSvg('<path d="M173 399 C171 427 173 448 198 452 C220 454 230 440 226 416 L221 399Z" fill="url(#bodyGrad)" stroke="#EFCDBB" stroke-width="3"/>'),
  legRight: lumiSvg('<path d="M291 399 L287 416 C283 440 293 454 315 452 C340 448 341 427 339 399Z" fill="url(#bodyGrad)" stroke="#EFCDBB" stroke-width="3"/>'),
  stem: lumiSvg('<path d="M252 151 Q256 132 256 116" stroke="#C71F3C" stroke-width="13" stroke-linecap="round" fill="none"/>'),
  leafLeft: lumiSvg(
    '<path d="M255 142 C207 129 158 95 146 67 C174 45 225 62 255 111 C267 124 267 136 255 142Z" fill="url(#leafGrad)" stroke="#E82D49" stroke-width="2"/>'
    + '<path d="M251 133 Q209 96 165 72" fill="none" stroke="#FFB0B3" stroke-width="4" stroke-linecap="round" opacity=".65"/>',
  ),
  leafRight: lumiSvg(
    '<path d="M255 142 C275 99 315 46 356 42 C379 76 332 124 269 147Z" fill="url(#leafGrad)" stroke="#E82D49" stroke-width="2"/>'
    + '<path d="M266 137 Q311 83 350 53" fill="none" stroke="#FFB0B3" stroke-width="4" stroke-linecap="round" opacity=".65"/>',
  ),
} as const;

/** Pivots in the shared 512 viewBox space. */
export const PIVOTS = {
  ground: { x: 256, y: 434 },      // base of the silhouette (lean / squash)
  face: { x: 256, y: 292 },        // centre of the drawn face group
  shoulderLeft: { x: 128, y: 310 },
  shoulderRight: { x: 384, y: 309 },
  hipLeft: { x: 199, y: 402 },
  hipRight: { x: 313, y: 402 },
  sprout: { x: 254, y: 150 },      // where the stem meets the body
  leafBase: { x: 256, y: 140 },
  eyeLeft: { x: 196, y: 269 },
  eyeRight: { x: 316, y: 269 },
} as const;
