/// <reference path="../Prefix.d.ts" />

import { TextureRenderBuffer } from "../core/RenderBuffers";

import {
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

export const enum HdrOperatorType
{
    Reinhard = 0
}

export const enum HdrCompressDirection
{
    Encode = 1,
    Decode = 0
}

export class HdrCompressFilter
{
    constructor(public renderer: RendererCore)
    {
    }

    dispose(): void
    {
    }

    setupFilter(input: LinearRGBTextureRenderBufferInfo, type: HdrOperatorType, dir: HdrCompressDirection, scale: number, ops: RenderOperation[]): LinearRGBTextureRenderBufferInfo
    {
        const width = input.width;
        const height = input.height;
        const outp = new LinearRGBTextureRenderBufferInfo(
            dir == HdrCompressDirection.Encode ? "Compressed" : "Decompressed",
            width, height, input.format);

        ops.push({
            inputs: {
                input: input,
            },
            outputs: {
                output: outp
            },
            bindings: [],
            optionalOutputs: [],
            name: `${dir == HdrCompressDirection.Encode ? "Compress" : "Decompress"} HDR`,
            factory: (cfg) => new HdrCompressFilterInstance(this,
                <TextureRenderBuffer> cfg.inputs["input"],
                <TextureRenderBuffer> cfg.outputs["output"],
                type, dir, scale)
        });
        return outp;
    }
}

class HdrCompressFilterInstance implements RenderOperator
{
    private fb: GLFramebuffer;

    private program: {
        program: GLProgram;
        uniforms: GLProgramUniforms;
        attributes: GLProgramAttributes;
    };

    constructor(
        private parent: HdrCompressFilter,
        private input: TextureRenderBuffer,
        private out: TextureRenderBuffer,
        type: HdrOperatorType,
        dir: HdrCompressDirection,
        private scale: number
    )
    {

        this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
            depth: null,
            colors: [
                out.texture
            ]
        });

        {
            const program = parent.renderer.shaderManager.get("VS_HdrCompress", "FS_HdrCompress",
                ["a_position"], {
                    operatorType: type,
                    direction: dir
                });
            this.program = {
                program,
                uniforms: program.getUniforms([
                    "u_input",
                    "u_gain",
                    "u_jitter",
                    "u_jitterScale"
                ]),
                attributes: program.getAttributes(["a_position"])
            };
        }

        if (dir == HdrCompressDirection.Decode) {
            this.scale = 1 / this.scale;
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
        this.parent.renderer.state.flags =
            GLStateFlags.DepthWriteDisabled;


        this.parent.renderer.invalidateFramebuffer(gl.COLOR_ATTACHMENT0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.input.texture);

        const jitter = this.parent.renderer.uniformJitter;
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, jitter.texture);

        const p = this.program;
        p.program.use();

        gl.uniform1i(p.uniforms["u_input"], 0);
        gl.uniform1f(p.uniforms["u_gain"], this.scale);

        gl.uniform1i(p.uniforms["u_jitter"], 1);
        gl.uniform2f(p.uniforms["u_jitterScale"],
            this.out.width / jitter.size,
            this.out.height / jitter.size);

        this.parent.renderer.quadRenderer.render(p.attributes["a_position"]);
    }
    afterRender(): void
    {
    }
    dispose(): void
    {
        this.fb.dispose();
    }
}
