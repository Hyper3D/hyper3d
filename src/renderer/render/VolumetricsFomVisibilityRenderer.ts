/// <reference path="../Prefix.d.ts" />

import {
    LinearDepthTextureRenderBufferInfo
} from "../core/TypedRenderBuffers";

import { Shader } from "./MaterialManager";

import {
    TextureRenderBuffer,
    TextureRenderBufferFormat,
    TextureRenderBufferInfo
} from "../core/RenderBuffers";

import {
    BaseGeometryPassRenderer,
    BaseGeometryPassShader,
    BaseGeometryPassMaterialManager,
    ObjectWithGeometry,
    isMaterialShadingModelVolumetric
} from "./BaseGeometryPassRenderer";

import {
    MaterialInstance
} from "../public/Materials";

import {
    RenderOperator,
    RenderOperation
} from "../core/RenderPipeline";

import {
    RendererCore,
    GLStateFlags
} from "../core/RendererCore";

import { Material } from "../public/Materials";

import { GLFramebuffer } from "../core/GLFramebuffer";

import {
    GLProgramUniforms
} from "../core/GLProgram";

export interface VolumetricsFomVisibilityPassInput
{
    linearDepth: LinearDepthTextureRenderBufferInfo;
}

export interface VolumetricsFomVisibilityPassOutput
{
    // c0: [a_0, XXX, a_1, b_1]
    // c1: [a_2, b_2, a_3, b_3]
    // ...
    coefs: TextureRenderBufferInfo[];
}

export class VolumetricsFomVisibilityRenderer
{
    gpMaterials: VolumetricsFomVisibilityGeometryPassMaterialManager;

    constructor(public renderer: RendererCore)
    {
        this.gpMaterials = new VolumetricsFomVisibilityGeometryPassMaterialManager(renderer);
    }

    dispose(): void
    {
        this.gpMaterials.dispose();
    }

    setup(
        input: VolumetricsFomVisibilityPassInput, ops: RenderOperation[]):
        VolumetricsFomVisibilityPassOutput
    {
        const width = input.linearDepth.width;
        const height = input.linearDepth.height;

        const outp: VolumetricsFomVisibilityPassOutput = {
            coefs: [
                new TextureRenderBufferInfo("FOM Coefficients 1", width, height,
                    TextureRenderBufferFormat.RGBAF16),
                new TextureRenderBufferInfo("FOM Coefficients 2", width, height,
                    TextureRenderBufferFormat.RGBAF16),
                new TextureRenderBufferInfo("FOM Coefficients 3", width, height,
                    TextureRenderBufferFormat.RGBAF16),
                new TextureRenderBufferInfo("FOM Coefficients 4", width, height,
                    TextureRenderBufferFormat.RGBAF16),
            ]
        };

        ops.push({
            inputs: {
                linearDepth: input.linearDepth
            },
            outputs: {
                coef1: outp.coefs[0],
                coef2: outp.coefs[1],
                coef3: outp.coefs[2],
                coef4: outp.coefs[3]
            },
            bindings: ["color", "color"],
            optionalOutputs: [],
            name: "Volumetric Visibility Decision (FOM-based)",
            factory: (cfg) => new VolumetricsFomVisibilityGeometryPassRenderer(this,
                <TextureRenderBuffer> cfg.inputs["linearDepth"],
                [
                    <TextureRenderBuffer> cfg.outputs["coef1"],
                    <TextureRenderBuffer> cfg.outputs["coef2"],
                    <TextureRenderBuffer> cfg.outputs["coef3"],
                    <TextureRenderBuffer> cfg.outputs["coef4"],
                ])
        });

        return outp;
    }

}

class VolumetricsFomVisibilityGeometryPassShader extends BaseGeometryPassShader
{
    geoUniforms: GLProgramUniforms;

    constructor(public manager: BaseGeometryPassMaterialManager, public source: Material, flags: number)
    {
        super(manager, source, flags);

        this.geoUniforms = this.glProgram.getUniforms([
            "u_pointSizeMatrix",
            "u_linearDepth",
            "u_renderTargetId"
        ]);
    }
}

class VolumetricsFomVisibilityGeometryPassMaterialManager extends BaseGeometryPassMaterialManager
{
    constructor(core: RendererCore)
    {
        super(core, "VS_VolumetricsFomVisibilityGeometry",
            core.supportsMRT ? "FS_VolumetricsFomVisibilityGeometryMRT" :
                "FS_VolumetricsFomVisibilityGeometryNoMRT");
    }

    createShader(material: Material, flags: number): Shader // override
    {
        return new VolumetricsFomVisibilityGeometryPassShader(this, material, flags);
    }
}


class VolumetricsFomVisibilityGeometryPassRenderer extends BaseGeometryPassRenderer implements RenderOperator
{
    private fb: GLFramebuffer[];

    private pointSizeMatrix: Float32Array;
    private currentRenderTargetId: number;

    constructor(
        private parent: VolumetricsFomVisibilityRenderer,
        private inLinearDepth: TextureRenderBuffer,
        private outCoefs: TextureRenderBuffer[]
    )
    {
        super(parent.renderer, parent.gpMaterials, true);

        if (parent.renderer.supportsMRT) {
            this.fb = [
                GLFramebuffer.createFramebuffer(parent.renderer.gl, {
                    colors: outCoefs.map(outCoef => outCoef.texture)
                })
            ];
        } else {
            this.fb = outCoefs.map(outCoef =>
                GLFramebuffer.createFramebuffer(parent.renderer.gl, {
                    colors: [
                        outCoef
                    ]
                }));
        }

        this.pointSizeMatrix = new Float32Array(9);
        this.currentRenderTargetId = 0;
    }

    skipsMaterial(mat: MaterialInstance): boolean // override
    {
        return !isMaterialShadingModelVolumetric(mat.material.shadingModel);
    }

    setupAdditionalUniforms(mesh: ObjectWithGeometry, shader: BaseGeometryPassShader): void // override
    {
        const shd = <VolumetricsFomVisibilityGeometryPassShader> shader;
        const gl = this.parent.renderer.gl;
        gl.uniformMatrix3fv(shd.geoUniforms["u_pointSizeMatrix"], false, this.pointSizeMatrix);
        gl.uniform1i(shd.geoUniforms["u_linearDepth"], shd.numTextureStages);
        gl.uniform1i(shd.geoUniforms["u_lightVolume"], shd.numTextureStages + 1);
        gl.uniform1i(shd.geoUniforms["u_renderTargetId"], this.currentRenderTargetId);

        gl.activeTexture(gl.TEXTURE0 + shd.numTextureStages);
        gl.bindTexture(gl.TEXTURE_2D, this.inLinearDepth.texture);
    }

    beforeRender(): void
    {
    }
    perform(): void
    {

        // jitter projection matrix for temporal AA
        const projMat = this.parent.renderer.ctrler.jitteredProjectiveMatrix;

        const psm = this.pointSizeMatrix;
        const scale = this.inLinearDepth.width * 0.5;
        psm[0] = projMat.elements[0] * scale;
        psm[1] = projMat.elements[2];
        psm[2] = projMat.elements[3];
        psm[3] = projMat.elements[8] * scale;
        psm[4] = projMat.elements[10];
        psm[5] = projMat.elements[11];
        psm[6] = projMat.elements[12] * scale;
        psm[7] = projMat.elements[14];
        psm[8] = projMat.elements[15];

        const fbs = this.fb;
        const gl = this.parent.renderer.gl;

        gl.viewport(0, 0, this.inLinearDepth.width, this.inLinearDepth.height);

        for (let i = 0; i < fbs.length; ++i) {
            this.currentRenderTargetId = i;

            fbs[i].bind();

            if (fbs.length == 1) {
                this.parent.renderer.state.flags = GLStateFlags.DepthWriteDisabled | GLStateFlags.BlendEnabled |
                    GLStateFlags.ColorAttachment1Enabled |
                    GLStateFlags.ColorAttachment2Enabled |
                    GLStateFlags.ColorAttachment3Enabled;
            } else {
                this.parent.renderer.state.flags = GLStateFlags.DepthWriteDisabled | GLStateFlags.BlendEnabled;
            }

            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.blendFunc(gl.ONE, gl.ONE);

            this.renderGeometry(this.parent.renderer.currentCamera.matrixWorldInverse,
                projMat);
        }
    }
    afterRender(): void
    {

    }

    dispose(): void
    {
        for (const fb of this.fb)
            fb.dispose();

        BaseGeometryPassRenderer.prototype.dispose.call(this);
    }
}