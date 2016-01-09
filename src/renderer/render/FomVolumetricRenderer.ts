/// <reference path="../Prefix.d.ts" />

import * as three from "three";

import {
    LinearDepthTextureRenderBufferInfo,
    LinearRGBTextureRenderBufferInfo,
    VolumeTexture2DLayout
} from "../core/TypedRenderBuffers";

import { VolumetricLightOutput } from "./VolumetricLightRenderer";

import { Shader } from "./MaterialManager";

import {
    GLProgram,
    GLProgramUniforms,
    GLProgramAttributes
} from "../core/GLProgram";

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

export interface FomVolumetricPassInput
{
    color: LinearRGBTextureRenderBufferInfo;
    linearDepth: LinearDepthTextureRenderBufferInfo;
    light: VolumetricLightOutput;
    coefs: TextureRenderBufferInfo[];
}

export interface FomVolumetricPassOutput
{
    color: LinearRGBTextureRenderBufferInfo;
}

export class FomVolumetricRenderer
{
    gpMaterials: FomVolumetricGeometryPassMaterialManager;

    constructor(public renderer: RendererCore)
    {
        this.gpMaterials = new FomVolumetricGeometryPassMaterialManager(renderer);
    }

    dispose(): void
    {
        this.gpMaterials.dispose();
    }

    setup(
        input: FomVolumetricPassInput, ops: RenderOperation[]):
        FomVolumetricPassOutput
    {
        const width = input.color.width;
        const height = input.color.height;

        const outp: FomVolumetricPassOutput = {
            color: new LinearRGBTextureRenderBufferInfo("Color", width, height,
                    TextureRenderBufferFormat.RGBAF16)
        };

        const tmp = new LinearRGBTextureRenderBufferInfo("Color", width, height,
            TextureRenderBufferFormat.RGBAF16);

        ops.push({
            inputs: {
                linearDepth: input.linearDepth,
                light: input.light.scatter,
                coef1: input.coefs[0],
                coef2: input.coefs[1],
                coef3: input.coefs[2],
                coef4: input.coefs[3]
            },
            outputs: {
                color: tmp
            },
            bindings: ["color", "color"],
            optionalOutputs: [],
            name: "Volumetric Geometry Pass (FOM-based)",
            factory: (cfg) => new FomVolumetricGeometryPassRenderer(this,
                <TextureRenderBuffer> cfg.inputs["linearDepth"],
                <TextureRenderBuffer> cfg.inputs["light"],
                [
                    <TextureRenderBuffer> cfg.inputs["coef1"],
                    <TextureRenderBuffer> cfg.inputs["coef2"],
                    <TextureRenderBuffer> cfg.inputs["coef3"],
                    <TextureRenderBuffer> cfg.inputs["coef4"]
                ],
                <TextureRenderBuffer> cfg.outputs["color"],
                input.light.scatter.layout)
        });

        ops.push({
            inputs: {
                linearDepth: input.linearDepth,
                lowResLinearDepth: input.linearDepth,
                volumeColor: tmp,
                color: input.color,
                coef1: input.coefs[0]
            },
            outputs: {
                color: outp.color
            },
            bindings: ["color", "color"],
            optionalOutputs: [],
            name: "Combine Volumetrics",
            factory: (cfg) => new FomVolumetricFinalPassRenderer(this,
                <TextureRenderBuffer> cfg.inputs["linearDepth"],
                <TextureRenderBuffer> cfg.inputs["lowResLinearDepth"],
                <TextureRenderBuffer> cfg.inputs["volumeColor"],
                <TextureRenderBuffer> cfg.inputs["coef1"],
                <TextureRenderBuffer> cfg.inputs["color"],
                <TextureRenderBuffer> cfg.outputs["color"])
        });

        return outp;
    }

}

class FomVolumetricGeometryPassShader extends BaseGeometryPassShader
{
    geoUniforms: GLProgramUniforms;

    constructor(public manager: BaseGeometryPassMaterialManager, public source: Material, flags: number)
    {
        super(manager, source, flags);

        this.geoUniforms = this.glProgram.getUniforms([
            "u_pointSizeMatrix",
            "u_linearDepth",
            "u_lightVolume",
            "u_lightVolumeParams",
            "u_fomCoef1",
            "u_fomCoef2",
            "u_fomCoef3",
            "u_fomCoef4"
        ]);
    }
}

class FomVolumetricGeometryPassMaterialManager extends BaseGeometryPassMaterialManager
{
    constructor(core: RendererCore)
    {
        super(core, "VS_FomVolumetricGeometry", "FS_FomVolumetricGeometry");
    }

    createShader(material: Material, flags: number): Shader // override
    {
        return new FomVolumetricGeometryPassShader(this, material, flags);
    }
}


class FomVolumetricGeometryPassRenderer extends BaseGeometryPassRenderer implements RenderOperator
{
    private fb: GLFramebuffer;

    private pointSizeMatrix: Float32Array;

    private lightSamplerParams: three.Vector4;

    constructor(
        private parent: FomVolumetricRenderer,
        private inLinearDepth: TextureRenderBuffer,
        private inLight: TextureRenderBuffer,
        private inCoefs: TextureRenderBuffer[],
        private outColor: TextureRenderBuffer,
        private lightLayout: VolumeTexture2DLayout
    )
    {
        super(parent.renderer, parent.gpMaterials, true);

        this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
            colors: [
                outColor.texture
            ]
        });

        this.pointSizeMatrix = new Float32Array(9);

        this.lightSamplerParams = new three.Vector4();
    }

    skipsMaterial(mat: MaterialInstance): boolean // override
    {
        return !isMaterialShadingModelVolumetric(mat.material.shadingModel);
    }

    setupAdditionalUniforms(mesh: ObjectWithGeometry, shader: BaseGeometryPassShader): void // override
    {
        const shd = <FomVolumetricGeometryPassShader> shader;
        const gl = this.parent.renderer.gl;
        gl.uniformMatrix3fv(shd.geoUniforms["u_pointSizeMatrix"], false, this.pointSizeMatrix);
        gl.uniform1i(shd.geoUniforms["u_linearDepth"], shd.numTextureStages);
        gl.uniform1i(shd.geoUniforms["u_lightVolume"], shd.numTextureStages + 1);
        gl.uniform1i(shd.geoUniforms["u_fomCoef1"], shd.numTextureStages + 2);
        gl.uniform1i(shd.geoUniforms["u_fomCoef2"], shd.numTextureStages + 3);
        gl.uniform1i(shd.geoUniforms["u_fomCoef3"], shd.numTextureStages + 4);
        gl.uniform1i(shd.geoUniforms["u_fomCoef4"], shd.numTextureStages + 5);

        gl.activeTexture(gl.TEXTURE0 + shd.numTextureStages);
        gl.bindTexture(gl.TEXTURE_2D, this.inLinearDepth.texture);

        gl.activeTexture(gl.TEXTURE0 + shd.numTextureStages + 1);
        gl.bindTexture(gl.TEXTURE_2D, this.inLight.texture);

        gl.activeTexture(gl.TEXTURE0 + shd.numTextureStages + 2);
        gl.bindTexture(gl.TEXTURE_2D, this.inCoefs[0].texture);

        gl.activeTexture(gl.TEXTURE0 + shd.numTextureStages + 3);
        gl.bindTexture(gl.TEXTURE_2D, this.inCoefs[1].texture);

        gl.activeTexture(gl.TEXTURE0 + shd.numTextureStages + 4);
        gl.bindTexture(gl.TEXTURE_2D, this.inCoefs[2].texture);

        gl.activeTexture(gl.TEXTURE0 + shd.numTextureStages + 5);
        gl.bindTexture(gl.TEXTURE_2D, this.inCoefs[3].texture);

        gl.uniform4f(shd.geoUniforms["u_lightVolumeParams"],
            this.lightSamplerParams.x, this.lightSamplerParams.y,
            this.lightSamplerParams.z, this.lightSamplerParams.w);
    }

    beforeRender(): void
    {
    }
    perform(): void
    {
        this.fb.bind();

        this.lightLayout.getSamplerParameters(this.lightSamplerParams);

        // jitter projection matrix for temporal AA
        const projMat = this.parent.renderer.ctrler.jitteredProjectiveMatrix;

        const psm = this.pointSizeMatrix;
        const scale = this.outColor.width * 0.5;
        psm[0] = projMat.elements[0] * scale;
        psm[1] = projMat.elements[2];
        psm[2] = projMat.elements[3];
        psm[3] = projMat.elements[8] * scale;
        psm[4] = projMat.elements[10];
        psm[5] = projMat.elements[11];
        psm[6] = projMat.elements[12] * scale;
        psm[7] = projMat.elements[14];
        psm[8] = projMat.elements[15];

        const gl = this.parent.renderer.gl;
        gl.viewport(0, 0, this.outColor.width, this.outColor.height);

        this.parent.renderer.state.flags = GLStateFlags.DepthWriteDisabled | GLStateFlags.BlendEnabled;
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // set texture filter
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.inLight.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        gl.blendFunc(gl.ONE, gl.ONE);
        this.renderGeometry(this.parent.renderer.currentCamera.matrixWorldInverse,
            projMat);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.inLight.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    }
    afterRender(): void
    {

    }

    dispose(): void
    {
        this.fb.dispose();

        BaseGeometryPassRenderer.prototype.dispose.call(this);
    }
}

class FomVolumetricFinalPassRenderer implements RenderOperator
{
    private fb: GLFramebuffer;

    private program: {
        program: GLProgram;
        uniforms: GLProgramUniforms;
        attributes: GLProgramAttributes;
    };

    constructor(
        private parent: FomVolumetricRenderer,
        private inLinearDepth: TextureRenderBuffer,
        private inLowResLinearDepth: TextureRenderBuffer,
        private inVolumeColor: TextureRenderBuffer,
        private inCoef1: TextureRenderBuffer,
        private inColor: TextureRenderBuffer,
        private outColor: TextureRenderBuffer
    )
    {
        this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
            depth: null,
            colors: [
                outColor.texture
            ]
        });

        {
            const program = parent.renderer.shaderManager.get("VS_FomVolumetricFinal", "FS_FomVolumetricFinal",
                ["a_position"]);
            this.program = {
                program,
                uniforms: program.getUniforms([
                    "u_linearDepth", "u_lowResLinearDepth",
                    "u_volumeColor", "u_fomCoef1"
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
        gl.viewport(0, 0, this.outColor.width, this.outColor.height);

        if (this.inColor != this.outColor) {
            this.parent.renderer.state.flags = GLStateFlags.DepthWriteDisabled;
            this.parent.renderer.invalidateFramebuffer(gl.COLOR_ATTACHMENT0);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.inColor.texture);
            this.parent.renderer.passthroughRenderer.render();
        }

        this.parent.renderer.state.flags =
            GLStateFlags.DepthWriteDisabled | GLStateFlags.BlendEnabled;
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.inLinearDepth.texture);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.inLowResLinearDepth.texture);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.inVolumeColor.texture);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, this.inCoef1.texture);

        const p = this.program;
        p.program.use();
        gl.uniform1i(p.uniforms["u_linearDepth"], 0);
        gl.uniform1i(p.uniforms["u_lowResLinearDepth"], 1);
        gl.uniform1i(p.uniforms["u_volumeColor"], 2);
        gl.uniform1i(p.uniforms["u_fomCoef1"], 3);

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