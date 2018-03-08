import * as f from './testFixtures.js';

const copts = "--eval --js-args=full";
const ropts = "--estimator countdown -y 1"

describe('call/cc', function() {
  f.unitTests.forEach(function(filename: string) {
    f.callCCTest(filename, `-t lazy ${copts}`, ropts);
    f.callCCTest(filename, `-t lazy --new wrapper ${copts}`, ropts)
    // Heap bounded stacks.
    f.callCCTest(filename, `-t lazy ${copts}`,
      "--stack-size 1000 --restore-frames 1");
    f.callCCTest(filename, `-t eager ${copts}`, ropts);
    f.callCCTest(filename, `-t retval ${copts}`, ropts);
  });
});
