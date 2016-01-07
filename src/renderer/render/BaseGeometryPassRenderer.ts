/// <reference path="../Prefix.d.ts" />

import * as three from "three";

import {
    MaterialManager,
    Shader,
    ShaderInstance,
    importThreeJsMaterial,
    getUniformDeclarationsForMaterial
} from "./MaterialManager";

import {
    SkinningShader,
    SkinningMode,
    SkinningShaderInstance
} from "./SkinningShader";

import { IntegerMap } from "../utils/IntegerMap";

import {
    MaterialShadingModel,
    MaterialInstance
} from "../public/Materials";

import { RendererCore } from "../core/RendererCore";

import {
    GLProgram,
    GLProgramUniforms
} from "../core/GLProgram";

import { Geometry } from "./GeometryManager";

import { GLShader } from "../core/GLShader";

import { Matrix4Pool } from "../utils/ObjectPool";

import { ShaderChunk } from "../core/GLShader";

import { shaderChunks } from "../core/Shaders";

import { Material } from "../public/Materials";

export const enum BaseGeometryPassShaderFlags
{
    None = 0,
    UseSkinning = 1 << 0,
    NeedsLastPosition = 1 << 1 // this one must be added in derived BaseGeometryPassMaterialManager
}

export function isMaterialShadingModelDeferred(model: MaterialShadingModel): boolean
{
    return model == MaterialShadingModel.Opaque || model == MaterialShadingModel.ClearCoat ||
        model == MaterialShadingModel.Unlit;
}

export class BaseGeometryPassRenderer
{
    private state: GeometryRenderState;
    private tmpMat: three.Matrix4;
    private objs: IntegerMap<BaseGeometryPassRendererObject>;

    constructor(
        public core: RendererCore,
        public materialManager: MaterialManager,
        public needsLastWorldPosition: boolean
    )
    {
        this.tmpMat = new three.Matrix4();
        this.state = {
            projectionViewMat: new three.Matrix4(),
            viewMat: new three.Matrix4(),
            frustum: new three.Frustum(),
            lastViewProjMat: new three.Matrix4(),
            nextToken: false
        };

        this.objs = new IntegerMap<BaseGeometryPassRendererObject>();
    }

    renderGeometry(viewMatrix: three.Matrix4, projectionMatrix: three.Matrix4): void
    {
        const state = this.state;
        state.viewMat.copy(viewMatrix);
        state.projectionViewMat.multiplyMatrices(
            projectionMatrix,
            viewMatrix
        );
        state.frustum.setFromMatrix(state.projectionViewMat);

        const scene = this.core.currentScene;

        this.renderTree(scene);

        // remove unneeded objects from this.objs
        this.objs.forEach((id, obj) => {
            if (obj.token != state.nextToken) {
                this.objs.remove(id);
            }
        });
        state.nextToken = !state.nextToken;

        state.lastViewProjMat.copy(state.projectionViewMat);
    }
    private cullObject(obj: three.Object3D): boolean
    {
        return obj.frustumCulled &&
            !this.state.frustum.intersectsObject(obj);
    }
    private renderTree(obj: three.Object3D): void
    {
        const geometry = (<any> obj).geometry;

        if (geometry != null && !this.cullObject(obj)) {
            if (obj instanceof three.Mesh &&
                !this.skipsMesh(obj)) {
                this.renderMesh(obj, geometry);
            } else if (obj instanceof three.Points &&
                !this.skipsPoints(obj)) {
                this.renderPoints(obj, geometry);
            }
        }

        for (const child of obj.children) {
            this.renderTree(child);
        }
    }
    private renderMesh(mesh: three.Mesh, geo: any): void
    {
        let lobj: BaseGeometryPassRendererObject = this.objs.get(mesh.id);
        if (!lobj) {
            lobj = new BaseGeometryPassRendererMesh(mesh, this);
            this.objs.set(mesh.id, lobj);
        }

        lobj.render(this.state);
    }
    private renderPoints(points: three.Points, geo: any): void
    {
        let lobj: BaseGeometryPassRendererObject = this.objs.get(points.id);
        if (!lobj) {
            lobj = new BaseGeometryPassRendererPoints(points, this);
            this.objs.set(points.id, lobj);
        }

        lobj.render(this.state);
    }
    skipsMesh(mesh: three.Mesh): boolean
    {
        // to be overrided
        return false;
    }
    skipsPoints(points: three.Points): boolean
    {
        // to be overrided
        return false;
    }
    skipsMaterial(mat: MaterialInstance): boolean
    {
        return !isMaterialShadingModelDeferred(mat.material.shadingModel);
    }
    setupAdditionalUniforms(mesh: ObjectWithGeometry, shader: BaseGeometryPassShader): void
    {
        // to be overrided
    }
    dispose(): void
    {
    }
}

interface GeometryRenderState
{
    projectionViewMat: three.Matrix4;
    viewMat: three.Matrix4;
    frustum: three.Frustum;

    lastViewProjMat: three.Matrix4;

    nextToken: boolean;
}

export interface ObjectWithGeometry extends three.Object3D
{
    geometry: THREE.Geometry | THREE.BufferGeometry;
    material: THREE.Material;
}

class BaseGeometryPassRendererObject
{
    token: boolean;
    lastModelMatrix: three.Matrix4;
    shaderInst: ShaderInstance;
    shader: BaseGeometryPassShader;

    constructor(public obj: ObjectWithGeometry, public renderer: BaseGeometryPassRenderer,
        flags: BaseGeometryPassShaderFlags)
    {
        this.token = false;

        this.lastModelMatrix = null;
        this.shaderInst = null;
        this.shader = null;

        this.lastModelMatrix = obj.matrixWorld.clone();

        const matInst = importThreeJsMaterial(obj.material);

        if (renderer.skipsMaterial(matInst)) {
            // not handled in this renderer.
            return;
        }

        this.shaderInst = renderer.materialManager.get(matInst, flags);
        this.shader = <BaseGeometryPassShader> this.shaderInst.shader;
    }

    get isSkipped(): boolean
    {
        return this.shader == null;
    }

    render(state: GeometryRenderState): void
    {
        if (this.shader) {
            const gl = this.renderer.core.gl;
            const obj = this.obj;
            const geo = this.obj.geometry;
            const renderer = this.renderer;
            const geo2 = renderer.core.geometryManager.get(geo);
            const shaderInst = this.shaderInst;
            const shader = this.shader;
            const attrBinding = shader.getGeometryBinding(geo2);

            shader.glProgram.use();
            shaderInst.updateParameterUniforms();
            attrBinding.setupVertexAttribs();

            gl.uniformMatrix4fv(shader.uniforms["u_viewProjectionMatrix"], false,
                state.projectionViewMat.elements);
            gl.uniformMatrix4fv(shader.uniforms["u_lastViewProjectionMatrix"], false,
                state.lastViewProjMat.elements);

            const m = Matrix4Pool.alloc();
            m.multiplyMatrices(state.viewMat, obj.matrixWorld);
            gl.uniformMatrix4fv(shader.uniforms["u_viewModelMatrix"], false,
                m.elements);
            Matrix4Pool.free(m);

            gl.uniformMatrix4fv(shader.uniforms["u_viewMatrix"], false,
                state.viewMat.elements);
            gl.uniformMatrix4fv(shader.uniforms["u_modelMatrix"], false,
                obj.matrixWorld.elements);

            gl.uniformMatrix4fv(shader.uniforms["u_lastModelMatrix"], false,
                this.lastModelMatrix.elements);

            renderer.setupAdditionalUniforms(obj, shader);

            this.glDraw(geo2);
        }

        this.save(state.nextToken);
    }

    glDraw(geo: Geometry): void
    {
        const gl = this.renderer.core.gl;
        const index = geo.indexAttribute;
        if (index != null) {
            index.drawElements(gl.TRIANGLES);

            // TODO: use three.GeometryBuffer.offsets
        } else {
            gl.drawArrays(gl.TRIANGLES, 0, geo.numFaces * 3);
        }
    }

    private save(token: boolean): void
    {
        // some materials are skipped by some renderer.
        // saving the model matrix is not needed if a material is skipped
        if (this.shader) {
            this.lastModelMatrix.copy(this.obj.matrixWorld);
        }
        this.token = token;
    }

}

class BaseGeometryPassRendererMesh extends BaseGeometryPassRendererObject
{
    skinning: SkinningShaderInstance;

    private static computeShaderFlags(mesh: three.Mesh): BaseGeometryPassShaderFlags
    {
        let flags = BaseGeometryPassShaderFlags.None;

        const useSkinning = mesh instanceof three.SkinnedMesh;

        if (useSkinning) {
            flags |= BaseGeometryPassShaderFlags.UseSkinning;
        }

        return flags;
    }

    constructor(private mesh: three.Mesh, renderer: BaseGeometryPassRenderer)
    {
        super(mesh, renderer, BaseGeometryPassRendererMesh.computeShaderFlags(mesh));

        if (this.isSkipped) {
            return;
        }

        if (this.shader.skinningShader) {
            this.skinning = this.shader.skinningShader.createInstance(<any> mesh);
        }
    }

    render(state: GeometryRenderState): void
    {
        if (this.isSkipped) {
            return;
        }

        if (this.skinning) {
            this.skinning.update();
        }

        BaseGeometryPassRendererObject.prototype.render.call(this, state);
    }
}

class BaseGeometryPassRendererPoints extends BaseGeometryPassRendererObject
{
    constructor(private points: three.Points, renderer: BaseGeometryPassRenderer)
    {
        super(points, renderer, BaseGeometryPassShaderFlags.None);
    }

    glDraw(geo: Geometry): void
    {
        const gl = this.renderer.core.gl;
        const index = geo.indexAttribute;
        if (index != null) {
            index.drawElements(gl.POINTS);

            // TODO: use three.GeometryBuffer.offsets
        } else {
            gl.drawArrays(gl.POINTS, 0, geo.numVertices);
        }
    }

}

export class BaseGeometryPassMaterialManager extends MaterialManager
{
    constructor(core: RendererCore,
        public vsName: string,
        public fsName: string)
    {
        super(core);
    }

    createShader(material: Material, flags: number): Shader // override
    {
        return new BaseGeometryPassShader(this, material, flags);
    }
}

export class BaseGeometryPassShader extends Shader
{
    private program: GLProgram;

    uniforms: GLProgramUniforms;

    skinningShader: SkinningShader;

    constructor(
        public manager: BaseGeometryPassMaterialManager,
        public source: Material,
        private flags: BaseGeometryPassShaderFlags)
    {
        super(manager, source);

        const attrs = this.getVertexAttributesUsedInShader(
            GLShader.getAllAttributesReferencedByChunk([shaderChunks[manager.vsName]]), false);
        const allAttrs = this.getVertexAttributesUsedInShader(
            GLShader.getAllAttributesReferencedByChunk([shaderChunks[manager.vsName]]), true);
        const vsParts: string[] = [];
        const fsParts: string[] = [];

        for (const attr of attrs) {
            let baseName = attr.substr(2);
            vsParts.push(`attribute vec4 a_${baseName};`);
            vsParts.push(`varying vec4 v_${baseName};`);
            fsParts.push(`varying vec4 v_${baseName};`); // FIXME: precision?
        }
        fsParts.push(getUniformDeclarationsForMaterial(source));
        vsParts.push(`void computeExtraValues() {`);
        for (const attr of attrs) {
            let baseName = attr.substr(2);
            vsParts.push(`v_${baseName} = a_${baseName};`);
        }
        vsParts.push(`}`);

        const vsChunk: ShaderChunk = {
            requires: [manager.vsName],
            source: vsParts.join("\n")
        };

        fsParts.push(`void evaluateShader() {`);
        switch (source.shadingModel) {
            case MaterialShadingModel.Unlit:
                fsParts.push(`m_materialId = MaterialIdUnlit;`);
                break;
            case MaterialShadingModel.Opaque:
                fsParts.push(`m_materialId = MaterialIdDefault;`);
                break;
            case MaterialShadingModel.ClearCoat:
                fsParts.push(`m_materialId = MaterialIdClearCoat;`);
                break;
            default:
                // not deferred-shaded; cannot determine material id.
        }
        fsParts.push(this.source.shader);
        fsParts.push(`}`);

        const fsChunk: ShaderChunk = {
            requires: [manager.fsName, "Materials"],
            source: fsParts.join("\n")
        };

        let skinningMode: SkinningMode;
        if (flags & BaseGeometryPassShaderFlags.UseSkinning) {
            if (manager.core.ext.get("OES_texture_float")) {
                skinningMode = SkinningMode.FloatTexture;
            } else {
                skinningMode = SkinningMode.Texture;
            }
        } else {
            skinningMode = SkinningMode.None;
        }

        const shaderParameters: any = {
            useNormalMap: true, // FIXME
            skinningMode: skinningMode
        };

        let vs: GLShader = null;
        let fs: GLShader = null;

        try {
            const gl = manager.core.gl;
            let vsCode = GLShader.preprocess(manager.core, [vsChunk],
                shaderParameters, gl.VERTEX_SHADER);
            let fsCode = GLShader.preprocess(manager.core, [fsChunk],
                shaderParameters, gl.FRAGMENT_SHADER);
            vs = GLShader.compile(manager.core, gl.VERTEX_SHADER, vsCode);
            fs = GLShader.compile(manager.core, gl.FRAGMENT_SHADER, fsCode);
            this.program = GLProgram.link(manager.core, [vs, fs],
                allAttrs);
        } finally {
            if (vs) {
                vs.dispose();
            }
            if (fs) {
                fs.dispose();
            }
        }

        this.uniforms = this.program.getUniforms([
            "u_viewProjectionMatrix",
            "u_lastViewProjectionMatrix",
            "u_modelMatrix",
            "u_lastModelMatrix",
            "u_viewMatrix",
            "u_viewModelMatrix"
        ]);

        if (skinningMode != SkinningMode.None) {
            this.skinningShader = new SkinningShader(
                this.manager.core,
                this.program,
                (flags & BaseGeometryPassShaderFlags.NeedsLastPosition) != 0,
                skinningMode
            );
            this.skinningShader.textureStageIndex = this.numTextureStages;
            this.numTextureStages += this.skinningShader.numTextureStagesNeeded;
        } else {
            this.skinningShader = null;
        }
    }
    get glProgram(): GLProgram // override
    {
        return this.program;
    }
    dispose(): void
    {
        this.program.dispose();

        Shader.prototype.dispose.call(this);
    }
}

