import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = dirname(fileURLToPath(import.meta.url));
let nextId = 2;
const id = () => `0:${nextId++}`;
const animated = [];

const artboardId = id();
const styleId = id();
const machineId = id();
const layerId = id();
const stateId = id();
const animationId = id();

const number = (value) => {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(3)));
};

function keyedObject(objectId, properties, ease = false) {
  return `<KeyedObject objectId="${objectId}">
${Object.entries(properties)
  .map(([propertyKey, frames]) => `<KeyedProperty propertyKey="${propertyKey}">
${frames
  .map(([frame, value], index) => {
    const frameAttribute = frame === 0 ? '' : ` frame="${frame}"`;
    const isLast = index === frames.length - 1;
    if (!ease || isLast) {
      return `<KeyFrameDouble value="${number(value)}"${frameAttribute} interpolationType="linear"/>`;
    }
    return `<KeyFrameDouble value="${number(value)}"${frameAttribute} interpolationType="cubic">
  <CubicEaseInterpolator x1="0.24" y1="0.02" x2="0.34" y2="1"/>
</KeyFrameDouble>`;
  })
  .join('\n')}
</KeyedProperty>`)
  .join('\n')}
</KeyedObject>`;
}

function node({ name, x = 0, y = 0, rotation = 0, scaleX = 1, scaleY = 1, opacity = 1, children = [], keys, ease = false }) {
  const nodeId = id();
  if (keys) animated.push({ id: nodeId, keys, ease });
  return {
    id: nodeId,
    xml: `<Node x="${number(x)}" y="${number(y)}" rotation="${number(rotation)}" scaleX="${number(scaleX)}" scaleY="${number(scaleY)}" opacity="${number(opacity)}" name="${name}" id="${nodeId}">
${children.join('\n')}
</Node>`,
  };
}

function radialEllipse({
  name,
  x = 0,
  y = 0,
  width,
  height,
  rotation = 0,
  opacity = 1,
  stops,
  color = 'C9EFFF',
}) {
  const radius = Math.min(width, height) * 0.56;
  return `<Shape x="${number(x)}" y="${number(y)}" rotation="${number(rotation)}" opacity="${number(opacity)}" name="${name}">
  <Ellipse width="${number(width)}" height="${number(height)}" originX="0.5" originY="0.5" name="${name} form"/>
  <Fill name="${name} volume">
    <RadialGradient startX="0" startY="0" endX="${number(radius)}" endY="0" name="${name} light">
${stops
  .map(({ position, colorValue }) => `      <GradientStop colorValue="${colorValue}" position="${number(position)}"/>`)
  .join('\n')}
    </RadialGradient>
  </Fill>
</Shape>`;
}

const smokeStops = [
  { position: 0, colorValue: 'C92794F1' },
  { position: 0.38, colorValue: 'AE267FE0' },
  { position: 0.72, colorValue: '641650B8' },
  { position: 1, colorValue: '00124B99' },
];
const smokeCoreStops = [
  { position: 0, colorValue: 'C3BDEEFF' },
  { position: 0.34, colorValue: '9B78C8FF' },
  { position: 0.72, colorValue: '5D318FE8' },
  { position: 1, colorValue: '0070B9FF' },
];
const smokeHighlightStops = [
  { position: 0, colorValue: 'BFF6FFFF' },
  { position: 0.4, colorValue: '79A8EFFF' },
  { position: 1, colorValue: '0073CFFF' },
];

function smokeLobe(name, width, height, hue = 0) {
  const shade = hue % 2 === 0 ? smokeStops : [
    { position: 0, colorValue: 'C83B9FF4' },
    { position: 0.42, colorValue: 'A92B82E4' },
    { position: 0.76, colorValue: '5D235FC7' },
    { position: 1, colorValue: '00124B99' },
  ];
  return [
    radialEllipse({
      name: `${name} cool highlight`,
      x: -width * 0.14,
      y: -height * 0.2,
      width: width * 0.42,
      height: height * 0.48,
      opacity: 0.68,
      stops: smokeHighlightStops,
    }),
    radialEllipse({
      name: `${name} inner fold`,
      x: width * 0.12,
      y: height * 0.12,
      width: width * 0.76,
      height: height * 0.76,
      opacity: 0.74,
      stops: smokeCoreStops,
    }),
    radialEllipse({
      name: `${name} outer volume`,
      width,
      height,
      opacity: 0.86,
      stops: shade,
    }),
  ];
}

function cloudPuff({ name, x, y, width, height, start, driftX, driftY, rotation, hue = 0 }) {
  const end = start + 138;
  const puff = node({
    name,
    x,
    y,
    rotation,
    scaleX: 0.18,
    scaleY: 0.22,
    opacity: 0,
    children: smokeLobe(name, width, height, hue),
    keys: {
      13: [[0, x], [start, x], [end, x + driftX]],
      14: [[0, y], [start, y], [end, y + driftY]],
      16: [[0, 0.18], [start + 18, 0.42], [start + 55, 1.08], [end, 1.48]],
      17: [[0, 0.22], [start + 18, 0.4], [start + 55, 1.02], [end, 1.34]],
      18: [[0, 0], [start, 0], [start + 20, 0.64], [start + 78, 0.4], [end, 0]],
    },
  });
  return puff.xml;
}

const starGold = [
  { position: 0, colorValue: 'FFFFFCEB' },
  { position: 0.22, colorValue: 'FFFFF2A1' },
  { position: 0.56, colorValue: 'FFFFD952' },
  { position: 0.82, colorValue: 'FFFFB92E' },
  { position: 1, colorValue: 'FFDE8625' },
];
const starAura = [
  { position: 0, colorValue: 'BFFFF4C9' },
  { position: 0.34, colorValue: '68FFE07C' },
  { position: 0.7, colorValue: '28FFB83E' },
  { position: 1, colorValue: '00FFB83E' },
];
const starCore = [
  { position: 0, colorValue: 'FFFFFFFF' },
  { position: 0.36, colorValue: 'E8FFF4C5' },
  { position: 0.72, colorValue: '76FFE383' },
  { position: 1, colorValue: '00FFE383' },
];

function starArtwork(name) {
  const verticalFlare = `<Shape opacity="0.62" name="${name} vertical flare">
  <Star width="24" height="118" points="4" innerRadius="0.045" originX="0.5" originY="0.5" name="Four point flare"/>
  <Fill name="flare paint"><LinearGradient startX="0" startY="-58" endX="0" endY="58" name="flare light">
    <GradientStop colorValue="00FFFFFF" position="0"/>
    <GradientStop colorValue="CFFFFFFF" position="0.42"/>
    <GradientStop colorValue="F8FFF8D6" position="0.5"/>
    <GradientStop colorValue="CFFFFFFF" position="0.58"/>
    <GradientStop colorValue="00FFFFFF" position="1"/>
  </LinearGradient></Fill>
</Shape>`;
  const horizontalFlare = `<Shape opacity="0.46" name="${name} horizontal flare">
  <Star width="118" height="24" points="4" innerRadius="0.045" originX="0.5" originY="0.5" name="Four point flare"/>
  <Fill name="flare paint"><LinearGradient startX="-58" startY="0" endX="58" endY="0" name="flare light">
    <GradientStop colorValue="00FFFFFF" position="0"/>
    <GradientStop colorValue="CFFFFFFF" position="0.42"/>
    <GradientStop colorValue="F8FFF8D6" position="0.5"/>
    <GradientStop colorValue="CFFFFFFF" position="0.58"/>
    <GradientStop colorValue="00FFFFFF" position="1"/>
  </LinearGradient></Fill>
</Shape>`;
  const facet = `<Shape x="-12" y="-15" rotation="-0.18" opacity="0.72" name="${name} crystal face">
  <Triangle width="30" height="38" originX="0.5" originY="0.5" name="Facet"/>
  <Fill name="Facet light"><LinearGradient startX="-12" startY="-18" endX="12" endY="16" name="Facet gold">
    <GradientStop colorValue="F7FFFFE9" position="0"/>
    <GradientStop colorValue="BFFFF2A1" position="1"/>
  </LinearGradient></Fill>
</Shape>`;
  const mainStar = `<Shape name="${name} five point star">
  <Star width="88" height="88" points="5" innerRadius="0.4" cornerRadius="1.8" originX="0.5" originY="0.5" name="Faceted star"/>
  <Fill name="Gold body"><LinearGradient startX="-40" startY="-43" endX="40" endY="42" name="Sunlit gold">
${starGold.map(({ position, colorValue }) => `    <GradientStop colorValue="${colorValue}" position="${number(position)}"/>`).join('\n')}
  </LinearGradient></Fill>
  <Stroke thickness="1.8" join="round" name="Warm rim"><SolidColor colorValue="FFFFED9A" name="Rim gold"/></Stroke>
</Shape>`;
  const shadowStar = `<Shape x="0" y="4" opacity="0.42" name="${name} amber undercut">
  <Star width="92" height="92" points="5" innerRadius="0.4" originX="0.5" originY="0.5" name="Undercut"/>
  <Fill name="Shadow"><SolidColor colorValue="FF8C4B1D" name="Amber"/></Fill>
</Shape>`;
  return [
    radialEllipse({ name: `${name} stellar heart`, width: 35, height: 35, opacity: 0.96, stops: starCore }),
    verticalFlare,
    horizontalFlare,
    facet,
    mainStar,
    shadowStar,
    radialEllipse({ name: `${name} gold corona`, width: 118, height: 118, opacity: 0.66, stops: starAura }),
    radialEllipse({ name: `${name} outer atmosphere`, width: 174, height: 174, opacity: 0.42, stops: [
      { position: 0, colorValue: '56FFED9A' },
      { position: 0.48, colorValue: '26FFE062' },
      { position: 1, colorValue: '00FFD353' },
    ] }),
  ];
}

function fallingStar({ name, path, size }) {
  const first = path[0];
  const movementKeys = (field) => path.map(({ frame, [field]: value }) => [frame, value]);
  const opacityKeys = path.map(({ frame, opacity }) => [frame, opacity]);
  const movement = node({
    name,
    x: first.x,
    y: first.y,
    rotation: first.rotation,
    scaleX: size,
    scaleY: size,
    opacity: first.opacity,
    children: [node({
      name: `${name} luminous core`,
      scaleX: 0.9,
      scaleY: 0.9,
      children: starArtwork(name),
      keys: {
      16: [[0, 0.82], [44, 1.06], [116, 0.94], [176, 1.08], [300, 0.84]],
      17: [[0, 0.9], [44, 1.03], [116, 0.92], [176, 1.1], [300, 0.84]],
      },
    }).xml],
    keys: {
      13: movementKeys('x'),
      14: movementKeys('y'),
      15: movementKeys('rotation'),
      18: opacityKeys,
    },
    ease: true,
  });
  return movement.xml;
}

function smallMote({ name, x, y, start, size = 16 }) {
  const end = Math.min(start + 88, 296);
  const mote = node({
    name,
    x,
    y,
    scaleX: 0.2,
    scaleY: 0.2,
    opacity: 0,
    children: [
      radialEllipse({ name: `${name} haze`, width: size * 2.8, height: size * 2.8, opacity: 0.68, stops: starAura }),
      radialEllipse({ name: `${name} point`, width: size * 0.5, height: size * 0.5, opacity: 1, stops: starCore }),
    ],
    keys: {
      16: [[0, 0.2], [start + 8, 0.7], [start + 33, 1.05], [end, 0.5]],
      17: [[0, 0.2], [start + 8, 0.7], [start + 33, 1.05], [end, 0.5]],
      18: [[0, 0], [start, 0], [start + 16, 0.86], [start + 47, 0.5], [end, 0]],
    },
  });
  return mote.xml;
}

const hero = fallingStar({
  name: '01 Falling star',
  size: 0.76,
  path: [
    { frame: 0, x: 44, y: 40, rotation: -0.2, opacity: 0 },
    { frame: 9, x: 49, y: 53, rotation: -0.08, opacity: 1 },
    { frame: 35, x: 68, y: 112, rotation: 0.12, opacity: 1 },
    { frame: 74, x: 111, y: 222, rotation: 0.38, opacity: 0.98 },
    { frame: 116, x: 160, y: 336, rotation: 0.17, opacity: 0.97 },
    { frame: 154, x: 202, y: 438, rotation: 0.48, opacity: 0.9 },
    { frame: 179, x: 227, y: 497, rotation: 0.72, opacity: 0.66 },
    { frame: 204, x: 244, y: 543, rotation: 0.98, opacity: 0 },
  ],
});

const companionA = fallingStar({
  name: '02 Distant star',
  size: 0.32,
  path: [
    { frame: 0, x: 14, y: -8, rotation: 0.15, opacity: 0 },
    { frame: 38, x: 14, y: -8, rotation: 0.15, opacity: 0 },
    { frame: 52, x: 24, y: 28, rotation: -0.05, opacity: 0.7 },
    { frame: 92, x: 51, y: 113, rotation: 0.26, opacity: 0.62 },
    { frame: 130, x: 83, y: 195, rotation: 0.46, opacity: 0.48 },
    { frame: 158, x: 105, y: 250, rotation: 0.58, opacity: 0 },
    { frame: 204, x: 105, y: 250, rotation: 0.58, opacity: 0 },
  ],
});

const companionB = fallingStar({
  name: '03 Blue-white spark',
  size: 0.22,
  path: [
    { frame: 0, x: 122, y: -24, rotation: -0.12, opacity: 0 },
    { frame: 72, x: 122, y: -24, rotation: -0.12, opacity: 0 },
    { frame: 89, x: 136, y: 24, rotation: 0.02, opacity: 0.68 },
    { frame: 124, x: 166, y: 118, rotation: 0.3, opacity: 0.58 },
    { frame: 160, x: 199, y: 222, rotation: 0.6, opacity: 0.42 },
    { frame: 190, x: 224, y: 300, rotation: 0.74, opacity: 0 },
    { frame: 230, x: 224, y: 300, rotation: 0.74, opacity: 0 },
  ],
});

const trail = [
  { x: 56, y: 92, width: 68, height: 58, start: 3, driftX: -8, driftY: -18, rotation: -0.18, hue: 0 },
  { x: 67, y: 144, width: 82, height: 62, start: 16, driftX: -12, driftY: -22, rotation: 0.14, hue: 1 },
  { x: 87, y: 198, width: 104, height: 72, start: 32, driftX: -16, driftY: -28, rotation: -0.14, hue: 0 },
  { x: 111, y: 254, width: 112, height: 78, start: 48, driftX: -19, driftY: -29, rotation: 0.19, hue: 1 },
  { x: 138, y: 310, width: 126, height: 84, start: 64, driftX: -18, driftY: -35, rotation: -0.12, hue: 0 },
  { x: 165, y: 364, width: 134, height: 90, start: 80, driftX: -23, driftY: -38, rotation: 0.11, hue: 1 },
  { x: 194, y: 414, width: 145, height: 96, start: 96, driftX: -24, driftY: -39, rotation: -0.2, hue: 0 },
  { x: 221, y: 463, width: 140, height: 92, start: 111, driftX: -28, driftY: -44, rotation: 0.18, hue: 1 },
];

const trailXml = trail.map((puff, index) => cloudPuff({
  ...puff,
  name: `Star wake ${String(index + 1).padStart(2, '0')}`,
}));

const auraLobes = [
  { x: -178, y: 19, width: 166, height: 126, phase: 0.1, color: 0 },
  { x: -116, y: -18, width: 174, height: 140, phase: -0.08, color: 1 },
  { x: -45, y: -31, width: 186, height: 142, phase: 0.04, color: 0 },
  { x: 35, y: -26, width: 198, height: 148, phase: -0.06, color: 1 },
  { x: 112, y: -4, width: 190, height: 140, phase: 0.1, color: 0 },
  { x: 178, y: 27, width: 165, height: 124, phase: -0.11, color: 1 },
  { x: -87, y: 57, width: 212, height: 105, phase: 0.08, color: 1 },
  { x: 77, y: 64, width: 228, height: 108, phase: -0.05, color: 0 },
];

const auraChildren = auraLobes.map((lobe, index) => {
  const lobeNode = node({
    name: `Aura lobe ${String(index + 1).padStart(2, '0')}`,
    x: lobe.x,
    y: lobe.y,
    rotation: lobe.phase,
    opacity: 0.94,
    children: smokeLobe(`Aura lobe ${index + 1}`, lobe.width, lobe.height, lobe.color),
  });
  return lobeNode.xml;
});

const aura = node({
  name: '04 Blue-hour smoke aura',
  x: -25,
  y: -28,
  scaleX: 0.58,
  scaleY: 0.64,
  opacity: 0,
  children: auraChildren,
  keys: {
    13: [[0, -25], [138, -25], [174, -8], [215, 5], [254, 28], [300, 62]],
    14: [[0, -28], [138, -28], [174, 1], [215, -2], [254, -22], [300, -72]],
    16: [[0, 0.58], [138, 0.58], [174, 0.82], [215, 1.02], [252, 1.13], [300, 1.18]],
    17: [[0, 0.64], [138, 0.64], [174, 0.86], [215, 1.02], [252, 1.04], [300, 0.76]],
    18: [[0, 0], [138, 0], [168, 0.26], [205, 0.82], [238, 0.7], [270, 0.34], [300, 0]],
  },
  ease: true,
});

const motes = [
  { name: '01 drifting ember', x: 92, y: 170, start: 18, size: 17 },
  { name: '02 drifting ember', x: 154, y: 250, start: 46, size: 14 },
  { name: '03 drifting ember', x: 210, y: 352, start: 75, size: 18 },
  { name: '04 drifting ember', x: 325, y: 129, start: 167, size: 17 },
];
const moteXml = motes.map((mote) => smallMote(mote));

const allSceneElements = [
  hero,
  companionA,
  companionB,
  ...moteXml,
  ...trailXml,
  aura.xml,
].join('\n');

const tracks = animated.map(({ id: objectId, keys, ease }) => keyedObject(objectId, keys, ease)).join('\n');
const source = `<Rive version="1" kind="fragment">
  <Artboard x="0" y="0" defaultStateMachineId="${machineId}" styleId="${styleId}" width="430" height="900" name="Cosmic Profile Arrival" id="${artboardId}">
    <LayoutComponentStyle name="Arrival Artboard Style" id="${styleId}"/>

${allSceneElements}

    <StateMachine name="ProfileArrival" id="${machineId}">
      <StateMachineLayer name="Arrival Motion" id="${layerId}">
        <EntryState><StateTransition stateToId="${stateId}"/></EntryState>
        <AnimationState x="180" y="0" animationId="${animationId}" id="${stateId}"/>
      </StateMachineLayer>
    </StateMachine>
    <LinearAnimation fps="60" duration="300" loopValue="oneShot" name="Starfall into blue hour" id="${animationId}">
${tracks}
    </LinearAnimation>
  </Artboard>
</Rive>
`;

await writeFile(join(projectDir, 'scene.rml'), source);
