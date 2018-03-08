/**
 * This module contains functions to check and normalize compiler options.
 */

import { CompilerOpts } from '../types';

const validFlags = [
  'compileFunction',
  'getters',
  'debug',
  'captureMethod',
  'newMethod',
  'eval',
  'es',
  'hofs',
  'jsArgs',
  'requireRuntime',
  'externals'
];

/**
 * If 'src.key' exists: (1) throws if 'pred(src.key)' is false then (2)
 * copies 'src.key' to 'dst.value'.
 */
export function copyProp(dst: any, src: any, key: string,
  pred: (value: any) => boolean, errorMessage: string): void {
  if (src[key] === undefined) {
    return;
  }

  if (!pred(src[key])) {
    throw new Error(errorMessage);
  }
  dst[key] = src[key];
}

/**
 * If 'src.key' exists: (1) applies 'f(src.key)', (2) throws if 'pred' does not
 * hold on the result, and (3) copies the result to 'dst.value'.
 */
export function transformProp(dst: any, src: any, key: string,
  f: (value: any) => any,
  pred: (value: any) => boolean, errorMessage: string): void {
  if (src[key] === undefined) {
    return;
  }
  const value = f(src[key]);

  if (!pred(value)) {
    throw new Error(errorMessage);
  }
  dst[key] = value;
}

/**
 * Given a partial 'CompilerOpts', fill in sensible defaults and dynamically
 * enforce type and value checks.
 *
 * @param value a 'CompilerOpts' with elided fields
 */
export function checkAndFillCompilerOpts(value: Partial<CompilerOpts>): CompilerOpts {
  if (value === null || typeof value !== 'object') {
    throw new Error(`expected an object for CompilerOpts`);
  }

  Object.keys(value).forEach(key => {
    if (!validFlags.includes(key)) {
      throw new Error(`invalid flag: ${key}`);
    }
  });

  const opts: CompilerOpts = {
    compileFunction: false,
    getters: false,
    debug: false,
    captureMethod: 'lazy',
    newMethod: 'direct',
    eval: false,
    es: 'sane',
    hofs: 'builtin',
    jsArgs: 'simple',
    requireRuntime: false,
    sourceMap: undefined,
    externals: [
      "Object",
      "exports",
      "require",
      "console",
      "global",
      "window",
      "document",
      "setTimeout",
      "captureCC"
    ]
  };

  copyProp(opts, value, 'compileFunction',
    (x) => typeof x === 'boolean',
    `.compileFunction must be a boolean`);
  copyProp(opts, value, 'getters',
    (x) => typeof x === 'boolean',
    `.getters must be a boolean`);
  copyProp(opts, value, 'debug',
    (x) => typeof x === 'boolean',
    `.debug must be a boolean`);
  copyProp(opts, value, 'captureMethod',
    (x) => ['lazy', 'eager', 'retval', 'fudge'].includes(x),
    `.captureMethod must be 'lazy', 'eager', 'retval', or 'fudge'`);
  copyProp(opts, value, 'newMethod',
    (x) => ['direct', 'wrapper'].includes(x),
    `.newMethod must be 'direct' or 'wrapper'`);
  copyProp(opts, value, 'eval',
    (x) => typeof x === 'boolean',
    `.eval must be a boolean`);
  copyProp(opts, value, 'es',
    (x) => ['sane', 'es5'].includes(x),
    `.es must be either 'sane' or 'es5'`);
  copyProp(opts, value, 'jsArgs',
    (x) => ['simple', 'faithful', 'full'].includes(x),
    `.jsArgs must be either 'simple', 'faithful', or 'full'`);
  copyProp(opts, value, 'hofs',
    (x) => ['builtin', 'fill'].includes(x),
    `.hofs must be either 'builtin' or 'fill'`);
  copyProp(opts, value, 'requireRuntime',
    (x) => typeof x == 'boolean',
    `.requireRuntime must be a boolean`);
  // TODO(arjun): enforce pre-condition
  copyProp(opts, value, 'sourceMap',
    (x) => true,
    '');
  copyProp(opts, value, 'externals',
    (x) => x instanceof Array && x.every(y => typeof y === 'string'),
    `.externals must be an array of strings`);

  return opts;
}
