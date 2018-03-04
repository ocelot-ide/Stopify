/**
 * Entrypoint of the stopify-continuations bundle
 */

import { Runtime } from './abstractRuntime';
import { LazyRuntime } from './lazyRuntime';
import { EagerRuntime } from './eagerRuntime';
import { RetvalRuntime } from './retvalRuntime';
import { FudgeRuntime } from './fudgeRuntime';
import { LazyDeepRuntime } from './lazyDeepRuntime';

export * from './abstractRuntime';

let savedRTS: Runtime | undefined;
export function newRTS(transform: string) : Runtime {

  if (savedRTS) {
    return savedRTS;
  }
  else {
    switch (transform) {
      case 'lazy': savedRTS = new LazyRuntime(); break;
      case 'eager': savedRTS = new EagerRuntime(); break;
      case 'retval': savedRTS = new RetvalRuntime(); break;
      case 'lazyDeep': savedRTS = new LazyDeepRuntime(1000); break;
      case 'fudge': savedRTS = new FudgeRuntime(); break;
      default: throw new Error(`unknown runtime: ${transform}`);
    }

    return savedRTS;
  }
}

export const RV_SENTINAL = Symbol('rv_sentinal');
export const EXN_SENTINAL = Symbol('exn_sentinal');
