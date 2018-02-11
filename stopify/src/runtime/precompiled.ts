import { Runtime } from "stopify-continuations/dist/src/runtime/abstractRuntime";
import { AsyncRun, Opts } from "../types";
import { makeEstimator } from "./elapsedTimeEstimator";
import { RuntimeWithSuspend } from "./suspend";

// We need to provide these for stopify-continuations
export * from "stopify-continuations/dist/src/runtime/runtime";

// For testing / benchmarking convenience.
export { parseRuntimeOpts } from "../cli-parse";

let runner: Runner | undefined;

class Runner implements AsyncRun {
  private continuationsRTS: Runtime;
  private suspendRTS: RuntimeWithSuspend;
  private onDone: () => void = function() { return; };
  private onYield: () => void = function() { return; };
  private onBreakpoint: (line: number) => void = function() { return; };
  private breakpoints: number[] = [];

  constructor(private url: string, private opts: Opts) { }

  public mayYieldRunning(): boolean {
    const n = this.suspendRTS.rts.linenum;
    if (typeof n !== "number") {
      return false;
    }
    return this.breakpoints.includes(n);
  }

  public onYieldRunning() {
    if (this.mayYieldRunning()) {
      this.onBreakpoint(this.suspendRTS.rts.linenum!);
      return false;
    } else {
      this.onYield();
      return true;
    }
  }

  /**
   * Indirectly called by the stopified program.
   */
  public init(rts: Runtime) {
    this.continuationsRTS = rts;
    const estimator = makeEstimator(this.opts);
    this.suspendRTS = new RuntimeWithSuspend(this.continuationsRTS,
      this.opts.yieldInterval, estimator);
    this.suspendRTS.mayYield = () => this.mayYieldRunning();
    this.suspendRTS.onYield = () => this.onYieldRunning();
    return this;
  }

  /**
   * Called by the stopified program.
   */
  public suspend() {
    return this.suspendRTS.suspend();
  }

  /**
   * Called by the stopfied program.
   */
  public onEnd(): void {
    this.onDone();
  }

  public run(onDone: () => void,
             onYield?: () => void,
             onBreakpoint?: (line: number) => void) {
    if (onYield) {
      this.onYield = onYield;
    }
    if (onBreakpoint) {
      this.onBreakpoint = onBreakpoint;
    }
    this.onDone = onDone;
    const script = document.createElement("script");
    script.setAttribute("src", this.url);
    document.body.appendChild(script);
  }

  public pause(onPaused: (line?: number) => void) {
    this.suspendRTS.onYield = () => {
      this.suspendRTS.onYield = () => {
        this.onYield();
        return true;
      };
      const maybeLine = this.suspendRTS.rts.linenum;
      if (typeof maybeLine === "number") {
        onPaused(maybeLine);
      } else {
        onPaused();
      }
      return false;
    };
  }

  public setBreakpoints(lines: number[]): void {
    this.breakpoints = lines;
  }

  public resume() {
    this.suspendRTS.mayYield = () => this.mayYieldRunning();
    this.suspendRTS.onYield = () => this.onYieldRunning();
    this.suspendRTS.resumeFromCaptured();
  }

  public step(onStep: (line: number) => void) {
    const currentLine = this.suspendRTS.rts.linenum;
    // Yield control if the line number changes.
    const mayYield = () => {
      const n = this.suspendRTS.rts.linenum;
      if (typeof n !== "number") {
        return false;
      }
      if (n !== currentLine) {
        onStep(n);
        return true;
      } else {
        return false;
      }
    };
    this.suspendRTS.mayYield = mayYield;
    // Pause if the line number changes.
    this.suspendRTS.onYield = () => !mayYield();
    this.suspendRTS.resumeFromCaptured();
  }

}

/**
 * Called by the stopified program to get suspend() and other functions.
 */
export function init(rts: Runtime): AsyncRun {
  if (runner === undefined) {
    throw new Error("stopify not called");
  }
  return runner.init(rts);
}

/**
 * Control the execution of a pre-compiled program.
 *
 * @param url URL of a pre-compiled program
 * @param opts runtime settings
 */
export function stopify(url: string, opts: Opts): AsyncRun {
  runner = new Runner(url, opts);
  return runner;
}
