/// <reference path="../Prefix.d.ts" />
/// <reference path="TextureManager.ts" />
/// <reference path="../core/RenderBufferManager.ts" />
/// <reference path="../core/RendererCore.ts" />
/// <reference path="MaterialManager.ts" />
/// <reference path="../core/GLFramebuffer.ts" />
/// <reference path="../utils/Utils.ts" />
module Hyper.Renderer
{
	export class BaseGeometryPassRenderer
	{
		private tmpMat: THREE.Matrix4;
		private projectionViewMat: THREE.Matrix4;
		private viewMat: THREE.Matrix4;
		private frustum: THREE.Frustum;
		
		private lastViewProjMat: THREE.Matrix4;
		private objs: Utils.IntegerMap<BaseGeometryPassRendererObject>; // FIXME: only one instance of this is needed for entire the renderer
		private nextToken: boolean;
		
		constructor(
			public core: RendererCore,
			public materialManager: MaterialManager,
			private needsLastWorldPosition: boolean
		)
		{
			this.tmpMat = new THREE.Matrix4();
			this.projectionViewMat = new THREE.Matrix4();
			this.viewMat = new THREE.Matrix4();
			this.frustum = new THREE.Frustum();
			
			this.objs = new Utils.IntegerMap<BaseGeometryPassRendererObject>();
			this.nextToken = false;
			this.lastViewProjMat = new THREE.Matrix4();
		}
		
		renderGeometry(viewMatrix: THREE.Matrix4, projectionMatrix: THREE.Matrix4): void
		{
			this.viewMat.copy(viewMatrix);
			this.projectionViewMat.multiplyMatrices(
				projectionMatrix,
				viewMatrix
			);
			this.frustum.setFromMatrix(this.projectionViewMat);
			
			const scene = this.core.currentScene;
			
			this.renderTree(scene);
			
			// remove unneeded objects from this.objs
			this.objs.forEach((id, obj) => {
				if (obj.token != this.nextToken) {
					this.objs.remove(id);
				}
			});
			this.nextToken = !this.nextToken;
			
			this.lastViewProjMat.copy(this.projectionViewMat);
		}
		private cullObject(obj: THREE.Object3D): boolean
		{
			return obj.frustumCulled &&
				!this.frustum.intersectsObject(obj);
		}
		private renderTree(obj: THREE.Object3D): void
		{
			const geometry = (<any>obj).geometry;
			
			if (geometry != null && !this.cullObject(obj)) {
				if (obj instanceof THREE.Mesh) {
					this.renderMesh(obj, geometry);
				}
			}
			
			for (const child of obj.children) {
				this.renderTree(child);
			}
		}
		private renderMesh(mesh: THREE.Mesh, geo: any): void
		{
			const shaderInst = this.materialManager.get(mesh.material);
			const shader = <GeometryPassShader> shaderInst.shader;
			const attrBinding = shader.getGeometryBinding(this.core.geometryManager.get(geo));
			const gl = this.core.gl;
			let lobj = this.needsLastWorldPosition ? this.objs.get(mesh.id) : null;
			
			shader.glProgram.use();
			shaderInst.updateParameterUniforms();
			attrBinding.setupVertexAttribs();
			
			gl.uniformMatrix4fv(shader.uniforms['u_viewProjectionMatrix'], false,
				this.projectionViewMat.elements);
			gl.uniformMatrix4fv(shader.uniforms['u_lastViewProjectionMatrix'], false,
				this.lastViewProjMat.elements);
			
			this.tmpMat.multiplyMatrices(this.viewMat, mesh.matrixWorld);
			gl.uniformMatrix4fv(shader.uniforms['u_viewModelMatrix'], false,
				this.tmpMat.elements);
				
			gl.uniformMatrix4fv(shader.uniforms['u_viewMatrix'], false,
				this.viewMat.elements);
			gl.uniformMatrix4fv(shader.uniforms['u_modelMatrix'], false,
				mesh.matrixWorld.elements);
				
			if (lobj) {
				gl.uniformMatrix4fv(shader.uniforms['u_lastModelMatrix'], false,
					lobj.lastViewModelMatrix.elements);
			} else {
				gl.uniformMatrix4fv(shader.uniforms['u_lastModelMatrix'], false,
					mesh.matrixWorld.elements);
			}
				
			const geo2 = this.core.geometryManager.get(geo);
			const index = geo2.indexAttribute;
			if (index != null) {
				index.drawElements();
				
				// TODO: use THREE.GeometryBuffer.offsets
			} else {
				gl.drawArrays(gl.TRIANGLES, 0, geo2.numFaces * 3);
			}
			
			if (this.needsLastWorldPosition) {
				if (!lobj) {
					lobj = new BaseGeometryPassRendererObject(mesh);
					this.objs.set(mesh.id, lobj);
				}
				lobj.save(this.nextToken);
			}
		}
		dispose(): void
		{
		}
	}
	
	class BaseGeometryPassRendererObject
	{
		token: boolean;
		lastViewModelMatrix: THREE.Matrix4;
		
		constructor(private obj: THREE.Object3D)
		{
			this.token = false;
			this.lastViewModelMatrix = obj.matrixWorld.clone();
		}
		
		save(token: boolean): void
		{
			this.lastViewModelMatrix.copy(this.obj.matrixWorld);
			this.token = token;
		}
		
	}
	
	export class GeometryPassMaterialManager extends MaterialManager
	{
		constructor(core: RendererCore,
			public vsName: string,
			public fsName: string)
		{
			super(core);
		}
		
		createShader(material: Material): Shader // override
		{
			return new GeometryPassShader(this, material);
		}
	}
	
	export class GeometryPassShader extends Shader
	{
		private program: GLProgram;
		
		uniforms: GLProgramUniforms;
		
		constructor(public manager: GeometryPassMaterialManager, public source: Material)
		{
			super(manager, source);
			
			const attrs = this.getVertexAttributesUsedInShader(
				GLShader.getAllAttributesReferencedByChunk([shaderChunks[manager.vsName]]), false);
			const allAttrs = this.getVertexAttributesUsedInShader(
				GLShader.getAllAttributesReferencedByChunk([shaderChunks[manager.vsName]]), true);
			const vsParts: string[] = [];
			const fsParts: string[] = [];
			
			for (const attr of attrs) {
				vsParts.push(`attribute vec4 ${attr};`);
				vsParts.push(`varying vec4 v_${attr};`);
				fsParts.push(`varying vec4 v_${attr};`); // FIXME: precision?
			}
			fsParts.push(getUniformDeclarationsForMaterial(source));
			vsParts.push(`void computeExtraValues() {`);
			for (const attr of attrs) {
				vsParts.push(`v_${attr} = a_${attr};`);
			}
			vsParts.push(`}`);
			
			const vsChunk: ShaderChunk = {
				requires: [manager.vsName],
				source: vsParts.join('\n')
			};
			
			fsParts.push(`void evaluateShader() {`);
			fsParts.push(this.source.shader);
			fsParts.push(`}`);
			
			const fsChunk: ShaderChunk = {
				requires: [manager.fsName],
				source: fsParts.join('\n')
			};
			
			const shaderParameters: any = {
				useNormalMap: true // FIXME	
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
	
}
