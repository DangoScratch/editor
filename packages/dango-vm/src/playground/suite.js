const soon = (() => {
    let _soon: any;
    return () => {
        if (!_soon) {
            _soon = Promise.resolve()
                .then(() => {
                    _soon = null;
                });
        }
        return _soon;
    };
})();

class Emitter {
    _listeners: any;
    constructor () {
        Object.defineProperty(this, '_listeners', {
            value: {},
            enumerable: false
        });
    }
    on (name: any, listener: any, context: any) {
        if (!this._listeners[name]) {
            this._listeners[name] = [];
        }

        this._listeners[name].push(listener, context);
    }
    off (name: any, listener: any, context: any) {
        if (this._listeners[name]) {
            if (listener) {
                for (let i = 0; i < this._listeners[name].length; i += 2) {
                    if (
                        this._listeners[name][i] === listener &&
                        this._listeners[name][i + 1] === context) {
                        this._listeners[name].splice(i, 2);
                        i -= 2;
                    }
                }
            } else {
                for (let i = 0; i < this._listeners[name].length; i += 2) {
                    if (this._listeners[name][i + 1] === context) {
                        this._listeners[name].splice(i, 2);
                        i -= 2;
                    }
                }
            }
        }
    }
    emit (name: any, ...args: any[]) {
        if (this._listeners[name]) {
            for (let i = 0; i < this._listeners[name].length; i += 2) {
                this._listeners[name][i].call(this._listeners[name][i + 1] || this, ...args);
            }
        }
    }
}

class BenchFrameStream extends Emitter {
    frame: any;
    constructor (frame: any) {
        super();

        this.frame = frame;
        window.addEventListener('message', message => {
            this.emit('message', message.data);
        });
    }

    send (message: any) {
        this.frame.send(message);
    }
}

const benchmarkUrlArgs = (args: any) => [
    args.projectId,
    args.warmUpTime,
    args.recordingTime
].join(',');

const BENCH_MESSAGE_TYPE = {
    INACTIVE: 'BENCH_MESSAGE_INACTIVE',
    LOAD: 'BENCH_MESSAGE_LOAD',
    LOADING: 'BENCH_MESSAGE_LOADING',
    WARMING_UP: 'BENCH_MESSAGE_WARMING_UP',
    ACTIVE: 'BENCH_MESSAGE_ACTIVE',
    COMPLETE: 'BENCH_MESSAGE_COMPLETE'
};

class BenchUtil {
    benchArgs: any;
    benchStream: any;
    frame: any;
    constructor (frame: any) {
        this.frame = frame;
        this.benchStream = new BenchFrameStream(frame);
    }

    setFrameLocation (url: any) {
        this.frame.contentWindow.location.assign(url);
    }

    startBench (args: any) {
        this.benchArgs = args;
        this.setFrameLocation(`index.html#${benchmarkUrlArgs(args)}`);
    }

    pauseBench () {
        new Promise(resolve => setTimeout(resolve, 1000))
            .then(() => {
                this.benchStream.emit('message', {
                    type: BENCH_MESSAGE_TYPE.INACTIVE
                });
            });
    }

    resumeBench () {
        this.startBench(this.benchArgs);
    }

    renderResults (results: any) {
        this.setFrameLocation(
            `index.html#view/${btoa(JSON.stringify(results))}`
        );
    }
}

const BENCH_STATUS = {
    INACTIVE: 'BENCH_STATUS_INACTIVE',
    RESUME: 'BENCH_STATUS_RESUME',
    STARTING: 'BENCH_STATUS_STARTING',
    LOADING: 'BENCH_STATUS_LOADING',
    WARMING_UP: 'BENCH_STATUS_WARMING_UP',
    ACTIVE: 'BENCH_STATUS_ACTIVE',
    COMPLETE: 'BENCH_STATUS_COMPLETE'
};

class BenchResult {
    fixture: any;
    frames: any;
    opcodes: any;
    status: any;
    constructor ({
        fixture,
        status = BENCH_STATUS.INACTIVE,
        frames = null,
        opcodes = null
    }: any) {
        this.fixture = fixture;
        this.status = status;
        this.frames = frames;
        this.opcodes = opcodes;
    }
}

class BenchFixture extends Emitter {
    projectId: any;
    recordingTime: any;
    warmUpTime: any;
    constructor ({
        projectId,
        warmUpTime = 4000,
        recordingTime = 6000
    }: any) {
        super();

        this.projectId = projectId;
        this.warmUpTime = warmUpTime;
        this.recordingTime = recordingTime;
    }

    get id () {
        return `${this.projectId}-${this.warmUpTime}-${this.recordingTime}`;
    }

    run (util: any) {
        return new Promise(resolve => {
            util.benchStream.on('message', (message: any) => {
                const result = {
                    fixture: this,
                    status: BENCH_STATUS.STARTING,
                    frames: null,
                    opcodes: null
                };
                if (message.type === BENCH_MESSAGE_TYPE.INACTIVE) {
                    result.status = BENCH_STATUS.RESUME;
                } else if (message.type === BENCH_MESSAGE_TYPE.LOADING) {
                    result.status = BENCH_STATUS.LOADING;
                } else if (message.type === BENCH_MESSAGE_TYPE.WARMING_UP) {
                    result.status = BENCH_STATUS.WARMING_UP;
                } else if (message.type === BENCH_MESSAGE_TYPE.ACTIVE) {
                    result.status = BENCH_STATUS.ACTIVE;
                } else if (message.type === BENCH_MESSAGE_TYPE.COMPLETE) {
                    result.status = BENCH_STATUS.COMPLETE;
                    result.frames = message.frames;
                    result.opcodes = message.opcodes;
                    resolve(new BenchResult(result));
                    util.benchStream.off('message', null, this);
                }
                this.emit('result', new BenchResult(result));
            }, this);
            util.startBench(this);
        });
    }
}

class BenchSuiteResult extends Emitter {
    results: any;
    suite: any;
    constructor ({
        suite,
        results = []
    }: any) {
        super();

        this.suite = suite;
        this.results = results;

        if (suite) {
            suite.on('result', (result: any) => {
                if (result.status === BENCH_STATUS.COMPLETE) {
                    this.results.push(results);
                    this.emit('add', this);
                }
            });
        }
    }
}

class BenchSuite extends Emitter {
    fixtures: any;
    constructor (fixtures = []) {
        super();

        this.fixtures = fixtures;
    }

    add (fixture: any) {
        this.fixtures.push(fixture);
    }

    run (util: any) {
        return new Promise(resolve => {
            const fixtures = this.fixtures.slice();
            const results: any = [];
            const push = (result: any) => {
                result.fixture.off('result', null, this);
                results.push(result);
            };
            const emitResult = this.emit.bind(this, 'result');
            const pop = () => {
                const fixture = fixtures.shift();
                if (fixture) {
                    fixture.on('result', emitResult, this);
                    fixture.run(util)
                        .then(push)
                        .then(pop);
                } else {
                    resolve(new BenchSuiteResult({suite: this, results}));
                }
            };
            pop();
        });
    }
}

class BenchRunner extends Emitter {
    frame: any;
    suite: any;
    util: any;
    constructor ({
        frame,
        suite
    }: any) {
        super();

        this.frame = frame;
        this.suite = suite;
        this.util = new BenchUtil(frame);
    }

    run () {
        return this.suite.run(this.util);
    }
}

const viewNames = {
    [BENCH_STATUS.INACTIVE]: 'Inactive',
    [BENCH_STATUS.RESUME]: 'Resume',
    [BENCH_STATUS.STARTING]: 'Starting',
    [BENCH_STATUS.LOADING]: 'Loading',
    [BENCH_STATUS.WARMING_UP]: 'Warming Up',
    [BENCH_STATUS.ACTIVE]: 'Active',
    [BENCH_STATUS.COMPLETE]: 'Complete'
};

class BenchResultView {
    benchUtil: any;
    compare: any;
    dom: any;
    result: any;
    constructor ({
        result,
        benchUtil
    }: any) {
        this.result = result;
        this.compare = null;
        this.benchUtil = benchUtil;
        this.dom = document.createElement('div');
    }

    update (result: any) {
        soon().then(() => this.render(result));
    }

    resume () {
        this.benchUtil.resumeBench();
    }

    setFrameLocation (loc: any) {
        this.benchUtil.pauseBench();
        this.benchUtil.setFrameLocation(loc);
    }

    act (ev: any) {
        if (
            ev.type === 'click' &&
            ev.button === 0 &&
            !(ev.altKey || ev.ctrlKey || ev.shiftKey || ev.metaKey)
        ) {
            let target = ev.target;
            while (target && target.tagName.toLowerCase() !== 'a') {
                target = target.parentElement;
            }
            if (target && target.tagName.toLowerCase() === 'a') {
                if (target.href) {
                    this.setFrameLocation(target.href);
                    ev.preventDefault();
                }
            } else if (ev.currentTarget.classList.contains('resume')) {
                this.resume();
            }
        }
    }

    render (newResult = this.result, compareResult = this.compare) {
        const newResultFrames = (newResult.frames ? newResult.frames : []).filter((i: any) => i);
        const blockFunctionFrame = newResultFrames
            .find((frame: any) => frame.name === 'blockFunction');
        const stepThreadsInnerFrame = newResultFrames
            .find((frame: any) => frame.name === 'Sequencer.stepThreads#inner');

        const blocksPerSecond = blockFunctionFrame ?
            (blockFunctionFrame.executions /
                (stepThreadsInnerFrame.totalTime / 1000)) | 0 :
            0;
        const stepsPerSecond = stepThreadsInnerFrame ?
            (stepThreadsInnerFrame.executions /
                (stepThreadsInnerFrame.totalTime / 1000)) | 0 :
            0;

        const compareResultFrames = (
            compareResult && compareResult.frames ?
                compareResult.frames :
                []
        );
        const blockFunctionCompareFrame = compareResultFrames
            .find((frame: any) => frame.name === 'blockFunction');
        const stepThreadsInnerCompareFrame = compareResultFrames
            .find((frame: any) => frame.name === 'Sequencer.stepThreads#inner');

        const compareBlocksPerSecond = blockFunctionCompareFrame ?
            (blockFunctionCompareFrame.executions /
                (stepThreadsInnerCompareFrame.totalTime / 1000)) | 0 :
            0;
        const compareStepsPerSecond = stepThreadsInnerCompareFrame ?
            (stepThreadsInnerCompareFrame.executions /
                (stepThreadsInnerCompareFrame.totalTime / 1000)) | 0 :
            0;

        const statusName = viewNames[newResult.status];

        this.dom.className = `result-view ${
            viewNames[newResult.status].toLowerCase()
        }`;
        this.dom.onclick = this.act.bind(this);
        let url = `index.html#${benchmarkUrlArgs(newResult.fixture)}`;
        if (newResult.status === BENCH_STATUS.COMPLETE) {
            url = `index.html#view/${btoa(JSON.stringify(newResult))}`;
        }
        let compareUrl = url;
        if (compareResult && compareResult) {
            compareUrl =
                `index.html#view/${btoa(JSON.stringify(compareResult))}`;
        }
        let compareHTML = '';
        if (stepThreadsInnerFrame && stepThreadsInnerCompareFrame) {
            compareHTML = `<a href="${compareUrl}" target="_blank">
                <div class="result-status">
                <div>${compareStepsPerSecond}</div>
                <div>${compareBlocksPerSecond}</div>
                </div>
            </a>`;
        }
        this.dom.innerHTML = `
            <div class="fixture-project">
                <a href="${url}" target="bench_frame"
                    >${newResult.fixture.projectId}</a>
            </div>
            <div class="result-status">
                <div>${stepThreadsInnerFrame ? `steps/s` : ''}</div>
                <div>${blockFunctionFrame ? `blocks/s` : statusName}</div>
            </div>
            <a href="${stepThreadsInnerFrame ? url : ''}" target="_blank">
                <div class="result-status">
                <div>${stepThreadsInnerFrame ? `${stepsPerSecond}` : ''}</div>
                <div>${blockFunctionFrame ? `${blocksPerSecond}` : ''}</div>
                </div>
            </a>
            ${compareHTML}
            <div class="">
            Run for ${newResult.fixture.recordingTime / 1000} seconds after
            ${newResult.fixture.warmUpTime / 1000} seconds
            </div>
        `;

        this.result = newResult;
        return this;
    }
}

class BenchSuiteResultView {
    dom: any;
    runner: any;
    suite: any;
    views: any;
    constructor ({
        runner
    }: any) {
        const {suite, util} = runner;

        this.runner = runner;
        this.suite = suite;
        this.views = {};
        this.dom = document.createElement('div');

        for (const fixture of suite.fixtures) {
            this.views[fixture.id] = new BenchResultView({
                result: new BenchResult({fixture}),
                benchUtil: util
            });
        }

        suite.on('result', (result: any) => {
            this.views[result.fixture.id].update(result);
        });
    }

    render () {
        this.dom.innerHTML = `<div class="legend">
            <span>Project ID</span>
            <div class="result-status">
                <div>steps per second</div>
                <div>blocks per second</div>
            </div>
            <div>Description</div>
        </div>

        <div class="legend">
            <span>&nbsp;</span>
            <div class="result-status">
                <div><a href="#" onclick="window.download(this)">
                    Save Reports
                </a></div>
            </div>
            <div class="result-status">
                <a href="#"><label for="compare-file">Compare Reports<input
                    id="compare-file" type="file"
                    class="compare-file"
                    accept="application/json"
                    onchange="window.upload(this)" />
                </label></a>
            </div>
        </div>`;

        for (const fixture of this.suite.fixtures) {
            this.dom.appendChild(this.views[fixture.id].render().dom);
        }

        return this;
    }
}

let suite: any;
let suiteView: any;

// @ts-expect-error TS(2339): Property 'upload' does not exist on type 'Window &... Remove this comment to see the full error message
window.upload = function (_this: any) {
    if (!_this.files.length) {
        return;
    }
    const reader = new FileReader();
    reader.onload = function () {
        // @ts-expect-error TS(2345): Argument of type 'string | ArrayBuffer | null' is ... Remove this comment to see the full error message
        const report = JSON.parse(reader.result);
        Object.values(suiteView.views)
            .forEach(view => {
                const sameFixture = report.results.find((result: any) => result.fixture.projectId ===
                    // @ts-expect-error TS(2571): Object is of type 'unknown'.
                    view.result.fixture.projectId &&
                result.fixture.warmUpTime ===
                    // @ts-expect-error TS(2571): Object is of type 'unknown'.
                    view.result.fixture.warmUpTime &&
                result.fixture.recordingTime ===
                    // @ts-expect-error TS(2571): Object is of type 'unknown'.
                    view.result.fixture.recordingTime);

                if (sameFixture) {
                    if (
                        // @ts-expect-error TS(2571): Object is of type 'unknown'.
                        view.result && view.result.frames &&
                        // @ts-expect-error TS(2571): Object is of type 'unknown'.
                        view.result.frames.length > 0
                    ) {
                        // @ts-expect-error TS(2571): Object is of type 'unknown'.
                        view.render(view.result, sameFixture);
                    } else {
                        // @ts-expect-error TS(2571): Object is of type 'unknown'.
                        view.compare = sameFixture;
                    }
                }
            });
    };
    reader.readAsText(_this.files[0]);
};

// @ts-expect-error TS(2551): Property 'download' does not exist on type 'Window... Remove this comment to see the full error message
window.download = function (_this: any) {
    const blob = new Blob([JSON.stringify({
        meta: {
            source: 'Scratch VM Benchmark Suite',
            version: 1
        },
        results: Object.values(suiteView.views)
            // @ts-expect-error TS(2571): Object is of type 'unknown'.
            .map(view => view.result)
            .filter(view => view.status === BENCH_STATUS.COMPLETE)
    })], {type: 'application/json'});

    _this.download = 'scratch-vm-benchmark.json';
    _this.href = URL.createObjectURL(blob);
};

window.onload = function () {
    suite = new BenchSuite();

    const add = (projectId: any, warmUp = 0, recording = 5000) => {
        suite.add(new BenchFixture({
            projectId,
            warmUpTime: warmUp,
            recordingTime: recording
        }));
    };

    const standard = (projectId: any) => {
        add(projectId, 0, 5000);
        add(projectId, 5000, 5000);
    };

    add(130041250, 0, 2000); // floating blocks
    add(130041250, 4000, 6000);

    add(14844969, 0, 2000); // scratch cats
    add(14844969, 1000, 6000);

    standard(173918262); // bouncy heros
    standard(155128646); // stacky build
    standard(89811578); // solar system
    standard(139193539); // pixel art maker
    standard(187694931); // spiralgraph
    standard(219313833); // sensing_touching benchmark
    standard(236115215); // touching color benchmark
    standard(238750909); // bob ross painting (heavy pen stamp)

    const frame = document.getElementsByTagName('iframe')[0];
    const runner = new BenchRunner({frame, suite});
    const resultsView = suiteView = new BenchSuiteResultView({runner}).render();

    document.getElementsByClassName('suite-results')[0]
        .appendChild(resultsView.dom);

    runner.run();
};
