/// <reference path="../Prefix.d.ts" />

import {
    TextureRenderBufferFormat,
    TextureRenderBuffer
} from "../core/RenderBuffers";

import {
    LinearDepthTextureRenderBufferInfo,
    LogRGBTextureRenderBufferInfo,
    LinearRGBTextureRenderBufferInfo,
    GBuffer0TextureRenderBufferInfo,
    GBuffer1TextureRenderBufferInfo
} from "../core/TypedRenderBuffers";

import {
    RenderOperator,
    RenderOperation
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

export interface TemporalAAInput<T extends LogRGBTextureRenderBufferInfo | LinearRGBTextureRenderBufferInfo>
{
    g0: GBuffer0TextureRenderBufferInfo;
    g1: GBuffer1TextureRenderBufferInfo;
    color: T;
    linearDepth: LinearDepthTextureRenderBufferInfo;
}

export interface TemporalAAFilterParameters
{
    useWiderFilter: boolean;
}

export class TemporalAAFilterRenderer
{
    constructor(public renderer: RendererCore, public params: TemporalAAFilterParameters)
    {
    }

    dispose(): void
    {
    }

    /** input must be LogRGB. */
    setupFilter<T extends LogRGBTextureRenderBufferInfo | LinearRGBTextureRenderBufferInfo>
    (input: TemporalAAInput<T>, ops: RenderOperation[]): T
    {
        let width = input.color.width;
        let height = input.color.height;

        const outp = input.color instanceof LinearRGBTextureRenderBufferInfo ?
            new LinearRGBTextureRenderBufferInfo("Antialiased", width, height, input.color.format) :
            new LogRGBTextureRenderBufferInfo("Antialiased", width, height, input.color.format);

        ops.push({
            inputs: {
                g0: input.g0, g1: input.g1,
                input: input.color,
                linearDepth: input.linearDepth
            },
            outputs: {
                output: outp
            },
            bindings: [],
            optionalOutputs: [],
            name: `Temporal AA`,
            factory: (cfg) => new TemporalAAFilterRendererInstance(this,
                <TextureRenderBuffer> cfg.inputs["input"],
                <TextureRenderBuffer> cfg.inputs["g0"],
                <TextureRenderBuffer> cfg.inputs["g1"],
                <TextureRenderBuffer> cfg.inputs["linearDepth"],
                <TextureRenderBuffer> cfg.outputs["output"],
                input.color instanceof LogRGBTextureRenderBufferInfo)
        });
        return <T> outp;
    }
}

class TemporalAAFilterRendererInstance implements RenderOperator
{
    private fb: GLFramebuffer;

    private program: {
        program: GLProgram;
        uniforms: GLProgramUniforms;
        attributes: GLProgramAttributes;
    };
    private pre: {
        program: GLProgram;
        uniforms: GLProgramUniforms;
        attributes: GLProgramAttributes;
    };

    private accumTex: WebGLTexture;
    private accumFb: GLFramebuffer;

    private savedDepthTex: WebGLTexture;
    private savedDepthFb: GLFramebuffer;

    private firstTime: boolean;

    constructor(
        private parent: TemporalAAFilterRenderer,
        private input: TextureRenderBuffer,
        private inG0: TextureRenderBuffer,
        private inG1: TextureRenderBuffer,
        private inLinearDepth: TextureRenderBuffer,
        private out: TextureRenderBuffer,
        useLogRGB: boolean
    )
    {

        this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
            depth: null,
            colors: [
                out.texture
            ]
        });

        const gl = parent.renderer.gl;

        this.accumTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.accumTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const fmt = input.format == TextureRenderBufferFormat.SRGBA8 ?
                parent.renderer.ext.get("EXT_sRGB").SRGB_ALPHA_EXT : gl.RGBA;
        const typ = input.format == TextureRenderBufferFormat.RGBAF16 ?
                parent.renderer.ext.get("OES_texture_half_float").HALF_FLOAT_OES : gl.UNSIGNED_BYTE;
        gl.texImage2D(gl.TEXTURE_2D, 0, fmt, input.width, input.height, 0,
            fmt, gl.UNSIGNED_BYTE, null);

        this.savedDepthTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.savedDepthTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, input.width, input.height, 0,
            gl.RGBA, typ, null);

        this.accumFb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
            depth: null,
            colors: [
                this.accumTex
            ]
        });

        this.savedDepthFb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
            depth: null,
            colors: [
                this.savedDepthTex
            ]
        });

        this.firstTime = true;

        {
            const program = parent.renderer.shaderManager.get("VS_TemporalAA", "FS_TemporalAA",
                ["a_position"], {
                    useWiderFilter: parent.params.useWiderFilter
                });
            this.program = {
                program,
                uniforms: program.getUniforms([
                    "u_input",
                    "u_linearDepth",
                    "u_oldAccum",
                    "u_oldDepth",
                    "u_g0", "u_g1"
                ]),
                attributes: program.getAttributes(["a_position"])
            };
        }
        {
            const program = parent.renderer.shaderManager.get("VS_TemporalAA", "FS_TemporalAAPrepass",
                ["a_position"]);
            this.pre = {
                program,
                uniforms: program.getUniforms([
                    "u_input",
                    "u_linearDepth",
                    "u_oldAccum",
                    "u_oldDepth",
                    "u_g0", "u_g1"
                ]),
                attributes: program.getAttributes(["a_position"])
            };
        }
    }
    beforeRender(): void
    {
    }
    perform(): void
    {
        const gl = this.parent.renderer.gl;
        const profiler = this.parent.renderer.profiler;

        profiler.begin("Pass 1");

        gl.viewport(0, 0, this.out.width, this.out.height);
        this.parent.renderer.state.flags = GLStateFlags.DepthWriteDisabled;

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.input.texture);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.inLinearDepth.texture);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.inG0.texture);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, this.inG1.texture);
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, this.accumTex);
        gl.activeTexture(gl.TEXTURE5);
        gl.bindTexture(gl.TEXTURE_2D, this.savedDepthTex);

        const quad = this.parent.renderer.quadRenderer;

        {
            this.fb.bind();
            this.parent.renderer.invalidateFramebuffer(gl.COLOR_ATTACHMENT0);

            const p = this.pre;
            p.program.use();
            gl.uniform1i(p.uniforms["u_input"], 0);
            gl.uniform1i(p.uniforms["u_linearDepth"], 1);
            gl.uniform1i(p.uniforms["u_g0"], 2);
            gl.uniform1i(p.uniforms["u_g1"], 3);
            gl.uniform1i(p.uniforms["u_oldAccum"], 4);
            gl.uniform1i(p.uniforms["u_oldDepth"], 5);

            // TODO: set some parameters
            quad.render(p.attributes["a_position"]);
        }
        profiler.end();

        profiler.begin("Pass 2");
        {
            this.accumFb.bind();
            this.parent.renderer.invalidateFramebuffer(gl.COLOR_ATTACHMENT0);

            gl.activeTexture(gl.TEXTURE4);
            gl.bindTexture(gl.TEXTURE_2D, this.out.texture);

            const p = this.program;
            p.program.use();
            gl.uniform1i(p.uniforms["u_input"], 0);
            gl.uniform1i(p.uniforms["u_linearDepth"], 1);
            gl.uniform1i(p.uniforms["u_g0"], 2);
            gl.uniform1i(p.uniforms["u_g1"], 3);
            gl.uniform1i(p.uniforms["u_oldAccum"], 4);
            gl.uniform1i(p.uniforms["u_oldDepth"], 5);

            // TODO: set some parameters
            quad.render(p.attributes["a_position"]);
        }
        profiler.end();

        // copy to accumulation buffer
        profiler.begin("Pass 3");

        this.fb.bind();
        this.parent.renderer.invalidateFramebuffer(gl.COLOR_ATTACHMENT0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.accumTex);

        this.parent.renderer.passthroughRenderer.render();

        profiler.end();

        // save depth
        profiler.begin("Pass 4");

        this.savedDepthFb.bind();
        this.parent.renderer.invalidateFramebuffer(gl.COLOR_ATTACHMENT0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.inLinearDepth.texture);
        this.parent.renderer.passthroughRenderer.render();

        profiler.end();
    }
    afterRender(): void
    {
    }
    dispose(): void
    {
        const gl = this.parent.renderer.gl;

        this.fb.dispose();
        this.accumFb.dispose();
        this.savedDepthFb.dispose();

        gl.deleteTexture(this.accumTex);
        gl.deleteTexture(this.savedDepthTex);
    }
}
