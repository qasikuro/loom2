import { lumiSvg } from './defs';

/** 03_Reaction_Props, original shapes. */
export const PROP_ART = {
  heart: lumiSvg(
    '<path d="M256 385 C235 365 181 331 181 290 C181 251 226 239 256 275 C286 239 331 251 331 290 C331 331 277 365 256 385Z" fill="url(#heartGrad)" stroke="#F64B70" stroke-width="3"/>'
    + '<path d="M213 278 Q222 264 238 277" fill="none" stroke="#FFD9E0" stroke-width="6" stroke-linecap="round"/>',
  ),
  smallHearts: lumiSvg(
    '<path d="M175 240 C164 228 143 215 143 199 C143 182 162 178 175 194 C188 178 207 182 207 199 C207 215 186 228 175 240Z" fill="#FF7898"/>'
    + '<path d="M344 191 C335 181 319 171 319 158 C319 144 335 141 344 154 C354 141 369 144 369 158 C369 171 353 181 344 191Z" fill="#FF7898"/>',
  ),
  sparkle: lumiSvg('<path d="M256 160 C269 215 281 227 336 240 C281 253 269 265 256 320 C243 265 231 253 176 240 C231 227 243 215 256 160Z" fill="#FFD66E" stroke="#FFF0B7" stroke-width="5"/>'),
  sweat: lumiSvg('<path d="M340 185 C340 185 315 217 315 233 C315 251 329 263 344 256 C362 247 357 226 340 185Z" fill="#8FDDF5" stroke="#53BDE3" stroke-width="3"/>'),
  zzz: lumiSvg('<g fill="#8870C8" font-family="Verdana, sans-serif" font-weight="bold"><text x="240" y="255" font-size="55">Z</text><text x="286" y="215" font-size="39">z</text><text x="320" y="185" font-size="28">z</text></g>'),
  armsOpen: lumiSvg(
    '<path d="M130 315 Q75 284 67 241" fill="none" stroke="#F4D6BE" stroke-width="30" stroke-linecap="round"/>'
    + '<path d="M382 315 Q437 284 445 241" fill="none" stroke="#F4D6BE" stroke-width="30" stroke-linecap="round"/>',
  ),
  coverLeft: lumiSvg('<path d="M145 330 C138 299 160 277 183 289 C202 300 203 326 184 343Z" fill="url(#bodyGrad)" stroke="#EFCDBB" stroke-width="3"/>'),
  coverRight: lumiSvg('<path d="M367 330 C374 299 352 277 329 289 C310 300 309 326 328 343Z" fill="url(#bodyGrad)" stroke="#EFCDBB" stroke-width="3"/>'),
} as const;
