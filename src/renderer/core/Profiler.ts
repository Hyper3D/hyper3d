/// <reference path="../Prefix.d.ts" />
/// <reference path="../gl/EXTDisjointTimerQuery.d.ts" />

import { RendererCore } from "./RendererCore";

import {
    WebGLHyperRendererProfilerResult,
    WebGLHyperRendererProfilerPhase
} from "../public/WebGLHyperRenderer";

import { Logger } from "../utils/Logger";

import {
    fillWith,
    fillWithRightAligned,
    stringRepeat
} from "../utils/Utils";

interface Phase
{
    name: string;
    begin: number;
    end: number;
    subphases: Phase[];
}

const enum State
{
    Inactive,
    Profiling,
    WaitingForMeasurement
}

export class Profiler
{
    private ext: EXTDisjointTimerQuery;
    private queries: WebGLTimerQueryEXT[];
    private nextIndex: number;
    private activePhases: Phase[];
    private state: State;
    private callback: (result: WebGLHyperRendererProfilerResult) => void;
    private queryRunning: boolean;

    constructor(private core: RendererCore, private logger: Logger)
    {
        this.ext = core.ext.get("EXT_disjoint_timer_query");
        this.queries = [];
        this.nextIndex = 0;
        this.activePhases = [];
        this.state = State.Inactive;
        this.callback = null;
        this.queryRunning = false;
    }

    begin(name: string): void
    {
        if (this.state != State.Profiling) {
            return;
        }
        const index = this.markTime(false);
        const lastPhase = this.activePhases[this.activePhases.length - 1];
        const phase: Phase = {
            begin: index,
            end: 0,
            name: name,
            subphases: []
        };
        if (lastPhase) {
            lastPhase.subphases.push(phase);
        }
        this.activePhases.push(phase);
    }

    end(): void
    {
        if (this.state != State.Profiling) {
            return;
        }
        const index = this.markTime(true);
        const lastPhase = this.activePhases.pop();
        if (!lastPhase) {
            throw new Error("Unmatched Profiler.begin/end. Too many ends.");
        }
        lastPhase.end = index;
    }

    dispose(): void
    {
        for (const q of this.queries) {
            this.ext.deleteQueryEXT(q);
        }
        this.queries = [];
    }

    startProfiling(callback: (result: WebGLHyperRendererProfilerResult) => void): void
    {
        if (this.state == State.Inactive) {
            if (!this.ext) {
                this.logger.error("Cannot start profiling because EXT_disjoint_timer_query is not available.");
                return;
            }

            this.state = State.Profiling;
        }
        this.callback = callback;
    }

    stopProfiling(): void
    {
        this.state = State.Inactive;
        this.callback = null;
        this.dispose(); // delete all queries
    }

    private checkMeasurementReady(): void
    {
        if (this.state != State.WaitingForMeasurement) {
            return;
        }

        const queries = this.queries;
        const numObjs = this.nextIndex;
        for (let i = 0; i < numObjs; ++i) {
            if (!this.ext.getQueryObjectEXT(queries[i], this.ext.QUERY_RESULT_AVAILABLE_EXT)) {
                return;
            }
        }

        // query result is ready
        this.state = State.Profiling;

        const root = this.activePhases.pop();
        if (!root) {
            throw new Error();
        }

        const timing = [0];
        let time = 0;
        for (let i = 0; i < numObjs; ++i) {
            time += this.ext.getQueryObjectEXT(queries[i], this.ext.QUERY_RESULT_EXT);
            timing.push(time);
        }

        const resultPhases: WebGLHyperRendererProfilerPhase[] = [];

        function traverse(phase: Phase, level: number, last: boolean): void
        {
            let s = "";
            for (let i = 0; i < level; ++i) {
                s += i == level - 1 ? (last ? "└ " : "├ ") : "│";
            }

            s += phase.name;
            resultPhases.push({
                name: s,
                time: timing[phase.end] - timing[phase.begin]
            });

            for (const subphase of phase.subphases) {
                traverse(subphase, level + 1, subphase == phase.subphases[phase.subphases.length - 1]);
            }
        }
        traverse(root, 0, true);

        const result: WebGLHyperRendererProfilerResult = {
            phases: resultPhases
        };

        const colLen = [40, 10, 20];
        this.logger.warn("Profiling done. \n" +
            `| ${fillWith("Phase", colLen[0], " ")} | ${fillWithRightAligned("Time", colLen[1], " ")} | ${stringRepeat(" ", colLen[2])} |\n` +
            `| ${stringRepeat("-", colLen[0])} | ${stringRepeat("-", colLen[1])} | ${stringRepeat("-", colLen[2])} |\n` +
            resultPhases.map((phase) => {
                const name = phase.name;
                const timeStr = `${Math.floor(phase.time)}`;
                const bar = Math.min(Math.ceil(phase.time / 1500000 * colLen[2]), colLen[2]);
                return `| ${fillWith(name, colLen[0], " ")} | ${fillWithRightAligned(timeStr, colLen[1], " ")} | ` +
                    `${fillWith(stringRepeat("▓", bar), colLen[2], "░")} |`;
            }).join("\n"));

        if (this.callback) {
            this.callback(result);
        }
    }

    beginFrame(): void
    {
        this.checkMeasurementReady();
        if (this.state != State.Profiling) {
            return;
        }

        this.nextIndex = 0;
        this.queryRunning = false;
        this.activePhases = [];
        this.begin("Frame");
    }

    finalizeFrame(): void
    {
        if (this.state != State.Profiling) {
            this.checkMeasurementReady();

            return;
        }

        if (this.activePhases.length > 1) {
            throw new Error("Unmatched Profiler.begin/end. Too many begins.");
        }
        const root = this.activePhases[0];
        this.end();
        this.activePhases.push(root);

        this.state = State.WaitingForMeasurement;

        this.checkMeasurementReady();
    }



    private markTime(end: boolean): number
    {
        if (this.queryRunning) {
            this.ext.endQueryEXT(this.ext.TIME_ELAPSED_EXT);
            this.queryRunning = false;
            this.nextIndex++;
        }

        if (!end) {
            if (this.nextIndex >= this.queries.length) {
                this.queries.push(this.ext.createQueryEXT());
            }
            this.ext.beginQueryEXT(this.ext.TIME_ELAPSED_EXT, this.queries[this.nextIndex]);
            this.queryRunning = true;
        }

        return this.nextIndex;
    }
}
