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
    TextureRenderBuffer,
    TextureRenderBufferFormat
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

export interface SimpleVolumetricPassInput
{
    color: LinearRGBTextureRenderBufferInfo;
    linearDepth: LinearDepthTextureRenderBufferInfo;
    light: VolumetricLightOutput;
}

export interface SimpleVolumetricPassOutput
{
    color: LinearRGBTextureRenderBufferInfo;
}

export class SimpleVolumetricRenderer
{
    gpMaterials: SimpleVolumetricGeometryPassMaterialManager;

    constructor(public renderer: RendererCore)
    {
        this.gpMaterials = new SimpleVolumetricGeometryPassMaterialManager(renderer);
    }

    dispose(): void
    {
        this.gpMaterials.dispose();
    }

    setup(
        input: SimpleVolumetricPassInput, ops: RenderOperation[]):
        SimpleVolumetricPassOutput
    {
        const width = input.color.width;
        const height = input.color.height;

        const outp: SimpleVolumetricPassOutput = {
            color: new LinearRGBTextureRenderBufferInfo("Color", width, height,
                    TextureRenderBufferFormat.RGBAF16)
        };

        ops.push({
            inputs: {
                color: input.color,
                linearDepth: input.linearDepth,
                light: input.light.scatter
            },
            outputs: {
                color: outp.color
            },
            bindings: ["color", "color"],
            optionalOutputs: [],
            name: "Volumetric Geometry Pass (Simple)",
            factory: (cfg) => new SimpleVolumetricGeometryPassRenderer(this,
                <TextureRenderBuffer> cfg.inputs["linearDepth"],
                <TextureRenderBuffer> cfg.inputs["light"],
                <TextureRenderBuffer> cfg.inputs["color"],
                <TextureRenderBuffer> cfg.outputs["color"],
                input.light.scatter.layout)
        });

        return outp;
    }

}

class SimpleVolumetricGeometryPassShader extends BaseGeometryPassShader
{
    geoUniforms: GLProgramUniforms;

    constructor(public manager: BaseGeometryPassMaterialManager, public source: Material, flags: number)
    {
        super(manager, source, flags);

        this.geoUniforms = this.glProgram.getUniforms([
            "u_pointSizeMatrix",
            "u_linearDepth",
            "u_lightVolume",
            "u_lightVolumeParams"
        ]);
    }
}

class SimpleVolumetricGeometryPassMaterialManager extends BaseGeometryPassMaterialManager
{
    constructor(core: RendererCore)
    {
        super(core, "VS_SimpleVolumetricGeometry", "FS_SimpleVolumetricGeometry");
    }

    createShader(material: Material, flags: number): Shader // override
    {
        return new SimpleVolumetricGeometryPassShader(this, material, flags);
    }
}


class SimpleVolumetricGeometryPassRenderer extends BaseGeometryPassRenderer implements RenderOperator
{
    private fb: GLFramebuffer;

    private pointSizeMatrix: Float32Array;

    private lightSamplerParams: three.Vector4;

    constructor(
        private parent: SimpleVolumetricRenderer,
        private inLinearDepth: TextureRenderBuffer,
        private inLight: TextureRenderBuffer,
        private inColor: TextureRenderBuffer,
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
        const shd = <SimpleVolumetricGeometryPassShader> shader;
        const gl = this.parent.renderer.gl;
        gl.uniformMatrix3fv(shd.geoUniforms["u_pointSizeMatrix"], false, this.pointSizeMatrix);
        gl.uniform1i(shd.geoUniforms["u_linearDepth"], shd.numTextureStages);
        gl.uniform1i(shd.geoUniforms["u_lightVolume"], shd.numTextureStages + 1);

        gl.activeTexture(gl.TEXTURE0 + shd.numTextureStages);
        gl.bindTexture(gl.TEXTURE_2D, this.inLinearDepth.texture);

        gl.activeTexture(gl.TEXTURE0 + shd.numTextureStages + 1);
        gl.bindTexture(gl.TEXTURE_2D, this.inLight.texture);

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

        if (this.inColor != this.outColor) {
            this.parent.renderer.state.flags = GLStateFlags.DepthWriteDisabled;
            this.parent.renderer.invalidateFramebuffer(gl.COLOR_ATTACHMENT0);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.inColor.texture);
            this.parent.renderer.passthroughRenderer.render();
        }
        this.parent.renderer.state.flags = GLStateFlags.DepthWriteDisabled | GLStateFlags.BlendEnabled;

        // set texture filter
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.inLight.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
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