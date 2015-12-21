/// <reference path="../Prefix.d.ts" />

import * as three from "three";

import {
    DepthTextureRenderBufferInfo,
    GBuffer0TextureRenderBufferInfo,
    GBuffer1TextureRenderBufferInfo,
    GBuffer2TextureRenderBufferInfo,
    GBuffer3TextureRenderBufferInfo,
    LinearDepthTextureRenderBufferInfo,
    LinearRGBTextureRenderBufferInfo,
    HdrMosaicTextureRenderBufferInfo
} from "../core/TypedRenderBuffers";

import {
    ShadowMapRenderBufferInfo,
    ShadowMapRenderBuffer,
    ShadowMapRenderService
} from "./ShadowMapRenderer";

import {
    TextureRenderBuffer,
    TextureRenderBufferInfo,
    TextureRenderBufferFormat
} from "../core/RenderBuffers";

import {
    RenderOperator,
    RenderOperation
} from "../core/RenderPipeline";

import {
    RendererCore,
    HdrMode,
    GLStateFlags
} from "../core/RendererCore";

import {
    GLProgram,
    GLProgramUniforms,
    GLProgramAttributes
} from "../core/GLProgram";

import { GLFramebuffer } from "../core/GLFramebuffer";

import {
    ViewVectors,
    computeViewVectorCoefFromProjectionMatrix,
    computeFarDepthFromProjectionMatrix
} from "../utils/Geometry";

import {
    Vector3Pool,
    Vector4Pool,
    Matrix4Pool
} from "../utils/ObjectPool";

import { PointLight } from "../public/Lights";

import { ShadowMapType } from "./ShadowMapRenderer";

export interface LightPassInput
{
    g0: GBuffer0TextureRenderBufferInfo;
    g1: GBuffer1TextureRenderBufferInfo;
    g2: GBuffer2TextureRenderBufferInfo;
    g3: GBuffer3TextureRenderBufferInfo;
    depth: DepthTextureRenderBufferInfo;
    linearDepth: LinearDepthTextureRenderBufferInfo;
    ssao: TextureRenderBufferInfo;
    shadowMaps: ShadowMapRenderBufferInfo;
}

export class LightRenderer
{
    constructor(public renderer: RendererCore)
    {
    }

    dispose(): void
    {
    }

    setupNativeHdrLightPass(input: LightPassInput, ops: RenderOperation[]): LinearRGBTextureRenderBufferInfo
    {
        const width = input.g0.width;
        const height = input.g0.height;

        const em = new HdrMosaicTextureRenderBufferInfo("Emissive Color Mosaicked", width, height,
                TextureRenderBufferFormat.RGBAF16);

        const outp = new LinearRGBTextureRenderBufferInfo("Lit Color", width, height,
                TextureRenderBufferFormat.RGBAF16);

        const depthCullEnabled =
            input.depth.width == width &&
            input.depth.height == height &&
            input.depth.isDepthBuffer;

        ops.push({
            inputs: {
                g3: input.g3
            },
            outputs: {
                lit: em
            },
            bindings: [],
            optionalOutputs: [],
            name: "Emissive Term",
            factory: (cfg) => new UnlitLightPassRenderer(this,
                <TextureRenderBuffer> cfg.inputs["g3"],
                <TextureRenderBuffer> cfg.outputs["lit"],
                HdrMode.NativeHdr)
        });

        ops.push({
            inputs: {
                g0: input.g0,
                g1: input.g1,
                g2: input.g2,
                g3: input.g3,
                linearDepth: input.linearDepth,
                depth: depthCullEnabled ? input.depth : null,
                shadowMaps: input.shadowMaps,
                ssao: input.ssao,
                lit: em
            },
            outputs: {
                lit: outp
            },
            bindings: [],
            optionalOutputs: [],
            name: "Light Pass",
            factory: (cfg) => new LightPassRenderer(this,
                <TextureRenderBuffer> cfg.inputs["g0"],
                <TextureRenderBuffer> cfg.inputs["g1"],
                <TextureRenderBuffer> cfg.inputs["g2"],
                <TextureRenderBuffer> cfg.inputs["g3"],
                <TextureRenderBuffer> cfg.inputs["linearDepth"],
                <TextureRenderBuffer> cfg.inputs["depth"],
                <TextureRenderBuffer> cfg.inputs["ssao"],
                (<ShadowMapRenderBuffer> cfg.inputs["shadowMaps"]).service,
                <TextureRenderBuffer> cfg.inputs["lit"],
                <TextureRenderBuffer> cfg.outputs["lit"],
                HdrMode.NativeHdr)
        });
        return outp;
    }

    setupMobileHdrLightPass(input: LightPassInput, ops: RenderOperation[]): HdrMosaicTextureRenderBufferInfo
    {
        const width = input.g0.width;
        const height = input.g0.height;

        const em = new HdrMosaicTextureRenderBufferInfo("Emissive Color Mosaicked", width, height,
                this.renderer.supportsSRGB ?
                    TextureRenderBufferFormat.SRGBA8 :
                    TextureRenderBufferFormat.RGBA8);

        const outp = new HdrMosaicTextureRenderBufferInfo("Lit Color Mosaicked", width, height,
                this.renderer.supportsSRGB ?
                    TextureRenderBufferFormat.SRGBA8 :
                    TextureRenderBufferFormat.RGBA8);

        const depthCullEnabled =
            input.depth.width == width &&
            input.depth.height == height &&
            input.depth.isDepthBuffer;

        ops.push({
            inputs: {
                g3: input.g3
            },
            outputs: {
                lit: em
            },
            bindings: [],
            optionalOutputs: [],
            name: "Emissive Term",
            factory: (cfg) => new UnlitLightPassRenderer(this,
                <TextureRenderBuffer> cfg.inputs["g3"],
                <TextureRenderBuffer> cfg.outputs["lit"],
                HdrMode.MobileHdr)
        });

        ops.push({
            inputs: {
                g0: input.g0,
                g1: input.g1,
                g2: input.g2,
                g3: input.g3,
                linearDepth: input.linearDepth,
                depth: depthCullEnabled ? input.depth : null,
                shadowMaps: input.shadowMaps,
                ssao: input.ssao,
                lit: em
            },
            outputs: {
                lit: outp
            },
            bindings: [],
            optionalOutputs: [],
            name: "Light Pass",
            factory: (cfg) => new LightPassRenderer(this,
                <TextureRenderBuffer> cfg.inputs["g0"],
                <TextureRenderBuffer> cfg.inputs["g1"],
                <TextureRenderBuffer> cfg.inputs["g2"],
                <TextureRenderBuffer> cfg.inputs["g3"],
                <TextureRenderBuffer> cfg.inputs["linearDepth"],
                <TextureRenderBuffer> cfg.inputs["depth"],
                <TextureRenderBuffer> cfg.inputs["ssao"],
                (<ShadowMapRenderBuffer> cfg.inputs["shadowMaps"]).service,
                <TextureRenderBuffer> cfg.inputs["lit"],
                <TextureRenderBuffer> cfg.outputs["lit"],
                HdrMode.MobileHdr)
        });
        return outp;
    }

}

class UnlitLightPassRenderer implements RenderOperator
{
    private fb: GLFramebuffer;

    private program: {
        program: GLProgram;
        uniforms: GLProgramUniforms;
        attributes: GLProgramAttributes;
    };

    constructor(
        private parent: LightRenderer,
        private inG3: TextureRenderBuffer,
        private outLit: TextureRenderBuffer,
        private hdrMode: HdrMode
    )
    {

        this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
            depth: null,
            colors: [
                outLit.texture
            ]
        });

        {
            const program = parent.renderer.shaderManager.get("VS_DeferredUnlit", "FS_DeferredUnlit",
                ["a_position"], {
                    useHdrMosaic: hdrMode == HdrMode.MobileHdr
                });
            this.program = {
                program,
                uniforms: program.getUniforms([
                    "u_g3", "u_ssao",
                    "u_dither", "u_ditherScale"
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
        this.fb.bind();
        this.parent.renderer.state.flags =
            GLStateFlags.DepthWriteDisabled;
        gl.viewport(0, 0, this.outLit.width, this.outLit.height);

        this.parent.renderer.invalidateFramebuffer(gl.COLOR_ATTACHMENT0);

        // bind G-Buffer
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.inG3.texture);

        const jitter = this.parent.renderer.uniformJitter;
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, jitter.texture);

        const p = this.program;
        p.program.use();
        gl.uniform1i(p.uniforms["u_g3"], 0);
        gl.uniform1i(p.uniforms["u_dither"], 1);
        gl.uniform2f(p.uniforms["u_ditherScale"],
            this.outLit.width / jitter.size / 4,
            this.outLit.height / jitter.size / 4);

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

const enum DirectionalLightProgramFlags
{
    Default = 0,
    HasShadowMaps = 1 << 0
}

const enum PointLightProgramFlags
{
    Default = 0,
    HasShadowMaps = 1 << 0,
    IsFullScreen = 1 << 1
}

class LightPassRenderer implements RenderOperator
{
    private fb: GLFramebuffer;
    private tmpMat: three.Matrix4;
    private projectionViewMat: three.Matrix4;
    private viewMat: three.Matrix4;
    private viewVec: ViewVectors;
    private totalAmbient: {
        r: number;
        g: number;
        b: number;
    };

    private pointLightProgram: {
        program: GLProgram;
        uniforms: GLProgramUniforms;
        attributes: GLProgramAttributes;
    }[];
    private directionalLightProgram: {
        program: GLProgram;
        uniforms: GLProgramUniforms;
        attributes: GLProgramAttributes;
    }[];
    private ambientLightProgram: {
        program: GLProgram;
        uniforms: GLProgramUniforms;
        attributes: GLProgramAttributes;
    };

    private frustumCorners: three.Vector3[];

    constructor(
        private parent: LightRenderer,
        private inG0: TextureRenderBuffer,
        private inG1: TextureRenderBuffer,
        private inG2: TextureRenderBuffer,
        private inG3: TextureRenderBuffer,
        private inLinearDepth: TextureRenderBuffer,
        private inDepth: TextureRenderBuffer,
        private inSSAO: TextureRenderBuffer,
        private inShadowMaps: ShadowMapRenderService,
        private inLit: TextureRenderBuffer,
        private outLit: TextureRenderBuffer,
        private hdrMode: HdrMode
    )
    {

        this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
            depth: inDepth ? inDepth.texture : null,
            colors: [
                outLit.texture
            ]
        });

        this.tmpMat = new three.Matrix4();
        this.projectionViewMat = new three.Matrix4();
        this.viewMat = null;
        this.viewVec = null;
        this.totalAmbient = {r: 0, g: 0, b: 0};
        this.directionalLightProgram = [];
        this.pointLightProgram = [];

        this.frustumCorners = [];
        for (let i = 0; i < 5; ++i) {
            this.frustumCorners.push(new three.Vector3());
        }

        for (let i = 0; i < 4; ++i) {
            const program = parent.renderer.shaderManager.get("VS_DeferredPointLight", "FS_DeferredPointLight",
                ["a_position"], {
                    hasShadowMap: (i & PointLightProgramFlags.HasShadowMaps) != 0,
                    isFullScreen: (i & PointLightProgramFlags.IsFullScreen) != 0,
                    useHdrMosaic: hdrMode == HdrMode.MobileHdr
                });
            this.pointLightProgram.push({
                program,
                uniforms: program.getUniforms([
                    "u_g0", "u_g1", "u_g2", "u_linearDepth",
                    "u_lightColor", "u_lightStrength",
                    "u_viewDirCoefX", "u_viewDirCoefY", "u_viewDirOffset",
                    "u_shadowMap", "u_shadowMapMatrix",
                    "u_jitter", "u_jitterScale", "u_jitterAmount",
                    "u_dither", "u_ditherScale",

                    "u_lightPos",
                    "u_lightInfluenceRadius", "u_lightInvInfluenceRadiusSquared",
                    "u_minimumDistance",
                    "u_invDistanceToJitter",
                    "u_lightRadius",
                    "u_lightLength",
                    "u_lightDir"
                ]),
                attributes: program.getAttributes(["a_position"])
            });
        }
        for (let i = 0; i < 2; ++i) {
            const program = parent.renderer.shaderManager.get("VS_DeferredDirectionalLight", "FS_DeferredDirectionalLight",
                ["a_position"], {
                    hasShadowMap: (i & DirectionalLightProgramFlags.HasShadowMaps) != 0,
                    useHdrMosaic: hdrMode == HdrMode.MobileHdr
                });
            this.directionalLightProgram.push({
                program,
                uniforms: program.getUniforms([
                    "u_g0", "u_g1", "u_g2", "u_linearDepth",
                    "u_lightDir", "u_lightColor", "u_lightStrength",
                    "u_viewDirCoefX", "u_viewDirCoefY", "u_viewDirOffset",
                    "u_shadowMap", "u_shadowMapMatrix",
                    "u_jitter", "u_jitterScale", "u_jitterAmount",
                    "u_dither", "u_ditherScale"
                ]),
                attributes: program.getAttributes(["a_position"])
            });
        }
        {
            const program = parent.renderer.shaderManager.get("VS_DeferredAmbientLight", "FS_DeferredAmbientLight",
                ["a_position"], {
                    useHdrMosaic: hdrMode == HdrMode.MobileHdr
                });
            this.ambientLightProgram = {
                program,
                uniforms: program.getUniforms([
                    "u_g0", "u_g1", "u_g2", "u_linearDepth", "u_ssao",
                    "u_lightColor",
                    "u_viewDirCoefX", "u_viewDirCoefY", "u_viewDirOffset",

                    "u_dither", "u_ditherScale"
                ]),
                attributes: program.getAttributes(["a_position"])
            };
        }
    }
    beforeRender(): void
    {
        const scene = this.parent.renderer.currentScene;
        const currentCamera = this.parent.renderer.currentCamera;

        this.viewMat = currentCamera.matrixWorldInverse;
        this.projectionViewMat.multiplyMatrices(
            currentCamera.projectionMatrix,
            currentCamera.matrixWorldInverse
        );
        this.viewVec = computeViewVectorCoefFromProjectionMatrix(
            currentCamera.projectionMatrix,
            this.viewVec
        );
        this.totalAmbient.r = 0;
        this.totalAmbient.g = 0;
        this.totalAmbient.b = 0;

        // compute frustum corners
        const invViewMat = currentCamera.matrixWorld;
        const far = computeFarDepthFromProjectionMatrix(currentCamera.projectionMatrix);
        currentCamera.getWorldPosition(this.frustumCorners[4]);
        for (let i = 0; i < 4; ++i) {
            const fc = this.frustumCorners[i];
            fc.set(this.viewVec.offset.x, this.viewVec.offset.y, -1);
            if (i & 1) {
                fc.x += this.viewVec.coefX.x;
                fc.y += this.viewVec.coefX.y;
            } else {
                fc.x -= this.viewVec.coefX.x;
                fc.y -= this.viewVec.coefX.y;
            }
            if (i & 2) {
                fc.x += this.viewVec.coefY.x;
                fc.y += this.viewVec.coefY.y;
            } else {
                fc.x -= this.viewVec.coefY.x;
                fc.y -= this.viewVec.coefY.y;
            }
            fc.multiplyScalar(far);
            fc.applyMatrix4(invViewMat);
        }

        // traverse scene
        this.prepareTree(scene);
    }
    private setState(): void
    {
        const gl = this.parent.renderer.gl;
        this.fb.bind();
        this.parent.renderer.state.flags =
            GLStateFlags.DepthTestEnabled |
            GLStateFlags.DepthWriteDisabled |
            GLStateFlags.BlendEnabled;
        gl.blendFunc(gl.ONE, gl.ONE); // additive
        gl.viewport(0, 0, this.outLit.width, this.outLit.height);

        // bind G-Buffer
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.inG0.texture);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.inG1.texture);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.inG2.texture);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, this.parent.renderer.uniformJitter.texture);
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, this.inLinearDepth.texture);
        // TEXTURE5: (none)
        // TEXTURE6: shadow maps
        // TEXTURE7: light texture
    }
    perform(): void
    {
        const scene = this.parent.renderer.currentScene;
        const gl = this.parent.renderer.gl;

        this.fb.bind();
        gl.viewport(0, 0, this.outLit.width, this.outLit.height);

        if (this.outLit != this.inLit) {
            this.parent.renderer.invalidateFramebuffer(gl.COLOR_ATTACHMENT0);

            this.parent.renderer.state.flags =
                GLStateFlags.DepthWriteDisabled;

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.inLit.texture);
            this.parent.renderer.passthroughRenderer.render();
        }

        this.setState();

        const jitter = this.parent.renderer.gaussianJitter;
        const vpMat = this.projectionViewMat;

        const jitterScale = this.parent.renderer.hdrMode == HdrMode.MobileHdr ? 1 / 4 : 1 / 2;

        // setup common uniforms
        for (const p of this.pointLightProgram) {
            p.program.use();
            gl.uniform1i(p.uniforms["u_g0"], 0);
            gl.uniform1i(p.uniforms["u_g1"], 1);
            gl.uniform1i(p.uniforms["u_g2"], 2);
            gl.uniform1i(p.uniforms["u_dither"], 3);
            gl.uniform2f(p.uniforms["u_ditherScale"],
                this.outLit.width / jitter.size * jitterScale,
                this.outLit.height / jitter.size * jitterScale);
            gl.uniform1i(p.uniforms["u_linearDepth"], 4);
            gl.uniform1i(p.uniforms["u_jitter"], 5);
            // u_jitterScale == u_ditherScale
            gl.uniform1i(p.uniforms["u_shadowMap"], 6);
            gl.uniform2f(p.uniforms["u_viewDirOffset"],
                this.viewVec.offset.x, this.viewVec.offset.y);
            gl.uniform2f(p.uniforms["u_viewDirCoefX"],
                this.viewVec.coefX.x, this.viewVec.coefX.y);
            gl.uniform2f(p.uniforms["u_viewDirCoefY"],
                this.viewVec.coefY.x, this.viewVec.coefY.y);
            gl.uniformMatrix4fv(p.uniforms["u_viewProjectionMatrix"], false,
                vpMat.elements);
        }
        for (const p of this.directionalLightProgram) {
            p.program.use();
            gl.uniform1i(p.uniforms["u_g0"], 0);
            gl.uniform1i(p.uniforms["u_g1"], 1);
            gl.uniform1i(p.uniforms["u_g2"], 2);
            gl.uniform1i(p.uniforms["u_dither"], 3);
            gl.uniform2f(p.uniforms["u_ditherScale"],
                this.outLit.width / jitter.size * jitterScale,
                this.outLit.height / jitter.size * jitterScale);
            gl.uniform1i(p.uniforms["u_linearDepth"], 4);
            gl.uniform1i(p.uniforms["u_jitter"], 5);
            // u_jitterScale == u_ditherScale
            gl.uniform1i(p.uniforms["u_shadowMap"], 6);
            gl.uniform2f(p.uniforms["u_viewDirOffset"],
                this.viewVec.offset.x, this.viewVec.offset.y);
            gl.uniform2f(p.uniforms["u_viewDirCoefX"],
                this.viewVec.coefX.x, this.viewVec.coefX.y);
            gl.uniform2f(p.uniforms["u_viewDirCoefY"],
                this.viewVec.coefY.x, this.viewVec.coefY.y);
        }
        {
            const p = this.ambientLightProgram;
            p.program.use();
            gl.uniform1i(p.uniforms["u_g0"], 0);
            gl.uniform1i(p.uniforms["u_g1"], 1);
            gl.uniform1i(p.uniforms["u_g2"], 2);
            gl.uniform1i(p.uniforms["u_dither"], 3);
            gl.uniform2f(p.uniforms["u_ditherScale"],
                this.outLit.width / jitter.size * jitterScale,
                this.outLit.height / jitter.size * jitterScale);
            gl.uniform1i(p.uniforms["u_linearDepth"], 4);
            gl.uniform1i(p.uniforms["u_ssao"], 5);
            gl.uniform2f(p.uniforms["u_viewDirOffset"],
                this.viewVec.offset.x, this.viewVec.offset.y);
            gl.uniform2f(p.uniforms["u_viewDirCoefX"],
                this.viewVec.coefX.x, this.viewVec.coefX.y);
            gl.uniform2f(p.uniforms["u_viewDirCoefY"],
                this.viewVec.coefY.x, this.viewVec.coefY.y);
        }

        // traverse scene
        this.renderTree(scene);

        // do ambient light
        {
            const t = this.totalAmbient;
            if (t.r > 0 || t.g > 0 || t.b > 0) {
                const p = this.ambientLightProgram;
                p.program.use();

                gl.activeTexture(gl.TEXTURE5);
                gl.bindTexture(gl.TEXTURE_2D, this.inSSAO.texture);

                gl.uniform3f(p.uniforms["u_lightColor"], t.r, t.g, t.b);

                const quad = this.parent.renderer.quadRenderer;
                gl.depthFunc(gl.GREATER);
                quad.render(p.attributes["a_position"]);
                gl.depthFunc(gl.LESS);
            }
        }
    }
    private prepareTree(obj: three.Object3D): void
    {
        if (obj instanceof three.Light) {
            this.prepareLight(obj);
        }

        for (const child of obj.children) {
            this.prepareTree(child);
        }
    }
    private prepareLight(light: three.Light): void
    {
        const tV3a = Vector3Pool.alloc();
        const tV3b = Vector3Pool.alloc();
        const tV3c = Vector3Pool.alloc();

        if (light instanceof three.DirectionalLight) {
            if (light.castShadow) {
                const camera: three.OrthographicCamera = light.shadowCamera =
                    <three.OrthographicCamera> light.shadowCamera
                    || new three.OrthographicCamera(-1, 1, 1, -1);

                // decide shadow map axis direction
                const lightDir = tV3a.copy(light.position).normalize();
                const texU = tV3b;
                if (Math.abs(lightDir.z) > 0.5) {
                    texU.set(1, 0, 0);
                } else {
                    texU.set(0, 0, 1);
                }
                texU.cross(lightDir).normalize();
                const texV = tV3c.crossVectors(texU, lightDir).normalize();
                texU.crossVectors(texV, lightDir);

                // compute frustrum limit
                let minX = 0, maxX = 0, minY = 0, maxY = 0;
                let minZ = 0, maxZ = 0;
                for (let i = 0; i < 5; ++i) {
                    const p = this.frustumCorners[i];
                    const px = p.dot(texU);
                    const py = p.dot(texV);
                    const pz = p.dot(lightDir);

                    if (i == 0) {
                        minX = maxX = px;
                        minY = maxY = py;
                        minZ = maxZ = pz;
                    } else {
                        minX = Math.min(minX, px); maxX = Math.max(maxX, px);
                        minY = Math.min(minY, py); maxY = Math.max(maxY, py);
                        minZ = Math.min(minZ, pz); maxZ = Math.max(maxZ, pz);
                    }
                }

                // extend near limit
                maxZ += computeFarDepthFromProjectionMatrix(this.parent.renderer.currentCamera.projectionMatrix); // FIXME: heuristics

                // make matricies
                const midX = (minX + maxX) * 0.5;
                const midY = (minY + maxY) * 0.5;
                const camMat = camera.matrixWorldInverse;
                camMat.set(texU.x, texU.y, texU.z, -midX,
                            texV.x, texV.y, texV.z, -midY,
                            lightDir.x, lightDir.y, lightDir.z, 0,
                            0, 0, 0, 1);
                camera.matrixWorld.getInverse(camMat);
                camera.projectionMatrix.makeOrthographic(minX - midX, maxX - midX, maxY - midY, minY - midY, -maxZ, -minZ);

                const gen = this.inShadowMaps;
                gen.prepareShadowMap(light.shadowCamera, ShadowMapType.Normal);
            }
        }

        if (light instanceof three.PointLight) {
            if (light.castShadow) {
                let near = 0.1;

                if (light instanceof PointLight) {
                    near = light.shadowCameraNear;
                }

                const camera: three.CubeCamera = (<any> light).shadowCamera =
                    <three.CubeCamera> (<any> light).shadowCamera
                    || new three.CubeCamera(near, light.distance, 1024); // FIXME: what about infinite distance point light?

                camera.position.copy(light.getWorldPosition(tV3a));
                camera.updateMatrixWorld(true);

                const gen = this.inShadowMaps;
                gen.prepareShadowMap((<any> light).shadowCamera, ShadowMapType.Normal);
            }
        }

        Vector3Pool.free(tV3a);
        Vector3Pool.free(tV3b);
        Vector3Pool.free(tV3c);
    }

    private renderTree(obj: three.Object3D): void
    {
        if (obj instanceof three.Light) {
            this.renderLight(obj);
        }

        for (const child of obj.children) {
            this.renderTree(child);
        }
    }
    private renderLight(light: three.Light): void
    {
        const gl = this.parent.renderer.gl;
        let colorR = light.color.r;
        let colorG = light.color.g;
        let colorB = light.color.b;

        const tV3a = Vector3Pool.alloc();
        const tV3b = Vector3Pool.alloc();
        const tV3c = Vector3Pool.alloc();

        if (light instanceof three.DirectionalLight) {
            const hasShadowMap = light.castShadow;

            if (hasShadowMap && light.shadowCamera) {
                const gen = this.inShadowMaps;
                gen.renderShadowMap(light.shadowCamera, ShadowMapType.Normal);

                this.setState(); // ShadowMapRenderService might change the state
                gl.activeTexture(gl.TEXTURE6);
                gl.bindTexture(gl.TEXTURE_2D, gen.currentShadowMapDepth);
            }

            let flags = DirectionalLightProgramFlags.Default;
            if (hasShadowMap) {
                flags |= DirectionalLightProgramFlags.HasShadowMaps;
            }
            const p = this.directionalLightProgram[flags];
            p.program.use();

            const dir = light.position;
            const dir3 = Vector4Pool.alloc().set(dir.x, dir.y, dir.z, 0);
            dir3.set(dir.x, dir.y, dir.z, 0.);
            dir3.applyMatrix4(this.parent.renderer.currentCamera.matrixWorldInverse);
            dir3.normalize();
            gl.uniform3f(p.uniforms["u_lightDir"], dir3.x, dir3.y, dir3.z);
            Vector4Pool.free(dir3);

            gl.uniform3f(p.uniforms["u_lightColor"], colorR, colorG, colorB);
            gl.uniform1f(p.uniforms["u_lightStrength"], light.intensity);

            if (hasShadowMap) {
                const gen = this.inShadowMaps;

                const m1 = Matrix4Pool.alloc();
                const m2 = Matrix4Pool.alloc();
                const m3 = Matrix4Pool.alloc();

                m2.multiplyMatrices(light.shadowCamera.projectionMatrix,
                    light.shadowCamera.matrixWorldInverse);
                m1.multiplyMatrices(m2, this.parent.renderer.currentCamera.matrixWorld);
                m2.makeScale(.5, .5, .5).multiply(m1);
                m3.makeTranslation(.5, .5, .5).multiply(m2);
                gl.uniformMatrix4fv(p.uniforms["u_shadowMapMatrix"], false, m3.elements);

                Matrix4Pool.free(m1);
                Matrix4Pool.free(m2);
                Matrix4Pool.free(m3);

                gl.activeTexture(gl.TEXTURE5);
                gl.bindTexture(gl.TEXTURE_2D, this.parent.renderer.gaussianJitter.texture);

                gl.uniform4f(p.uniforms["u_jitterAmount"], 4 / gen.shadowMapWidth, 4 / gen.shadowMapHeight,
                    1 / gen.shadowMapWidth, 1 / gen.shadowMapHeight);
            }

            const quad = this.parent.renderer.quadRenderer;
            gl.depthFunc(gl.GREATER);
            quad.render(p.attributes["a_position"]);
            gl.depthFunc(gl.LESS);
        }

        if (light instanceof three.PointLight) {
            let radius = light.distance;

            if (radius == 0) {
                radius = Infinity;
            }

            const isFullScreen = true; // TODO
            let hasShadowMap = light.castShadow;
            const shadowCamera: three.CubeCamera =
                (<any> light).shadowCamera;

            if (hasShadowMap && shadowCamera) {
                const gen = this.inShadowMaps;
                gen.renderShadowMap(shadowCamera, ShadowMapType.Normal);

                this.setState(); // ShadowMapRenderService might change the state
                gl.activeTexture(gl.TEXTURE6);
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, gen.currentCubeShadowDistanceMap);
            } else {
                hasShadowMap = false;
            }

            const pos = light.getWorldPosition(tV3b);
            pos.applyMatrix4(this.viewMat);

            let flags = PointLightProgramFlags.Default;
            if (isFullScreen) {
                flags |= PointLightProgramFlags.IsFullScreen;
            }
            if (hasShadowMap) {
                flags |= PointLightProgramFlags.HasShadowMaps;
            }

            const p = this.pointLightProgram[flags];
            p.program.use();

            // light shape
            if (light instanceof PointLight) {
                gl.uniform1f(p.uniforms["u_lightRadius"], light.radius);
                gl.uniform1f(p.uniforms["u_lightLength"], light.length * 0.5);
                gl.uniform1f(p.uniforms["u_invDistanceToJitter"], 1 / light.radius); // FIXME: maybe not correct
                if (light.length > 0) {
                    // Z-axis oriented
                    tV3a.set(0, 0, 1).transformDirection(light.matrixWorld).normalize();
                    gl.uniform3f(p.uniforms["u_lightDir"], tV3a.x, tV3a.y, tV3a.z);
                    tV3a.multiplyScalar(light.length * 0.5);
                    pos.sub(tV3a);
                } else {
                    gl.uniform3f(p.uniforms["u_lightDir"], 0, 0, 0);
                }
            } else {
                gl.uniform1f(p.uniforms["u_lightRadius"], 0);
                gl.uniform1f(p.uniforms["u_lightLength"], 0);
                gl.uniform3f(p.uniforms["u_lightDir"], 0, 0, 0);
                gl.uniform1f(p.uniforms["u_invDistanceToJitter"], 0);
            }

            gl.uniform3f(p.uniforms["u_lightPos"], pos.x, pos.y, pos.z);
            gl.uniform1f(p.uniforms["u_lightInfluenceRadius"], radius);
            gl.uniform1f(p.uniforms["u_lightInvInfluenceRadiusSquared"], 1 / (radius * radius));
            gl.uniform1f(p.uniforms["u_minimumDistance"], 0.01 * light.intensity); // FIXME

            gl.uniform3f(p.uniforms["u_lightColor"], colorR, colorG, colorB);
            gl.uniform1f(p.uniforms["u_lightStrength"], light.intensity);

            if (hasShadowMap) {
                const gen = this.inShadowMaps;
                const scl = 1 / light.distance;

                const m1 = Matrix4Pool.alloc();
                const m2 = Matrix4Pool.alloc();
                const m3 = Matrix4Pool.alloc();

                m2.getInverse(shadowCamera.matrixWorld);
                m1.multiplyMatrices(m2, this.parent.renderer.currentCamera.matrixWorld);
                m3.makeScale(scl, scl, scl).multiply(m1);
                gl.uniformMatrix4fv(p.uniforms["u_shadowMapMatrix"], false, m3.elements);

                Matrix4Pool.free(m1);
                Matrix4Pool.free(m2);
                Matrix4Pool.free(m3);

                gl.activeTexture(gl.TEXTURE5);
                gl.bindTexture(gl.TEXTURE_2D, this.parent.renderer.gaussianJitter.texture);

                gl.uniform2f(p.uniforms["u_jitterAmount"],
                    16 / gen.cubeShadowDistanceMapSize, 16 / gen.cubeShadowDistanceMapSize);
            }

            gl.depthFunc(gl.GREATER);
            if (isFullScreen) {
                const quad = this.parent.renderer.quadRenderer;
                quad.render(p.attributes["a_position"]);
            } else {
                // TODO: light geometry cull
            }
            gl.depthFunc(gl.LESS);
        }

        if (light instanceof three.SpotLight) {
            // TODO: spot light
        }

        if (light instanceof three.AmbientLight) {
            const t = this.totalAmbient;
            t.r += colorR;
            t.g += colorG;
            t.b += colorB;
        }

        Vector3Pool.free(tV3a);
        Vector3Pool.free(tV3b);
        Vector3Pool.free(tV3c);
    }

    afterRender(): void
    {
        /*
        // debug: dump shadow maps
        const pt = this.parent.renderer.passthroughRenderer;
        const gl = this.parent.renderer.gl;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.inShadowMaps.currentShadowMapDepth);

        this.parent.renderer.state.flags =
            GLStateFlags.BlendEnabled;

        gl.blendFunc(gl.DST_COLOR, gl.ZERO);
        pt.render(); // */
    }
    dispose(): void
    {
        this.fb.dispose();
    }
}
