import { normalize } from '../ts';
import * as vm from 'vm';

function normalizeEquiv(original: string) {
    let compiled = normalize(original);
    let originalResult = vm.runInNewContext(original);
    let normalizedResult = vm.runInNewContext(compiled);
    // Sanity check: a test that produces undefined is unlikely to be useful.
    expect(originalResult).not.toBe(undefined);
    expect(normalizedResult).toEqual(originalResult);
}

test('simple for loop', () => {
    normalizeEquiv(`
        let r = 0;
        for (let i = 0; i < 3; i++) {
            r = r + i;
        }
        r;
        `);
});

test('for loop without block body', () => {
    normalizeEquiv(`
        let r = 0;
        for (let i = 0; i < 3; i++) {
            r = r + i;
        }
        r;
        `);
});

test('ternary short-circuit', () => {
    normalizeEquiv(`
        function foo() {
            throw 'This should not be called'
        }
        true ? 1 : foo()
        `);
});

test('ternary left method call short-circuit', () => {
    normalizeEquiv(`
        let x = 0;
        let y = 0;
        function foo() {
            x++;
            return {
                bar() {
                    y++;
                }
            }
        }
        let r = true ? foo().bar() : false;
        ({ x: x, y: y });
        `);
});

test('conjunction and function call in loop guard', () => {
    normalizeEquiv(`
        let i = 0;
        let j = 6;
        function f() {
            return (i++ % 2) === 0;
        }

        while (f() && j++) { }
        ({ i: i, j: j });
    `);
});

test('and should evaluate its LHS just once', () => {
    normalizeEquiv(`
        var count = 0;
        function f() {
            count++;
            return false;
        }
        var tmp = f() && true;
        ({ count: count });
       `);
});

test('applications in array literal must be evaluated in order', () => {
    normalizeEquiv(`
        function foo() {
            let counter = 0;

            function bar() {
                return ++counter;
            }

            return [
                counter,
                bar(),
                bar(),
            ];
        }

        var r = foo();
        r;
    `);
});

test('simple for .. in loop', () => {
    normalizeEquiv(`
        const obj = {
            a: 0,
            b: 1,
            c: 2,
        };
        let r = [ ];
        for (const prop in obj) {
            r.push(obj[prop]);
        }
        r;
    `);
});

test('using var like let*', () => {
    normalizeEquiv(`
        var a = { x: 100 }, y = a.x;
        y === 100;
    `);
});

test('left-to-right evaluation of +: application on LHS', () => {
    normalizeEquiv(`
        let x = 1;
        function a() {
             x += 1;
             return 1;
        }
        a() + x;
    `);
});

test.skip('left-to-right evaluation of +: application on RHS', () => {
    normalizeEquiv(`
        let x = 1;
        function a() {
             x += 1;
             return 1;
        }
        x + a();
    `);
});

test('left-to-right evaluation of +: application on both sides', () => {
    normalizeEquiv(`
        let x = 1;
        function a() { x += 1; return 1; }
        function b() { x *= 10; return 2; }
        a() + b();
    `);
});

test('and short-circuiting: method call on RHS', () => {
    normalizeEquiv(`
        let x = 0;
        let y = 0;
        function foo() {
            x++;
            return {
                bar() {
                    y++;
                }
            }
        }
        false && foo().bar();
        ({ x: x, y: y });
    `);
});

test('and not short-circuiting: method call on RHS', () => {
    normalizeEquiv(`
        let x = 0;
        let y = 0;
        function foo() {
            x++;
            return {
                bar() {
                    y++;
                }
            }
        }

        true && foo().bar();
        ({ x: x, y: y });
    `);
});

test('assignments in sequence expression', () => {
    normalizeEquiv(`
        function g() {
            return 1;
        }
        function f(x) {
            var y = x;
            var dummy = g(), z = y;
            return z;
        };
        var r = f(100);
        r;
    `);
});

test('break in for loop', () => {
    normalizeEquiv(`
        let sum = 0;
        for(let i = 0; i < 5; i++) {
            sum += i;
            if (i === 3) break;
        }
        sum;
    `);
});

test('function declaration hoisting (based on code generated by Dart2js)', () => {
    // TODO(arjun): This test should produce something.
    normalizeEquiv(`
        let r = (function () {
            function Isolate() {
            }
            init();
            function init() {
            Isolate.$isolateProperties = Object.create(null);
            Isolate.$finishIsolateConstructor = function (oldIsolate) {
                var isolateProperties = oldIsolate.$isolateProperties;
                function Isolate() {
                }
                Isolate.$isolateProperties = isolateProperties;
                return Isolate;
            };
            }
            Isolate = Isolate.$finishIsolateConstructor(Isolate);
        })();
        true;
    `);
});

test('function declaration hoisting (also based on code generated by Dart2js)', () => {
    normalizeEquiv(`
        function Isolate() {
        }
        var init = function() {
          Date.now();
          Isolate.method = function (oldIsolate) {
              return 50;
          };
        }
        init();
        Isolate = Isolate.method(Isolate);
        Isolate;
    `);
});

test('nested ternary expressions', () => {
    normalizeEquiv(`
        function Foo() {}
        function Bar() {}
        function Baz() {}

        function foo() {
            const o = {};
            return (o.left instanceof Foo) ? new Baz(o.left.error) :
                ((o.right instanceof Bar) ?  new Baz(o.right.error) : 7);
        }
        var r = foo();
        r;
    `);
});

test('short-circuiting with && and ||', () => {
    normalizeEquiv(`
        const f = false;
        let x = 0;
        f && (x++ === 7);
        f || (x++ === 7);
        x;
    `);
});

test('left-to-right evaluation: application in second argument assigns to variable referenced in first argument', () => {
    normalizeEquiv(`
        function foo() {
            let counter = 0;
            function bar(c1, c2) {
                ++counter;
                return c1;
            }
            return bar(counter, bar(counter));
        }
        let r = foo();
        r;
    `);
});

test('computed method call', () => {
    normalizeEquiv(`
        function foo() { return 7; }
        let r = foo['call']({});
        r;
    `);
});

test('switch fallthrough test', () => {
    normalizeEquiv(`
        let test = 'test';
        let test2;
        switch (test) {
        case 'baz':
            test = 'baz';
        case 'test':
        case 'foo':
        case 'bar':
            test2 = test;
        default:
            test = 'baz';
        }
        ({ test: test, test2: test2 });
    `);
});

test('local variable with the same name as the enclosing function', () => {
    normalizeEquiv(`
        var BAR = function BAR2() {
            while(false);
        }

        var x = function FOO() {
            var FOO = 100;
            BAR();
            return FOO;
        }
        let r = x();
        r;
    `);
});

test('pointless: calling increment', () => {
    normalizeEquiv(`
        function inc(x) { return x + 1; }
        const a = (function (x, y) { return inc(x) + inc(y) })(1, 2)
        a;
    `);
});

test('continue to a label in a for loop', () => {
    normalizeEquiv(`
        let i = 0;
        l: for (let j = 0; j < 10; j++) {
            if (j % 2 === 0) {
                i++;
                do {
                    continue l;
                } while (0);
                i++;
            }
        }
        i;
    `);
});

test('continue to a label in a nested loop', () => {
    normalizeEquiv(`
        var i = 0;
        var j = 8;

        checkiandj: while (i < 4) {
            i += 1;

            checkj: while (j > 4) {
                j -= 1;

                if ((j % 2) === 0) {
                    i = 5;
                    continue checkj;
                }
            }
        }
        ({i: i, j: j});
    `);
});

test('continue to a label in a nested loop', () => {
    normalizeEquiv(`
        var i = 0;
        var j = 8;

        checkiandj: while (i < 4) {
            i += 1;

            checkj: while (j > 4) {
                j -= 1;
                if ((j % 2) === 0) {
                    i = 5;
                    continue checkiandj;
                }
            }
        }
        ({i: i, j: j});
    `);
});

test('applications in object literal', () => {
    normalizeEquiv(`
        function foo() {
            let counter = 0;
            function bar() {
                return ++counter;
            }
            return {
                a: counter,
                b: bar(),
                c: bar()
            };
        }

        const o = foo();
        o;
    `);
});

test('|| short-circuiting: method call on RHS with true on LHS', () => {
    // TODO(arjun): Ensure we don't trivially simplify true || X to true.
    normalizeEquiv(`
        function foo() {
            throw 'bad';
            return {
                bar() {
                    throw 'very bad';
                }
            };
        }
        true || foo().bar();
        true;
    `);
});

test('|| short-circuiting: method call on RHS with false on LHS', () => {
    // TODO(arjun): Ensure we don't trivially simplify false || X to X.
    normalizeEquiv(`
        let x = 0;
        let y = 0;
        function foo() {
            x++;
            return {
                bar() {
                    y++;
                }
            }
        }
        false || foo().bar();
        ({ x: x, y: y });
    `);
});

test('sequencing expression in loop guard', () => {
    normalizeEquiv(`
        var i = 0;
        var j = 0;
        var loop = true;
        while(i = i + 1, loop) {
            j = j + 1;
            loop = j < 2;
        }
        i;
    `);
});

test('sequencing with application in loop guard', () => {
    normalizeEquiv(`
        var x = 0;
        var r;
        function AFUNCTION() {
            x++;
            r =  x < 2;
        }
        while(AFUNCTION(), r) { }
        x;
    `);
});

test('sequencing: applications occur in order', () => {
    normalizeEquiv(`
        var i = 0;
        let j = 0;
        let k = 0;
        function f() {
            j = i;
            i = 1;
        }

        function g() {
            k = i;
            i = 2;
        }

        function h() {
            return f(), g(), i;
        }
        h();
        ({ i: i, j: j, k: k });
    `);
});

test('switch in a while loop', () => {
    normalizeEquiv(`
        const tst = 'foo';

        let x = 0;
        let i = 0;

        while (i++ < 10) {
            switch (tst) {
                case 'bar':
                    throw 'A';
                    break;
                case 'foo': {
                    x++;
                    break;
                    }
                default:
                    throw 'B';
            }
            if (i !== x) {
                throw 'C';
            }
        }
        x;
    `);
});

test('break out of while(true)', () => {
    normalizeEquiv(`
        let i = 0;
        while (true) {
            i++;
            if (i === 10)
                break;
        }
        i;
    `);
});

test('return statement in while(true)', () => {
    normalizeEquiv(`
        function foo() {
            let i = 0;
            while (true) {
                if (++i > 9) {
                return i;
                }
            }
        }
        let r = foo();
        r;
    `);
});

test('uninitialized variable', () => {
    normalizeEquiv(`
        let t;
        t = 1;
        t;
    `);
});