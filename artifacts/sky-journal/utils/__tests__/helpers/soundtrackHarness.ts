import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import ts from 'typescript';

// Run the real screen callbacks with controlled platform boundaries. Node cannot
// import the React Native bridge; AST selection avoids copying production logic
// into tests or relying on line numbers / formatting to find a handler.
export function source(path: string) {
  return readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
}

function find(path: string, predicate: (node: ts.Node) => boolean): ts.Node {
  const text = source(path);
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let match: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (!match && predicate(node)) match = node;
    if (!match) ts.forEachChild(node, visit);
  }
  visit(file);
  if (!match) throw new Error(`Soundtrack harness could not find callback in ${path}`);
  return match;
}

export function callable(path: string, name: string): string {
  const node = find(path, node =>
    (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node))
    && node.name?.getText() === name,
  );
  if (ts.isFunctionDeclaration(node)) return `(${node.getText().replace(/^export\s+(default\s+)?/, '')})`;
  if (ts.isVariableDeclaration(node) && node.initializer) return node.initializer.getText();
  throw new Error(`Missing initializer for ${name}`);
}

export function focusCallback(path: string) {
  const node = find(path, node => ts.isCallExpression(node) && node.expression.getText() === 'useFocusEffect');
  return (node as ts.CallExpression).arguments[0].getText();
}

export function effectCallback(path: string, containing: string) {
  const node = find(path, node =>
    ts.isCallExpression(node) && node.expression.getText() === 'useEffect'
    && node.arguments[0]?.getText().includes(containing),
  ) as ts.CallExpression;
  return node.arguments[0].getText();
}

export function pressCallback(path: string, containing: string) {
  const node = find(path, node =>
    ts.isJsxAttribute(node) && node.name.getText() === 'onPress'
    && node.getText().includes(containing),
  ) as ts.JsxAttribute;
  const expression = node.initializer;
  if (!expression || !ts.isJsxExpression(expression) || !expression.expression) {
    throw new Error('Missing onPress expression');
  }
  return expression.expression.getText();
}

export function evaluate<T = (...args: any[]) => any>(expression: string, env: Record<string, unknown>): T {
  const js = ts.transpileModule(
    `return (${expression.replaceAll("const { Audio } = await import('@/utils/audioCompat');", '')});`,
    { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } },
  ).outputText;
  return new Function(...Object.keys(env), js)(...Object.values(env));
}

export async function flush() {
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
