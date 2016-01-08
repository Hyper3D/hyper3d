/// <reference path="../Prefix.d.ts" />

import * as three from "three";

import {
    RendererCore
} from "../core/RendererCore";

import { CenteredNoise } from "../utils/PoissonDiskSampler";

export class RenderingController
{
    lastJitX: number;
    lastJitY: number;
    screenVelOffX: number;
    screenVelOffY: number;

    private jitGen: CenteredNoise;

    jitteredProjectiveMatrix: three.Matrix4;

    constructor(private core: RendererCore)
    {
        this.lastJitX = this.lastJitY = 0;
        this.screenVelOffX = this.screenVelOffY = 0;

        this.jitGen = new CenteredNoise();

        this.jitteredProjectiveMatrix = new three.Matrix4();
    }

    beforeRender(): void
    {
        // jitter projection matrix for temporal AA
        const projMat = this.jitteredProjectiveMatrix;
        projMat.copy(this.core.currentCamera.projectionMatrix);

        const jitScale = (this.core.useWiderTemporalAA ? 2 : 1) * 1.5;
        const jit = this.jitGen.sample();
        const jitX = jit.x / this.core.renderWidth * jitScale;
        const jitY = jit.y / this.core.renderHeight * jitScale;
        for (let i = 0; i < 4; ++i) {
            projMat.elements[(i << 2)] += projMat.elements[(i << 2) + 3] * jitX;
            projMat.elements[(i << 2) + 1] += projMat.elements[(i << 2) + 3] * jitY;
        }
        this.screenVelOffX = this.lastJitX - jitX;
        this.screenVelOffY = this.lastJitY - jitY;
        this.lastJitX = jitX;
        this.lastJitY = jitY;
    }

    dispose(): void
    {
    }
}
