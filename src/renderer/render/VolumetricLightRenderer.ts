/// <reference path="../Prefix.d.ts" />

import * as three from "three";

import {
    LinearRGBVolumeTexture2DRenderBufferInfo,
    VolumeTexture2DLayout
} from "../core/TypedRenderBuffers";

import {
    ShadowMapRenderBufferInfo,
    ShadowMapRenderBuffer,
    ShadowMapRenderService
} from "./ShadowMapRenderer";

import {
    TextureRenderBuffer,
    TextureRenderBufferFormat
} from "../core/RenderBuffers";

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

import DirectionalLightShadowRenderer from "./DirectionalLightShadowRenderer";

import { VolumeTexture2DFillShader } from "../core/VolumeTexture2DFillShader";

export interface VolumetricLightPassInput
{
    shadowMaps: ShadowMapRenderBufferInfo;
    width: number;
    height: number;
    depth: number;
}

export interface VolumetricLightOutput
{
    scatter: LinearRGBVolumeTexture2DRenderBufferInfo;
}

export class VolumetricLightRenderer
{
    constructor(public renderer: RendererCore)
    {
    }

    dispose(): void
    {
    }

    setupNativeHdrVolumetricLightPass(input: VolumetricLightPassInput, ops: RenderOperation[]): VolumetricLightOutput
    {
        const outLayout = new VolumeTexture2DLayout(
            input.width, input.height, input.depth
        );

        const outp: VolumetricLightOutput = {
            scatter: new LinearRGBVolumeTexture2DRenderBufferInfo(
                "Volumetric Scatter Color", outLayout,
                TextureRenderBufferFormat.RGBAF16)
        };

        ops.push({
            inputs: {
                shadowMaps: input.shadowMaps
            },
            outputs: {
                scatter: outp.scatter
            },
            bindings: [],
            optionalOutputs: [],
            name: "Volumetric Light Pass",
            factory: (cfg) => new VolumetricLightPassRenderer(this,
                (<ShadowMapRenderBuffer> cfg.inputs["shadowMaps"]).service,
                <TextureRenderBuffer> cfg.outputs["scatter"],
                outLayout)
        });
        return outp;
    }


}

const enum DirectionalLightProgramFlags
{
    Default = 0,
    HasShadow = 1 << 0
}

const enum PointLightProgramFlags
{
    Default = 0,
    HasShadowMaps = 1 << 0
}

class VolumetricLightPassRenderer implements RenderOperator
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
        fill: VolumeTexture2DFillShader;
    }[];
    private directionalLightProgram: {
        program: GLProgram;
        uniforms: GLProgramUniforms;
        attributes: GLProgramAttributes;
        fill: VolumeTexture2DFillShader;
    }[];

    private frustumCorners: three.Vector3[];

    private invProjMat: three.Matrix4;

    private directionalLightShadowRenderer: DirectionalLightShadowRenderer;

    constructor(
        private parent: VolumetricLightRenderer,
        private inShadowMaps: ShadowMapRenderService,
        private outLit: TextureRenderBuffer,
        private outLayout: VolumeTexture2DLayout
    )
    {

        this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
            depth: null,
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
        this.invProjMat = new three.Matrix4();

        this.frustumCorners = [];
        for (let i = 0; i < 5; ++i) {
            this.frustumCorners.push(new three.Vector3());
        }

        this.directionalLightShadowRenderer = null;

        for (let i = 0; i < 2; ++i) {
            const program = parent.renderer.shaderManager.get("VS_VolumetricPointLight", "FS_VolumetricPointLight",
                ["a_position"], {
                    hasShadowMap: (i & PointLightProgramFlags.HasShadowMaps) != 0
                });
            this.pointLightProgram.push({
                program,
                uniforms: program.getUniforms([
                    "u_invProjectionMatrix",

                    "u_lightColor", "u_lightStrength",
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
                attributes: program.getAttributes(["a_position"]),
                fill: new VolumeTexture2DFillShader(this.parent.renderer, program)
            });
        }
        for (let i = 0; i < 2; ++i) {
            const program = parent.renderer.shaderManager.get("VS_VolumetricDirectionalLight", "FS_VolumetricDirectionalLight",
                ["a_position"], {
                    hasShadow: (i & DirectionalLightProgramFlags.HasShadow) != 0
                });
            this.directionalLightProgram.push({
                program,
                uniforms: program.getUniforms([
                    "u_invProjectionMatrix",

                    "u_lightDir", "u_lightColor", "u_lightStrength",
                    "u_shadow",
                    "u_dither", "u_ditherScale"
                ]),
                attributes: program.getAttributes(["a_position"]),
                fill: new VolumeTexture2DFillShader(this.parent.renderer, program)
            });
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
        this.invProjMat.getInverse(currentCamera.projectionMatrix);
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
            GLStateFlags.DepthWriteDisabled |
            GLStateFlags.BlendEnabled;
        gl.blendFunc(gl.ONE, gl.ONE); // additive
        gl.viewport(0, 0, this.outLit.width, this.outLit.height);

        // bind G-Buffer
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.parent.renderer.uniformJitter.texture);
        // TEXTURE7: shadow maps
    }
    perform(): void
    {
        const scene = this.parent.renderer.currentScene;
        const gl = this.parent.renderer.gl;

        this.fb.bind();
        gl.viewport(0, 0, this.outLit.width, this.outLit.height);

        this.setState();

        gl.clearColor(this.totalAmbient.r, this.totalAmbient.g, this.totalAmbient.b, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const jitter = this.parent.renderer.gaussianJitter;
        const vpMat = this.projectionViewMat;

        const jitterScale = 1 / 2;

        // setup common uniforms
        for (const p of this.pointLightProgram) {
            p.program.use();
            gl.uniform1i(p.uniforms["u_dither"], 0);
            gl.uniform2f(p.uniforms["u_ditherScale"],
                this.outLit.width / jitter.size * jitterScale,
                this.outLit.height / jitter.size * jitterScale);
            gl.uniform1i(p.uniforms["u_jitter"], 1);
            // u_jitterScale == u_ditherScale
            gl.uniform1i(p.uniforms["u_shadowMap"], 7);
            gl.uniform2f(p.uniforms["u_viewDirOffset"],
                this.viewVec.offset.x, this.viewVec.offset.y);
            gl.uniform2f(p.uniforms["u_viewDirCoefX"],
                this.viewVec.coefX.x, this.viewVec.coefX.y);
            gl.uniform2f(p.uniforms["u_viewDirCoefY"],
                this.viewVec.coefY.x, this.viewVec.coefY.y);
            gl.uniformMatrix4fv(p.uniforms["u_viewProjectionMatrix"], false,
                vpMat.elements);
            gl.uniformMatrix4fv(p.uniforms["u_invProjectionMatrix"], false,
                this.invProjMat.elements);
            p.fill.setLayout(this.outLayout);
        }
        for (const p of this.directionalLightProgram) {
            p.program.use();
            gl.uniform1i(p.uniforms["u_dither"], 0);
            gl.uniform2f(p.uniforms["u_ditherScale"],
                this.outLit.width / jitter.size * jitterScale,
                this.outLit.height / jitter.size * jitterScale);
            gl.uniform1i(p.uniforms["u_shadow"], 7);
            gl.uniform2f(p.uniforms["u_viewDirOffset"],
                this.viewVec.offset.x, this.viewVec.offset.y);
            gl.uniform2f(p.uniforms["u_viewDirCoefX"],
                this.viewVec.coefX.x, this.viewVec.coefX.y);
            gl.uniform2f(p.uniforms["u_viewDirCoefY"],
                this.viewVec.coefY.x, this.viewVec.coefY.y);
            gl.uniformMatrix4fv(p.uniforms["u_invProjectionMatrix"], false,
                this.invProjMat.elements);
            p.fill.setLayout(this.outLayout);
        }

        // traverse scene
        this.renderTree(scene);

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

        if (light instanceof three.AmbientLight) {
            const t = this.totalAmbient;
            t.r += light.color.r;
            t.g += light.color.g;
            t.b += light.color.b;
        }

        if (light instanceof three.DirectionalLight) {
            if (light.castShadow) {
                // this.directionalLightShadowRenderer.prepare(light);
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
        const profiler = this.parent.renderer.profiler;

        let colorR = light.color.r;
        let colorG = light.color.g;
        let colorB = light.color.b;

        const tV3a = Vector3Pool.alloc();
        const tV3b = Vector3Pool.alloc();
        const tV3c = Vector3Pool.alloc();

        if (light instanceof three.DirectionalLight) {
            profiler.begin("Directional");

            const hasShadow = light.castShadow && false;

            if (hasShadow) {
                // TODO
            }

            let flags = DirectionalLightProgramFlags.Default;
            if (hasShadow) {
                flags |= DirectionalLightProgramFlags.HasShadow;
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

            gl.uniform3f(
                p.uniforms["u_lightColor"], colorR, colorG, colorB);
            gl.uniform1f(p.uniforms["u_lightStrength"], light.intensity);

            p.fill.render();

            profiler.end();
        }

        if (light instanceof three.PointLight) {
            profiler.begin("Point");

            let radius = light.distance;

            if (radius == 0) {
                radius = Infinity;
            }

            let hasShadowMap = light.castShadow;
            const shadowCamera: three.CubeCamera =
                (<any> light).shadowCamera;

            if (hasShadowMap && shadowCamera) {
                const gen = this.inShadowMaps;
                gen.renderShadowMap(shadowCamera, ShadowMapType.Normal);

                this.setState(); // ShadowMapRenderService might change the state
                gl.activeTexture(gl.TEXTURE7);
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, gen.currentCubeShadowDistanceMap);
            } else {
                hasShadowMap = false;
            }

            const pos = light.getWorldPosition(tV3b);
            pos.applyMatrix4(this.viewMat);

            let flags = PointLightProgramFlags.Default;
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

                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, this.parent.renderer.gaussianJitter.texture);

                gl.uniform2f(p.uniforms["u_jitterAmount"],
                    16 / gen.cubeShadowDistanceMapSize, 16 / gen.cubeShadowDistanceMapSize);
            }

            p.fill.render();

            profiler.end();
        }

        if (light instanceof three.SpotLight) {
            // TODO: spot light
        }

        Vector3Pool.free(tV3a);
        Vector3Pool.free(tV3b);
        Vector3Pool.free(tV3c);
    }

    afterRender(): void
    {
        // suboperation
    }
    dispose(): void
    {
        this.fb.dispose();
    }
}
