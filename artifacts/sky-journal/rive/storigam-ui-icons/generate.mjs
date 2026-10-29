import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const projectDir = dirname(fileURLToPath(import.meta.url));
const icons = [
  { artboard: 'Back', file: 'Back.png' },
  { artboard: 'Settings', file: 'Settings.png' },
  { artboard: 'Home', file: 'Home.png' },
  { artboard: 'Reels', file: 'Reels.png' },
  { artboard: 'Create', file: 'Create.png' },
  { artboard: 'Discover', file: 'Discover.png' },
  { artboard: 'Profile', file: 'Profile.png' },
];

let nextId = 2;
const id = () => `0:${nextId++}`;
const boards = [];
const assetIds = new Map();

for (const [index, icon] of icons.entries()) {
  const boardId = id();
  const styleId = id();
  const machineId = id();
  const layerId = id();
  const stateId = id();
  const imageId = id();
  const ringId = id();
  const ringPathId = id();
  const ringStrokeId = id();
  const ringColorId = id();
  const sparkleId = id();
  const sparklePathId = id();
  const sparkleFillId = id();
  const sparkleColorId = id();
  const animationId = id();
  const assetId = id();
  assetIds.set(icon.file, assetId);

  const keyedProperty = (property, frames) => `
          <KeyedProperty propertyKey="${property}">
${frames.map(([value, frame]) => `            <KeyFrameDouble value="${value}" interpolationType="1"${frame === null ? '' : ` frame="${frame}"`}/>`).join('\n')}
          </KeyedProperty>`;

  boards.push(`
  <Artboard x="${index * 96}" y="0" defaultStateMachineId="${machineId}" width="64" height="64" styleId="${styleId}" name="${icon.artboard}" id="${boardId}">
    <LayoutComponentStyle name="${icon.artboard} Icon Style" id="${styleId}"/>
    <Image x="32" y="32" scaleX="0.84" scaleY="0.84" assetId="${assetId}" name="${icon.artboard} Icon" id="${imageId}"/>
    <Shape x="32" y="32" opacity="0" name="Soft Halo" id="${ringId}">
      <Ellipse width="59" height="59" name="Halo Ring" id="${ringPathId}">
        <Stroke thickness="1.5" cap="round" name="Halo Stroke" id="${ringStrokeId}">
          <SolidColor colorValue="779B78FF" name="Violet" id="${ringColorId}"/>
        </Stroke>
      </Ellipse>
    </Shape>
    <Shape x="49" y="12" opacity="0" name="Passing Spark" id="${sparkleId}">
      <Ellipse width="4.5" height="4.5" name="Spark Point" id="${sparklePathId}">
        <Fill name="Spark Fill" id="${sparkleFillId}">
          <SolidColor colorValue="FFE9D7FF" name="Soft Lilac" id="${sparkleColorId}"/>
        </Fill>
      </Ellipse>
    </Shape>
    <StateMachine name="IconSweep" id="${machineId}">
      <StateMachineLayer name="Motion" id="${layerId}">
        <EntryState><StateTransition stateToId="${stateId}"/></EntryState>
        <AnimationState x="32" y="0" animationId="${animationId}" id="${stateId}"/>
      </StateMachineLayer>
    </StateMachine>
    <LinearAnimation fps="30" duration="18" loopValue="oneShot" name="Subtle Halo Sweep" id="${animationId}">
      <KeyedObject objectId="${ringId}">
        ${keyedProperty('18', [[0, null], [0.28, 5], [0, 18]])}
        ${keyedProperty('16', [[0.94, null], [1.03, 7], [1, 18]])}
        ${keyedProperty('17', [[0.94, null], [1.03, 7], [1, 18]])}
      </KeyedObject>
      <KeyedObject objectId="${sparkleId}">
        ${keyedProperty('13', [[49, null], [56, 5], [49, 10], [23, 14], [14, 18]])}
        ${keyedProperty('14', [[12, null], [27, 5], [49, 10], [55, 14], [38, 18]])}
        ${keyedProperty('18', [[0, null], [0.9, 4], [0.55, 10], [0, 18]])}
      </KeyedObject>
    </LinearAnimation>
  </Artboard>`);
}

const assets = icons.map(({ artboard, file }) =>
  `  <ImageAsset file="assets/${file}" name="${artboard} Icon" id="${assetIds.get(file)}"/>`,
).join('\n');

const source = `<Rive version="1" kind="fragment">
${boards.join('\n')}

${assets}
</Rive>
`;

await writeFile(join(projectDir, 'scene.rml'), source);
