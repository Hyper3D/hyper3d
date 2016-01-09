/// <reference path="../Prefix.d.ts" />

import * as three from "three";

import { RendererCore } from "./RendererCore";

import {
    GLProgram,
    GLProgramUniforms,
    GLProgramAttributes
} from "./GLProgram";

import { VolumeTexture2DLayout } from "./TypedRenderBuffers";

import { clamp } from "../utils/Utils";

export class VolumeTexture2DFillShader
{
    private layout: VolumeTexture2DLayout;
    private uniforms: GLProgramUniforms;
    private attrs: GLProgramAttributes;
    private minSlice: number;
    private maxSlice: number;

    constructor(private core: RendererCore, private program: GLProgram)
    {
        this.layout = null;
        this.uniforms = program.getUniforms([
            "u_v2dSize",
            "u_v2dRange"
        ]);
        this.attrs = program.getAttributes(["a_position"]);
    }

    /** Configures the shader's uniform variables for the specified VolumeTexture2D layout.
     * GLProgram must be "use()"-d before calling this function.
     */
    setLayout(layout: VolumeTexture2DLayout): void
    {
        this.layout = layout;

        const gl = this.core.gl;
        gl.uniform4f(this.uniforms["u_v2dSize"],
            layout.numCols, layout.numRows, 1 / layout.numCols, 1 / layout.numRows);

        gl.uniform4f(this.uniforms["u_v2dRange"], 0, 0, 1, 1);

        this.minSlice = 0;
        this.maxSlice = layout.volumeDepth;
    }

    /** Must be called after setLayout. */
    setRange(min: three.Vector3, max: three.Vector3): void
    {
        const gl = this.core.gl;
        gl.uniform4f(this.uniforms["u_v2dRange"],
            clamp(min.x, 0, 1), clamp(min.y, 0, 1),
            clamp(max.x, 0, 1), clamp(max.y, 0, 1));

        const depth = this.layout.volumeDepth;
        this.minSlice = clamp(Math.round(min.z * depth), 0, depth);
        this.maxSlice = clamp(Math.round(max.z * depth), 0, depth);
    }

    render(): void
    {
        if (this.maxSlice <= this.minSlice) {
            return;
        }
        this.core.quadsRenderer.render(this.minSlice, this.maxSlice - this.minSlice,
            this.attrs["a_position"]);
    }


}
