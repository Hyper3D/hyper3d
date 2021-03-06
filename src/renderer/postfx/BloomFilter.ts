/// <reference path="../Prefix.d.ts" />

import * as three from "three";

import { TextureRenderBuffer } from "../core/RenderBuffers";

import {
    LogRGBTextureRenderBufferInfo,
    LinearRGBTextureRenderBufferInfo
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

import { GaussianBlurFilterRenderer } from "./BlurFilter";

import { BufferAdder } from "./SimpleOps";

import { ResampleFilterRenderer } from "./ResampleFilter";

export interface BloomFilterParameters
{
    amount: number;
    saturation: number;
    texture: three.Texture;
    textureZoom: number;
}
export class BloomFilterRenderer
{
    params: BloomFilterParameters;

    private blurFlt: GaussianBlurFilterRenderer;
    private resampler: ResampleFilterRenderer;
    private adder: BufferAdder;

    constructor(public renderer: RendererCore)
    {
        this.params = {
            amount: 0.5,
            saturation: 1,
            texture: null,
            textureZoom: 1
        };

        this.resampler = new ResampleFilterRenderer(renderer);
        this.blurFlt = new GaussianBlurFilterRenderer(renderer);
        this.adder = new BufferAdder(renderer);
    }

    dispose(): void
    {
    }

    setupFilter<T extends LogRGBTextureRenderBufferInfo | LinearRGBTextureRenderBufferInfo>
    (input: T, ops: RenderOperation[]): T
    {

        // convert input to linear RGB.
        // hope that GPU supports sRGB buffer... (or we'll lose much precision)
        let ds0: LinearRGBTextureRenderBufferInfo;

        let prescaling: number = 1 / 128;
        if (!this.renderer.supportsSRGB) {
            prescaling = 1 / 16;
        }
        if (input instanceof LinearRGBTextureRenderBufferInfo) {
            prescaling = 1;
        }

        if (input instanceof LogRGBTextureRenderBufferInfo) {
            ds0 = new LinearRGBTextureRenderBufferInfo("Bloom 1/2",
                    (input.width + 1) >> 1, (input.height + 1) >> 1,
                    input.format);
            ops.push({
                inputs: {
                    input: input
                },
                outputs: {
                    output: ds0
                },
                bindings: [],
                optionalOutputs: [],
                name: `Resample and Convert To Linear RGB`,
                factory: (cfg) => new BloomDownsampleRenderer(this,
                    <TextureRenderBuffer> cfg.inputs["input"],
                    <TextureRenderBuffer> cfg.outputs["output"],
                    prescaling)
            });
        } else {
            // already linear
            ds0 = this.resampler.setupLinearResampler(input, {
                outWidth: (input.width + 1) >> 1,
                outHeight: (input.height + 1) >> 1
            }, ops);
            ds0.name = "Bloom 1/2";
        }

        const levels: LinearRGBTextureRenderBufferInfo[] = [];
        let prev = ds0;
        for (let i = 0; i < 6; ++i) {
            let size = 4 << i;
            if (input.width < size * 4 || input.height < size * 4) {
                break;
            }
            const ds = this.resampler.setupLinearResampler(prev, {
                outWidth: (input.width + size - 1) >> (i + 2),
                outHeight: (input.height + size - 1) >> (i + 2)
            }, ops);
            ds.name = `Bloom 1/${size}`;

            if (i < 1) {
                prev = ds;
                continue;
            }
            const lp = this.blurFlt.setupFilter(ds, 2, ops);
            lp.name = `Bloom 1/${size} LPFed`;
            levels.push(lp);
            prev = lp;
        }

        // blend all levels (they're linear color so can be blended with BufferAdded)
        for (let i = levels.length - 2; i >= 0; --i) {
            let lum = 1.5;
            prev = this.adder.setupFilter(levels[i], prev,
                new three.Vector4(lum, lum, lum, lum),
                ops);
        }

        // combine
        const outp = input instanceof LinearRGBTextureRenderBufferInfo ?
            new LinearRGBTextureRenderBufferInfo("Bloom Added", input.width, input.height,
                input.format) :
            new LogRGBTextureRenderBufferInfo("Bloom Added", input.width, input.height,
                input.format);

        ops.push({
            inputs: {
                input: input,
                bloom: prev
            },
            outputs: {
                output: outp
            },
            bindings: [],
            optionalOutputs: [],
            name: `Combine Bloom`,
            factory: (cfg) => new BloomFinalPassRenderer(this,
                <TextureRenderBuffer> cfg.inputs["input"],
                <TextureRenderBuffer> cfg.inputs["bloom"],
                <TextureRenderBuffer> cfg.outputs["output"],
                input instanceof LogRGBTextureRenderBufferInfo,
                (1 / 32) / prescaling)
        });

        return <T> outp;
    }
}
class BloomDownsampleRenderer implements RenderOperator
{
    private fb: GLFramebuffer;

    private program: {
        program: GLProgram;
        uniforms: GLProgramUniforms;
        attributes: GLProgramAttributes;
    };

    constructor(
        private parent: BloomFilterRenderer,
        private input: TextureRenderBuffer,
        private out: TextureRenderBuffer,
        private gain: number
    )
    {

        this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
            depth: null,
            colors: [
                out.texture
            ]
        });

        {
            const program = parent.renderer.shaderManager.get("VS_BloomDownsample", "FS_BloomDownsample",
                ["a_position"]);
            this.program = {
                program,
                uniforms: program.getUniforms([
                    "u_input",
                    "u_gain",

                    "u_texCoordOffset"
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
        this.fb.bind();

        const gl = this.parent.renderer.gl;
        gl.viewport(0, 0, this.out.width, this.out.height);
        this.parent.renderer.invalidateFramebuffer(gl.COLOR_ATTACHMENT0);
        this.parent.renderer.state.flags = GLStateFlags.DepthWriteDisabled;

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.input.texture);

        const p = this.program;
        p.program.use();
        gl.uniform1i(p.uniforms["u_input"], 0);

        gl.uniform1f(p.uniforms["u_gain"], this.gain * 0.25);

        gl.uniform2f(p.uniforms["u_texCoordOffset"],
            0.5 / this.input.width,
            0.5 / this.input.height);

        const quad = this.parent.renderer.quadRenderer;
        quad.render(p.attributes["a_position"]);

    }
    afterRender(): void
    {
    }
    dispose(): void
    {
        this.fb.dispose();
    }
}

const enum BloomFinalPassProgramFlags
{
    Default = 0,
    HasTexture = 1 << 0
}

class BloomFinalPassRenderer implements RenderOperator
{
    private fb: GLFramebuffer;

    private program: {
        program: GLProgram;
        uniforms: GLProgramUniforms;
        attributes: GLProgramAttributes;
    }[];

    constructor(
        private parent: BloomFilterRenderer,
        private input: TextureRenderBuffer,
        private bloom: TextureRenderBuffer,
        private out: TextureRenderBuffer,
        useLogRGB: boolean,
        private gain: number
    )
    {

        this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
            depth: null,
            colors: [
                out.texture
            ]
        });

        this.program = [];
        for (let i = 0; i < 2; ++i) {
            const program = parent.renderer.shaderManager.get("VS_Bloom", "FS_Bloom",
                ["a_position"], {
                    useLogRGB,
                    hasTexture: (i & BloomFinalPassProgramFlags.HasTexture) != 0
                });
            this.program.push({
                program,
                uniforms: program.getUniforms([
                    "u_input",
                    "u_bloom",
                    "u_texture",

                    "u_strength",
                    "u_saturation",
                    "u_dustScale"
                ]),
                attributes: program.getAttributes(["a_position"])
            });
        }
    }
    beforeRender(): void
    {
    }
    perform(): void
    {
        this.fb.bind();

        const gl = this.parent.renderer.gl;
        gl.viewport(0, 0, this.out.width, this.out.height);
        this.parent.renderer.invalidateFramebuffer(gl.COLOR_ATTACHMENT0);
        this.parent.renderer.state.flags = GLStateFlags.DepthWriteDisabled;

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.input.texture);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.bloom.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        const tex = this.parent.renderer.textures.get(this.parent.params.texture);
        if (tex) {
            gl.activeTexture(gl.TEXTURE2);
            tex.bind();
        }

        let flags = BloomFinalPassProgramFlags.Default;
        if (tex) {
            flags |= BloomFinalPassProgramFlags.HasTexture;
        }

        const p = this.program[flags];
        p.program.use();
        gl.uniform1i(p.uniforms["u_input"], 0);
        gl.uniform1i(p.uniforms["u_bloom"], 1);
        gl.uniform1i(p.uniforms["u_texture"], 2);

        const params = this.parent.params;
        gl.uniform1f(p.uniforms["u_strength"], params.amount * this.gain);
        gl.uniform1f(p.uniforms["u_saturation"], params.saturation);

        gl.uniform2f(p.uniforms["u_texCoordOffset"],
            0.5 / this.input.width,
            0.5 / this.input.height);

        gl.uniform2f(p.uniforms["u_dustScale"],
            0.5 * this.input.width /
                (Math.max(this.input.width, this.input.height) * params.textureZoom),
            0.5 * this.input.height /
                (Math.max(this.input.width, this.input.height) * params.textureZoom));

        const quad = this.parent.renderer.quadRenderer;
        quad.render(p.attributes["a_position"]);

        gl.activeTexture(gl.TEXTURE1);
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
