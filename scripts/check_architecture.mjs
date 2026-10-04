import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../game/package.json', import.meta.url));
const ts = require('typescript');
const defaultRoot = fileURLToPath(new URL('../game/src/', import.meta.url));
const pureLayers = new Set(['modules', 'content']);
const forbiddenGlobals = new Set([
  'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'fetch',
  'globalThis', 'global', 'self', 'Buffer',
  'XMLHttpRequest', 'WebSocket', 'Audio', 'AudioContext', 'Image', 'Worker',
  'HTMLElement', 'HTMLCanvasElement', 'HTMLImageElement', 'Document', 'Window',
  'FileReader', 'console', 'process', 'require', 'setTimeout', 'clearTimeout',
  'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
  'performance', 'Phaser', 'Element', 'Node', 'Event', 'EventTarget', 'CustomEvent',
  'PointerEvent', 'KeyboardEvent', 'MouseEvent', 'TouchEvent', 'DOMRect',
  'DOMParser', 'Storage', 'URL', 'URLSearchParams', 'Blob', 'File',
  'BroadcastChannel', 'location', 'history', 'screen',
  'CanvasRenderingContext2D', 'OffscreenCanvas', 'ImageData', 'MediaStream',
  'MessagePort', 'Request', 'Response', 'Headers', 'FormData',
]);
const productionFile = name => /\.[cm]?[tj]sx?$/.test(name) && !/\.(?:test|spec)\.[cm]?[tj]sx?$/.test(name);
const slash = value => value.replaceAll('\\', '/');

function collect(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...collect(path));
    else if (entry.isFile() && productionFile(entry.name)) files.push(path);
  }
  return files.sort();
}

function referenceIdentifier(node) {
  const parent = node.parent;
  if (!parent) return false;
  // Property names and declarations are not references to browser globals.
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  if ((ts.isPropertySignature(parent) || ts.isPropertyDeclaration(parent) ||
       ts.isMethodDeclaration(parent) || ts.isMethodSignature(parent)) && parent.name === node) return false;
  if ((ts.isVariableDeclaration(parent) || ts.isParameter(parent) ||
       ts.isFunctionDeclaration(parent) || ts.isTypeAliasDeclaration(parent) ||
       ts.isInterfaceDeclaration(parent)) && parent.name === node) return false;
  if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isImportClause(parent)) return false;
  return true;
}

function typeOnly(node) {
  if (ts.isImportTypeNode(node)) return true;
  if (ts.isImportEqualsDeclaration(node)) return node.isTypeOnly;
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    if (clause?.isTypeOnly) return true;
    return !clause?.name && clause?.namedBindings && ts.isNamedImports(clause.namedBindings) &&
      clause.namedBindings.elements.length > 0 && clause.namedBindings.elements.every(item => item.isTypeOnly);
  }
  if (ts.isExportDeclaration(node)) {
    return node.isTypeOnly || (node.exportClause && ts.isNamedExports(node.exportClause) &&
      node.exportClause.elements.length > 0 && node.exportClause.elements.every(item => item.isTypeOnly));
  }
  return false;
}

/** AST-based dependency gate. Tests supply an isolated source tree. */
export function checkArchitecture(sourceRoot = defaultRoot) {
  const root = resolve(sourceRoot);
  const diagnostics = [];
  const compilerOptions = { moduleResolution: ts.ModuleResolutionKind.Bundler, resolveJsonModule: true };
  for (const file of collect(root)) {
    const path = slash(relative(root, file));
    const layer = path.split('/')[0];
    if (!pureLayers.has(layer) && layer !== 'platform') continue;
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const report = (node, rule, message) => {
      const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
      diagnostics.push({ path, line: line + 1, column: character + 1, rule, message });
    };
    const checkImport = (node, specifier) => {
      if (!specifier || !ts.isStringLiteralLike(specifier)) {
        report(node, 'dynamic-import', 'Imports must use a literal path so the dependency boundary can be checked.');
        return;
      }
      const name = specifier.text;
      if (!name.startsWith('.')) {
        if (pureLayers.has(layer)) report(node, 'external-import', `${layer} cannot import external package ${JSON.stringify(name)}.`);
        else if (name.startsWith('node:')) report(node, 'browser-platform', 'Browser platform adapters cannot import Node I/O.');
        return;
      }
      const resolved = ts.resolveModuleName(name, file, compilerOptions, ts.sys).resolvedModule?.resolvedFileName;
      if (!resolved) { report(node, 'unresolved-import', `Cannot resolve ${JSON.stringify(name)}.`); return; }
      const target = slash(relative(root, resolved));
      const targetLayer = target.split('/')[0];
      if (target.startsWith('../') || /\.(?:test|spec)\.[cm]?[tj]sx?$/.test(target)) {
        report(node, 'source-boundary', `Production code cannot import ${JSON.stringify(target)}.`);
      } else if (layer === 'modules' && targetLayer !== 'modules') {
        report(node, 'module-boundary', `modules may only depend on modules; found ${JSON.stringify(target)}.`);
      } else if (layer === 'content') {
        if (targetLayer !== 'content' && targetLayer !== 'modules') {
          report(node, 'content-boundary', `content may only depend on content or module types; found ${JSON.stringify(target)}.`);
        } else if (targetLayer === 'modules' && !typeOnly(node)) {
          report(node, 'content-types', `content must use a type-only import/export for ${JSON.stringify(target)}.`);
        }
      } else if (layer === 'platform' && (
        ['app', 'scenes', 'story', 'world', 'presentation'].includes(targetLayer) ||
        /^content\/(?:chapters|encounters)\//.test(target)
      )) {
        report(node, 'platform-boundary', `Generic platform adapters cannot depend on scene/chapter adapters or composition: ${JSON.stringify(target)}.`);
      }
    };
    const visit = node => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) checkImport(node, node.moduleSpecifier);
      else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) checkImport(node, node.moduleReference.expression);
      else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) checkImport(node, node.argument.literal);
      else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        checkImport(node, node.arguments[0]);
        if (pureLayers.has(layer)) report(node, 'pure-load', `${layer} cannot load code asynchronously. Composition owns dynamic imports.`);
      }
      if (pureLayers.has(layer) && ts.isIdentifier(node) && (forbiddenGlobals.has(node.text) || /^HTML\w*Element$/.test(node.text)) && referenceIdentifier(node)) {
        report(node, 'pure-code', `${layer} cannot reference runtime/DOM/I/O global ${node.text}. Pass data or a port into an adapter instead.`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return diagnostics.sort((a, b) => a.path.localeCompare(b.path, 'en') || a.line - b.line || a.column - b.column || a.rule.localeCompare(b.rule, 'en'));
}

export const formatDiagnostic = d => `${d.path}:${d.line}:${d.column} [${d.rule}] ${d.message}`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const diagnostics = checkArchitecture();
  for (const diagnostic of diagnostics) console.error(formatDiagnostic(diagnostic));
  if (diagnostics.length) process.exitCode = 1;
  else console.log('Architecture boundaries passed.');
}
