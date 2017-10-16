import { setImmediate } from '../setImmediate';
import { ElapsedTimeEstimator } from '../elapsedTimeEstimator';
import { knowns } from '../common/cannotCapture'
import * as assert from 'assert';

// The type of continuation frames
export type KFrame = KFrameTop | KFrameRest;

export interface KFrameTop {
  kind: 'top';
  f: () => any;
  value: any;
}

export interface KFrameRest {
  kind: 'rest';
  f: () => any;   // The function we are in
  locals: any[];  // All locals and parameters
  index: number;  // At this application index
  value: any;     // value to restore from
}

export type Stack = KFrame[];

// The type of execution mode, whether normally computing or restoring state
// from a captured `Stack`.
export type Mode = boolean;

// We throw this exception when a continuation value is applied. i.e.,
// captureCC applies its argument to a function that throws this exception.
export class Restore {
  constructor(public stack: Stack) {}
}

// We throw this exception to capture the current continuation. i.e.,
// captureCC throws this exception when it is applied. This class needs to be
// exported because source programs are instrumented to catch it.
export class Capture {
  constructor(public f: (k: any) => any, public stack: Stack) {}
}

export class Discard {
  constructor(public f: () => any) {}
}

interface RuntimeInterface {
  captureCC(f: (k: any) => any): void;
  // Wraps a stack in a function that throws an exception to discard the current
  // continuation. The exception carries the provided stack with a final frame
  // that returns the supplied value.
  makeCont(stack: Stack): (v: any) => any;
  runtime(body: () => any): any;
  handleNew(constr: any, ...args: any[]): any;
}

export abstract class Runtime {
  stack: Stack;
  mode: Mode;
  linenum: undefined | number;
  remainingStack: number;
  /* Enable deep stack. Turn off if your language doesn't need deep stacks
   * for improved performance
   */
  deepStacks: boolean;

  constructor(
    public yieldInterval: number,
    public estimator: ElapsedTimeEstimator,
    /* The default is 500 from Pyret */
    public stackSize: number = 500,
    public capturing: boolean = false,
    private delimitDepth: number = 0,
    // true if computation is suspended by 'suspend'
    private isSuspended: boolean = false,
    // a queue of computations that need to run
    private pendingRuns: (() => void)[] = [],
    /** This function is applied immediately before stopify yields control to
     *  the browser's event loop. If the function produces 'false', the
     *  computation terminates.
     */
    public onYield = function(): boolean { return true; },
    private continuation = function() {}) {
    this.stack = [];
    this.mode = true;
    this.deepStacks = isNaN(stackSize) === false;
    this.stackSize = stackSize;
    this.remainingStack = this.stackSize;
  }

  private runtime_(thunk: () => any) {
    this.delimitDepth++;
    this.runtime(thunk);
    this.delimitDepth--;
  }

  resumeFromSuspension(thunk: () => any): any {
    this.isSuspended = false;
    this.runtime_(thunk);
    this.resume();
  }

  resumeFromCaptured(): any {
    this.resumeFromSuspension(this.continuation);
  }

  /**
   * Evaluates 'thunk' either now or later.
   */
  delimit(thunk: () => any): any {
    if (this.isSuspended === false) {
      this.runtime_(thunk);
      if (this.delimitDepth === 0) {
        this.resume();
      }
    }
    else {
      return this.pendingRuns.push(thunk);
    }
  }

  resume(): any {
    if (this.isSuspended) {
      return;
    }
    if (this.pendingRuns.length > 0) {
      return this.delimit(this.pendingRuns.shift()!);
    }
  }

  suspend(): void {
    assert(!this.isSuspended);

    // Do not suspend at the top-level of required modules.
    if (this.delimitDepth > 1) {
      return;
    }

    --this.remainingStack;
    // If this.yieldInterval is NaN, the condition will be false
    if (this.estimator.elapsedTime() >= this.yieldInterval ||
        (this.deepStacks && this.remainingStack <= 0)) {
      this.estimator.reset();
      this.isSuspended = true;
      this.remainingStack = this.stackSize;
      return this.captureCC((continuation) => {
        this.continuation = continuation;
        if (this.onYield()) {
          return setImmediate(() => {
            this.resumeFromSuspension(continuation);
          });
        }
      });
    }
  }

  topK(f: () => any): KFrameTop {
    return {
      kind: 'top',
      f: () => {
        this.stack = [];
        this.mode = true;
        return f();
      },
      value: undefined
    };
  }

  abstract captureCC(f: (k: any) => any): void;
  // Wraps a stack in a function that throws an exception to discard the current
  // continuation. The exception carries the provided stack with a final frame
  // that returns the supplied value.
  abstract makeCont(stack: Stack): (v: any) => any;
  abstract runtime(body: () => any): any;
  abstract handleNew(constr: any, ...args: any[]): any;
}

export const knownBuiltIns = knowns.map(o => eval(o))
