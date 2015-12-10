/// <reference path="../Prefix.d.ts" />

import { TextureManager } from './TextureManager';

import { 
	MaterialManager, 
	Shader,
	ShaderInstance, 
	importThreeJsMaterial,
	getUniformDeclarationsForMaterial
} from './MaterialManager';

import { 
	SkinningShader, 
	SkinningMode,
	SkinningShaderInstance
} from './SkinningShader';

import { GLFramebuffer } from '../core/GLFramebuffer';

import { IntegerMap } from '../utils/IntegerMap';

import { 
	MaterialShadingModel,
	MaterialInstance
} from '../public/Materials';

import { RendererCore } from '../core/RendererCore'; 

import {
	GLProgram,
	GLProgramUniforms,
	GLProgramUniformSetters,
	GLProgramAttributes
} from '../core/GLProgram';

import { GLShader } from '../core/GLShader';

import { tmpM } from '../utils/Geometry';

import { ShaderChunk } from '../core/GLShader';

import { shaderChunks } from '../core/Shaders';

import { Material } from '../public/Materials';

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
	private tmpMat: THREE.Matrix4;
	private objs: IntegerMap<BaseGeometryPassRendererObject>;
	
	constructor(
		public core: RendererCore,
		public materialManager: MaterialManager,
		public needsLastWorldPosition: boolean
	)
	{
		this.tmpMat = new THREE.Matrix4();
		this.state = {
			projectionViewMat: new THREE.Matrix4(),
			viewMat: new THREE.Matrix4(),
			frustum: new THREE.Frustum(),
			lastViewProjMat: new THREE.Matrix4(),
			nextToken: false
		};
		
		this.objs = new IntegerMap<BaseGeometryPassRendererObject>();
	}
	
	renderGeometry(viewMatrix: THREE.Matrix4, projectionMatrix: THREE.Matrix4): void
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
	private cullObject(obj: THREE.Object3D): boolean
	{
		return obj.frustumCulled &&
			!this.state.frustum.intersectsObject(obj);
	}
	private renderTree(obj: THREE.Object3D): void
	{
		const geometry = (<any>obj).geometry;
		
		if (geometry != null && !this.cullObject(obj)) {
			if (obj instanceof THREE.Mesh &&
				!this.skipsMesh(obj)) {
				this.renderMesh(obj, geometry);
			}
		}
		
		for (const child of obj.children) {
			this.renderTree(child);
		}
	}
	private renderMesh(mesh: THREE.Mesh, geo: any): void
	{
		const gl = this.core.gl;
		let lobj: BaseGeometryPassRendererObject = this.objs.get(mesh.id);
		if (!lobj) {
			lobj = new BaseGeometryPassRendererObject(mesh, this);
			this.objs.set(mesh.id, lobj);
		}
		
		lobj.render(this.state);
	}
	skipsMesh(mesh: THREE.Mesh): boolean
	{
		// to be overrided
		return false;
	}
	skipsMaterial(mat: MaterialInstance): boolean
	{
		return !isMaterialShadingModelDeferred(mat.material.shadingModel);
	}
	setupAdditionalUniforms(mesh: THREE.Mesh, shader: BaseGeometryPassShader): void
	{
		// to be overrided
	}
	dispose(): void
	{
	}
}

interface GeometryRenderState
{
	projectionViewMat: THREE.Matrix4;
	viewMat: THREE.Matrix4;
	frustum: THREE.Frustum;
	
	lastViewProjMat: THREE.Matrix4;
	
	nextToken: boolean;
}

class BaseGeometryPassRendererObject
{
	token: boolean;
	lastModelMatrix: THREE.Matrix4;
	shaderInst: ShaderInstance;
	shader: BaseGeometryPassShader;
	
	skinning: SkinningShaderInstance;
	
	constructor(private obj: THREE.Mesh, private renderer: BaseGeometryPassRenderer)
	{
		this.token = false;
		
		this.lastModelMatrix = null;
		this.shaderInst = null;
		this.shader = null;
		this.skinning = null;
		
		this.lastModelMatrix = obj.matrixWorld.clone();
		
		const useSkinning = obj instanceof THREE.SkinnedMesh;
		
		let flags = BaseGeometryPassShaderFlags.None;
		
		if (useSkinning) {
			flags |= BaseGeometryPassShaderFlags.UseSkinning;
		}
			
		const matInst = importThreeJsMaterial(obj.material);
		
		if (renderer.skipsMaterial(matInst)) {
			// not handled in this renderer.
			return;
		}
		
		this.shaderInst = renderer.materialManager.get(matInst, flags);
		this.shader = <BaseGeometryPassShader> this.shaderInst.shader;
		
		if (this.shader.skinningShader) {
			this.skinning = this.shader.skinningShader.createInstance(<any>obj);
		}
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
			
			gl.uniformMatrix4fv(shader.uniforms['u_viewProjectionMatrix'], false,
				state.projectionViewMat.elements);
			gl.uniformMatrix4fv(shader.uniforms['u_lastViewProjectionMatrix'], false,
				state.lastViewProjMat.elements);
			
			tmpM.multiplyMatrices(state.viewMat, obj.matrixWorld);
			gl.uniformMatrix4fv(shader.uniforms['u_viewModelMatrix'], false,
				tmpM.elements);
				
			gl.uniformMatrix4fv(shader.uniforms['u_viewMatrix'], false,
				state.viewMat.elements);
			gl.uniformMatrix4fv(shader.uniforms['u_modelMatrix'], false,
				obj.matrixWorld.elements);
				
			gl.uniformMatrix4fv(shader.uniforms['u_lastModelMatrix'], false,
				this.lastModelMatrix.elements);
				
			if (this.skinning) {
				this.skinning.update();
			}
			
			renderer.setupAdditionalUniforms(obj, shader);
				
			const index = geo2.indexAttribute;
			if (index != null) {
				index.drawElements();
				
				// TODO: use THREE.GeometryBuffer.offsets
			} else {
				gl.drawArrays(gl.TRIANGLES, 0, geo2.numFaces * 3);
			}
		}
		
		this.save(state.nextToken);
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
			source: vsParts.join('\n')
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
			requires: [manager.fsName, 'Materials'],
			source: fsParts.join('\n')
		};
		
		let skinningMode: SkinningMode;
		if (flags & BaseGeometryPassShaderFlags.UseSkinning) {
			if (manager.core.ext.get('OES_texture_float')) {
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
			'u_viewProjectionMatrix',
			'u_lastViewProjectionMatrix',
			'u_modelMatrix',
			'u_lastModelMatrix',
			'u_viewMatrix',
			'u_viewModelMatrix'
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

