import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = dirname(fileURLToPath(import.meta.url));
let nextId = 2;
const id = () => `0:${nextId++}`;

const artboards = [
  {
    id: 'frame_baby_dragon',
    name: 'Baby Dragon',
    image: 'baby-dragon.png',
    zones: [
      { name: 'breath', x: 384, y: 390, rx: 390, ry: 390, role: 'body' },
      { name: 'head', x: 384, y: 190, rx: 180, ry: 145, role: 'head' },
      { name: 'left-wing', x: 230, y: 270, rx: 170, ry: 185, role: 'wing-left' },
      { name: 'right-wing', x: 538, y: 270, rx: 170, ry: 185, role: 'wing-right' },
      { name: 'left-paw', x: 201, y: 393, rx: 82, ry: 92, role: 'paw-left' },
      { name: 'right-paw', x: 567, y: 393, rx: 82, ry: 92, role: 'paw-right' },
      { name: 'tail', x: 575, y: 644, rx: 178, ry: 135, role: 'tail' },
    ],
    eye: { x: [0.42, 0.58], y: 0.245, lid: '#B48BCC', stroke: '#714A84' },
    motion: {
      'breath': { y: [0, -2, -1.5, 1.1, 0] },
      'head': { rotation: [0, -0.009, 0.003, 0.008, 0] },
      'left-wing': { rotation: [0, -0.078, 0.014, 0.06, 0] },
      'right-wing': { rotation: [0, 0.066, -0.015, -0.052, 0] },
      'left-paw': { x: [0, 5, 6.5, 1.8, 0], rotation: [0, -0.024, -0.028, 0.004, 0] },
      'right-paw': { x: [0, -5, -6.5, -1.8, 0], rotation: [0, 0.024, 0.028, -0.004, 0] },
      'tail': { rotation: [0, 0.014, 0.025, 0.012, 0] },
    },
  },
  {
    id: 'frame_moon_bunny',
    name: 'Moon Bunny',
    image: 'moon-bunny.png',
    zones: [
      { name: 'breath', x: 384, y: 430, rx: 390, ry: 390, role: 'body' },
      { name: 'head', x: 384, y: 190, rx: 185, ry: 150, role: 'head' },
      { name: 'left-ear-root', x: 147, y: 260, rx: 135, ry: 245, role: 'ear-left' },
      { name: 'left-ear-tip', x: 86, y: 88, rx: 105, ry: 130, role: 'ear-tip-left' },
      { name: 'right-ear-root', x: 621, y: 260, rx: 135, ry: 245, role: 'ear-right' },
      { name: 'right-ear-tip', x: 682, y: 88, rx: 105, ry: 130, role: 'ear-tip-right' },
      { name: 'left-paw', x: 174, y: 536, rx: 110, ry: 115, role: 'paw-left' },
      { name: 'right-paw', x: 594, y: 536, rx: 110, ry: 115, role: 'paw-right' },
    ],
    eye: { x: [0.445, 0.555], y: 0.265, lid: '#F2DEE5', stroke: '#9B697E' },
    motion: {
      'breath': { y: [0, -1.9, -1.3, 0.9, 0] },
      'head': { rotation: [0, 0.009, 0.004, -0.01, 0] },
      'left-ear-root': { rotation: [0, -0.065, -0.035, 0.028, 0] },
      'left-ear-tip': { rotation: [0, -0.09, 0.02, 0.07, 0] },
      'right-ear-root': { rotation: [0, 0.035, 0.07, -0.018, 0] },
      'right-ear-tip': { rotation: [0, 0.075, -0.025, -0.085, 0] },
      'left-paw': { x: [0, 3.8, 5, 1.2, 0], rotation: [0, -0.018, -0.022, 0, 0] },
      'right-paw': { x: [0, -3.8, -5, -1.2, 0], rotation: [0, 0.018, 0.022, 0, 0] },
    },
  },
  {
    id: 'frame_shadow_keeper',
    name: 'Shadow Keeper',
    image: 'shadow-keeper.png',
    zones: [
      { name: 'breath', x: 384, y: 420, rx: 390, ry: 390, role: 'body' },
      { name: 'head', x: 384, y: 178, rx: 180, ry: 145, role: 'head' },
      { name: 'left-ear', x: 210, y: 126, rx: 118, ry: 150, role: 'ear-left' },
      { name: 'right-ear', x: 558, y: 126, rx: 118, ry: 150, role: 'ear-right' },
      { name: 'left-paw', x: 196, y: 426, rx: 104, ry: 110, role: 'paw-left' },
      { name: 'right-paw', x: 572, y: 426, rx: 104, ry: 110, role: 'paw-right' },
      { name: 'left-tail', x: 176, y: 652, rx: 155, ry: 125, role: 'tail-left' },
      { name: 'right-tail', x: 593, y: 646, rx: 155, ry: 125, role: 'tail-right' },
    ],
    eye: { x: [0.42, 0.58], y: 0.29, lid: '#251432', stroke: '#B66AFF', glow: '#C879FF' },
    motion: {
      'breath': { y: [0, -1.8, -0.9, 1.1, 0] },
      'head': { x: [0, -3, 0.4, 3.5, 0], rotation: [0, -0.01, 0.002, 0.01, 0] },
      'left-ear': { rotation: [0, -0.048, 0.012, 0.034, 0] },
      'right-ear': { rotation: [0, 0.04, -0.012, -0.03, 0] },
      'left-paw': { x: [0, 4.5, 6, 1.2, 0], rotation: [0, -0.02, -0.024, 0, 0] },
      'right-paw': { x: [0, -4.5, -6, -1.2, 0], rotation: [0, 0.02, 0.024, 0, 0] },
      'left-tail': { rotation: [0, -0.012, -0.02, -0.008, 0] },
      'right-tail': { rotation: [0, 0.013, 0.021, 0.008, 0] },
    },
  },
  {
    id: 'frame_forest_spirit',
    name: 'Forest Spirit',
    image: 'forest-spirit.png',
    zones: [
      { name: 'breath', x: 384, y: 418, rx: 390, ry: 390, role: 'body' },
      { name: 'head', x: 384, y: 205, rx: 180, ry: 150, role: 'head' },
      { name: 'left-leaves', x: 190, y: 240, rx: 150, ry: 185, role: 'leaf-left' },
      { name: 'right-leaves', x: 578, y: 240, rx: 150, ry: 185, role: 'leaf-right' },
      { name: 'left-hand', x: 196, y: 420, rx: 95, ry: 105, role: 'paw-left' },
      { name: 'right-hand', x: 572, y: 420, rx: 95, ry: 105, role: 'paw-right' },
      { name: 'tail', x: 486, y: 664, rx: 190, ry: 110, role: 'tail' },
    ],
    eye: { x: [0.44, 0.56], y: 0.27, lid: '#C3D0A8', stroke: '#61754F' },
    motion: {
      'breath': { y: [0, -2, -1.4, 1, 0] },
      'head': { rotation: [0, -0.008, 0.006, 0.01, 0] },
      'left-leaves': { rotation: [0, -0.035, 0.014, 0.025, 0] },
      'right-leaves': { rotation: [0, 0.032, -0.016, -0.023, 0] },
      'left-hand': { x: [0, 3.7, 5, 1.1, 0], rotation: [0, -0.018, -0.02, 0, 0] },
      'right-hand': { x: [0, -3.7, -5, -1.1, 0], rotation: [0, 0.018, 0.02, 0, 0] },
      'tail': { rotation: [0, 0.013, 0.02, 0.009, 0] },
    },
  },
  {
    id: 'frame_star_guardian',
    name: 'Star Guardian',
    image: 'star-guardian.png',
    zones: [
      { name: 'breath', x: 384, y: 410, rx: 390, ry: 390, role: 'body' },
      { name: 'head', x: 384, y: 190, rx: 180, ry: 145, role: 'head' },
      { name: 'left-wing', x: 190, y: 330, rx: 190, ry: 240, role: 'wing-left' },
      { name: 'right-wing', x: 578, y: 330, rx: 190, ry: 240, role: 'wing-right' },
      { name: 'left-paw', x: 212, y: 416, rx: 92, ry: 108, role: 'paw-left' },
      { name: 'right-paw', x: 556, y: 416, rx: 92, ry: 108, role: 'paw-right' },
      { name: 'halo', x: 384, y: 68, rx: 132, ry: 72, role: 'halo' },
    ],
    eye: { x: [0.43, 0.57], y: 0.275, lid: '#E6F0FC', stroke: '#6479A2' },
    motion: {
      'breath': { y: [0, -1.9, -1.2, 1, 0] },
      'head': { rotation: [0, 0.008, 0.012, -0.006, 0] },
      'left-wing': { rotation: [0, -0.06, -0.015, 0.045, 0] },
      'right-wing': { rotation: [0, 0.052, 0.014, -0.04, 0] },
      'left-paw': { x: [0, 3.7, 5, 1.1, 0], rotation: [0, -0.018, -0.02, 0, 0] },
      'right-paw': { x: [0, -3.7, -5, -1.1, 0], rotation: [0, 0.018, 0.02, 0, 0] },
      'halo': { rotation: [0, 0.018, 0.028, 0.012, 0] },
    },
  },
];

const roles = {
  anchor: { influence: 1.0 },
  body: { influence: 0.24, keepHole: true },
  head: { influence: 1.0 },
  'wing-left': { influence: 1.0 },
  'wing-right': { influence: 1.0 },
  'ear-left': { influence: 1.0 },
  'ear-right': { influence: 1.0 },
  'ear-tip-left': { influence: 0.9 },
  'ear-tip-right': { influence: 0.9 },
  'paw-left': { influence: 1.0 },
  'paw-right': { influence: 1.0 },
  'leaf-left': { influence: 0.85 },
  'leaf-right': { influence: 0.85 },
  'tail': { influence: 0.9 },
  'tail-left': { influence: 0.9 },
  'tail-right': { influence: 0.9 },
  'halo': { influence: 1.0 },
};

const gridSize = 21;
const frames = [0, 60, 120, 180, 240];
const propertyKeys = { x: 90, y: 91, rotation: 15 };
const format = value => Number(value.toFixed(3)).toString();
const quote = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;');

function weightFor(zone, x, y, holeCenterY) {
  const dx = (x - zone.x) / zone.rx;
  const dy = (y - zone.y) / zone.ry;
  const distance = dx * dx + dy * dy;
  if (distance >= 1.6) return 0;
  return Math.exp(-2.15 * distance) * (roles[zone.role]?.influence ?? 1);
}

function packedBytes(values) {
  return values.reduce((packed, value, index) => packed + (value << (index * 8)), 0) >>> 0;
}

function meshWeight(zones, x, y) {
  const anchorIndex = zones.findIndex(zone => zone.role === 'anchor');
  const radius = Math.hypot(x - 384, y - 430);
  if (radius < 174) {
    return { values: 255, indices: anchorIndex + 1 };
  }

  const local = zones
    .filter(zone => zone.role !== 'body' && zone.role !== 'anchor')
    .map(zone => ({ index: zones.indexOf(zone), score: weightFor(zone, x, y, 430) }))
    .filter(item => item.score > 0.055)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  const bodyIndex = zones.findIndex(zone => zone.role === 'body');
  const bodyWeight = bodyIndex >= 0 ? 18 : 0;
  const anchorWeight = 12;
  const remaining = 255 - bodyWeight - anchorWeight;
  const total = local.reduce((sum, item) => sum + item.score, 0);
  if (!total) {
    return {
      values: packedBytes([bodyIndex >= 0 ? 24 : 0, bodyIndex >= 0 ? 231 : 0, 0, 0]),
      indices: packedBytes([bodyIndex >= 0 ? bodyIndex + 1 : anchorIndex + 1, bodyIndex >= 0 ? anchorIndex + 1 : 0, 0, 0]),
    };
  }

  const weighted = local.map(item => Math.round((item.score / total) * remaining));
  weighted[0] += remaining - weighted.reduce((sum, value) => sum + value, 0);
  const values = [bodyWeight, ...weighted, anchorWeight];
  const indices = [bodyIndex + 1, ...local.map(item => item.index + 1), anchorIndex + 1];
  while (values.length < 4) { values.push(0); indices.push(0); }
  return { values: packedBytes(values.slice(0, 4)), indices: packedBytes(indices.slice(0, 4)) };
}

function encodeVaruint(value) {
  const bytes = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value) byte |= 0x80;
    bytes.push(byte);
  } while (value);
  return bytes;
}

function makeMesh(zones, imageAssetId, imageName, ids) {
  const cells = gridSize - 1;
  const coords = [];
  for (let column = 0; column < gridSize; column++) coords.push([0, column]);
  for (let row = 1; row < gridSize - 1; row++) coords.push([row, gridSize - 1]);
  for (let column = gridSize - 1; column >= 0; column--) coords.push([gridSize - 1, column]);
  for (let row = gridSize - 2; row > 0; row--) coords.push([row, 0]);
  for (let row = 1; row < gridSize - 1; row++) {
    for (let column = 1; column < gridSize - 1; column++) coords.push([row, column]);
  }

  const vertexIndex = new Map(coords.map(([row, column], index) => [`${row},${column}`, index]));
  const triangles = [];
  for (let row = 0; row < cells; row++) {
    for (let column = 0; column < cells; column++) {
      const topLeft = vertexIndex.get(`${row},${column}`);
      const topRight = vertexIndex.get(`${row},${column + 1}`);
      const bottomLeft = vertexIndex.get(`${row + 1},${column}`);
      const bottomRight = vertexIndex.get(`${row + 1},${column + 1}`);
      triangles.push(topLeft, topRight, bottomRight, topLeft, bottomRight, bottomLeft);
    }
  }
  const triangleBytes = triangles.flatMap(encodeVaruint);
  const triangleIndexBytes = Buffer.from(triangleBytes).toString('base64');

  const vertices = coords.map(([row, column], index) => {
    const px = (column / cells) * 768;
    const py = (row / cells) * 768;
    const x = px - 384;
    const y = py - 384;
    const tag = index < 4 * cells ? 'ContourMeshVertex' : 'MeshVertex';
    const weight = meshWeight(zones, px, py);
    return `<${tag} x="${format(x)}" y="${format(y)}" u="${format(column / cells)}" v="${format(row / cells)}" name="Vertex ${index}">
          ${weight ? `<Weight values="${weight.values}" indices="${weight.indices}"/>` : ''}
        </${tag}>`;
  }).join('\n');

  const tendons = zones.map((zone, index) => {
    const bone = ids.bones[index];
    return `<Tendon boneId="${bone}" tx="${format(zone.x - 384)}" ty="${format(zone.y - 384)}" name="${quote(zone.name)}"/>`;
  }).join('\n        ');

  return `<Image x="384" y="384" assetId="${imageAssetId}" name="${quote(imageName)}" id="${ids.image}">
      <Mesh triangleIndexBytes="${triangleIndexBytes}" name="${quote(imageName)} mesh" id="${ids.mesh}">
        ${vertices}
        <Skin tx="0" ty="0" name="${quote(imageName)} skin">
          ${tendons}
        </Skin>
      </Mesh>
    </Image>`;
}

function keyedObject(objectId, properties) {
  const tracks = Object.entries(properties).map(([property, values]) => {
    const framesForProperty = values.map((value, index) => {
      const frame = frames[index];
      const curve = index === values.length - 1
        ? ''
        : '<CubicEaseInterpolator x1="0.33" y1="0.02" x2="0.67" y2="0.98"/>';
      return `<KeyFrameDouble value="${format(value)}" frame="${frame}" interpolationType="${curve ? 'cubic' : 'linear'}">${curve}</KeyFrameDouble>`;
    }).join('\n');
    return `<KeyedProperty propertyKey="${propertyKeys[property]}">${framesForProperty}</KeyedProperty>`;
  }).join('\n');
  return `<KeyedObject objectId="${objectId}">${tracks}</KeyedObject>`;
}

function makeArtboard(config, assetId, stageX) {
  const artboardId = id();
  const styleId = id();
  const machineId = id();
  const layerId = id();
  const stateId = id();
  const animationId = id();
  const imageId = id();
  const meshId = id();
  const ids = { image: imageId, mesh: meshId, bones: [] };

  const zones = [{ name: 'aperture-anchor', x: 384, y: 384, rx: 1, ry: 1, role: 'anchor' }, ...config.zones];
  const bones = zones.map(zone => {
    const boneId = id();
    ids.bones.push(boneId);
    return `<RootBone x="${zone.x}" y="${zone.y}" length="1" rotation="0" name="${quote(zone.name)}" id="${boneId}"/>`;
  }).join('\n    ');

  const tracks = zones.map((zone, index) => {
    const motion = config.motion[zone.name] ?? {};
    const properties = {};
    for (const [property, offsets] of Object.entries(motion)) {
      const base = property === 'x' ? zone.x : property === 'y' ? zone.y : 0;
      properties[property] = offsets.map(offset => base + offset);
    }
    return keyedObject(ids.bones[index], properties);
  }).join('\n');

  return {
    asset: `<ImageAsset file="../../assets/images/dp-companions/${config.image}" name="${config.id}" id="${assetId}"/>`,
    board: `<Artboard x="${stageX}" y="0" styleId="${styleId}" defaultStateMachineId="${machineId}" width="768" height="768" name="${quote(config.name)}" id="${artboardId}">
    <LayoutComponentStyle name="${quote(`${config.name} style`)}" id="${styleId}"/>
    ${bones}
    ${makeMesh(zones, assetId, config.name, ids)}
    <StateMachine name="CompanionLoop" id="${machineId}">
      <StateMachineLayer name="Idle breathing and gesture" id="${layerId}">
        <EntryState><StateTransition stateToId="${stateId}"/></EntryState>
        <AnimationState x="180" y="0" animationId="${animationId}" id="${stateId}"/>
      </StateMachineLayer>
    </StateMachine>
    <LinearAnimation fps="60" duration="240" loopValue="loop" name="Living idle 4s" id="${animationId}">
      ${tracks}
    </LinearAnimation>
  </Artboard>`,
  };
}

const assets = [];
const boards = [];
for (const [index, config] of artboards.entries()) {
  const assetId = id();
  const result = makeArtboard(config, assetId, index * 900);
  assets.push(result.asset);
  boards.push(result.board);
}

const source = `<Rive version="1" kind="fragment">
  ${assets.join('\n  ')}
  ${boards.join('\n  ')}
</Rive>
`;

await writeFile(join(projectDir, 'scene.rml'), source);
