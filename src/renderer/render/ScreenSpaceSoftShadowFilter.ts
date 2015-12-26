/// <reference path="../Prefix.d.ts" />

import * as three from "three";

import {
    TextureRenderBuffer
} from "../core/RenderBuffers";

import {
    RenderOperator
} from "../core/RenderPipeline";

import {
    RendererCore,
    GLStateFlags
} from "../core/RendererCore";

import {
    GLProgram,
    GLProgramUniforms,
    GLProgramAttributes
} from "../core/GLProgram";

import { GLFramebuffer } from "../core/GLFramebuffer";

import {
    computeViewVectorCoefFromProjectionMatrix,
    ViewVectors
} from "../utils/Geometry";

export const enum ScreenSpaceSoftShadowDirection
{
    Horitonzal,
    Vertical
}

const enum ProgramFlags
{
    Zero = 0,
    PositionalLight = 1 << 0
}

// FIXME: use the standard rendering pipeline operation model

export class ScreenSpaceSoftShadowRendererInstance implements RenderOperator
{
    private fb: GLFramebuffer;

    private program: {
        program: GLProgram;
        uniforms: GLProgramUniforms;
        attributes: GLProgramAttributes;
    }[];

    light: three.Light;
    viewVec: ViewVectors;

    constructor(
        private core: RendererCore,
        private input: TextureRenderBuffer,
        private inLinearDepth: TextureRenderBuffer,
        private out: TextureRenderBuffer,
        private dir: ScreenSpaceSoftShadowDirection
    )
    {

        this.fb = GLFramebuffer.createFramebuffer(core.gl, {
            depth: null,
            colors: [
                out.texture
            ]
        });

        this.light = null;

        this.program = [];

        for (let i = 0; i < 2; ++i) {
            const program = core.shaderManager.get("VS_ScreenSpaceSoftShadow", "FS_ScreenSpaceSoftShadow",
                ["a_position"], {
                    isPositionalLight: (i & ProgramFlags.PositionalLight) != 0,
                    direction: dir == ScreenSpaceSoftShadowDirection.Vertical ? 1 : 0,
                    numSamples: 8
                });
            this.program.push({
                program,
                uniforms: program.getUniforms([
                    "u_input", "u_linearDepth",
                    "u_texCoordOffset",
                    "u_viewDirOffset", "u_viewDirCoefX", "u_viewDirCoefY"
                ]),
                attributes: program.getAttributes(["a_position"])
            });
        }

        this.viewVec = null;
    }
    beforeRender(): void
    {
        this.viewVec = computeViewVectorCoefFromProjectionMatrix(
            this.core.currentCamera.projectionMatrix, this.viewVec);
    }
    perform(): void
    {
        this.fb.bind();

        const gl = this.core.gl;
        gl.viewport(0, 0, this.out.width, this.out.height);
        this.core.invalidateFramebuffer(gl.COLOR_ATTACHMENT0);
        this.core.state.flags =
            GLStateFlags.DepthWriteDisabled;

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.inLinearDepth.texture);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.input.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        const light = this.light;

        let flags = ProgramFlags.Zero;

        if (!(light instanceof three.DirectionalLight)) {
            flags |= ProgramFlags.PositionalLight;
        }

        const p = this.program[flags];
        p.program.use();
        gl.uniform1i(p.uniforms["u_input"], 0);
        gl.uniform1i(p.uniforms["u_linearDepth"], 1);

        gl.uniform2f(p.uniforms["u_viewDirOffset"],
            this.viewVec.offset.x, this.viewVec.offset.y);
        gl.uniform2f(p.uniforms["u_viewDirCoefX"],
            this.viewVec.coefX.x, this.viewVec.coefX.y);
        gl.uniform2f(p.uniforms["u_viewDirCoefY"],
            this.viewVec.coefY.x, this.viewVec.coefY.y);

        let offsX = 21 / this.out.width;
        let offsY = 21 / this.out.height;
        gl.uniform2f(p.uniforms["u_texCoordOffset"], offsX, offsY);

        const quad = this.core.quadRenderer;
        quad.render(p.attributes["a_position"]);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
    afterRender(): void
    {
    }
    dispose(): void
    {
        this.fb.dispose();
    }
}