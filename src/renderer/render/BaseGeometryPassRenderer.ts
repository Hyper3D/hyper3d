/// <reference path="../Prefix.d.ts" />
/// <reference path="TextureManager.ts" />
/// <reference path="../core/RenderBufferManager.ts" />
/// <reference path="../core/RendererCore.ts" />
/// <reference path="MaterialManager.ts" />
/// <reference path="../core/GLFramebuffer.ts" />
module Hyper.Renderer
{
	export class BaseGeometryPassRenderer
	{
		private tmpMat: THREE.Matrix4;
		private projectionViewMat: THREE.Matrix4;
		private viewMat: THREE.Matrix4;
		private frustum: THREE.Frustum;
		
		constructor(
			public core: RendererCore,
			public materialManager: MaterialManager
		)
		{
			this.tmpMat = new THREE.Matrix4();
			this.projectionViewMat = new THREE.Matrix4();
			this.viewMat = new THREE.Matrix4();
			this.frustum = new THREE.Frustum();
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
			
			shader.glProgram.use();
			shaderInst.updateParameterUniforms();
			attrBinding.setupVertexAttribs();
			
			this.tmpMat.multiplyMatrices(this.projectionViewMat, mesh.matrixWorld);
			gl.uniformMatrix4fv(shader.uniforms['u_viewModelProjectionMatrix'], false,
				this.tmpMat.elements);
			
			this.tmpMat.multiplyMatrices(this.viewMat, mesh.matrixWorld);
			gl.uniformMatrix4fv(shader.uniforms['u_viewModelMatrix'], false,
				this.tmpMat.elements);
				
			const geo2 = this.core.geometryManager.get(geo);
			const index = geo2.indexAttribute;
			if (index != null) {
				index.drawElements();
				
				// TODO: use THREE.GeometryBuffer.offsets
			} else {
				gl.drawArrays(gl.TRIANGLES, 0, geo2.numFaces * 3);
			}
		}
		afterRender(): void
		{
		}
		dispose(): void
		{
		}
	}
	
	export class GeometryPassMaterialManager extends MaterialManager
	{
		createShader(material: Material): Shader // override
		{
			return new GeometryPassShader(this, material);
		}
	}
	
	export class GeometryPassShader extends Shader
	{
		private program: GLProgram;
		
		uniforms: GLProgramUniforms;
		
		constructor(public manager: MaterialManager, public source: Material)
		{
			super(manager, source);
			
			const attrs = this.getVertexAttributesUsedInShader(
				GLShader.getAllAttributesReferencedByChunk([shaderChunks['VS_Geometry']]), false);
			const allAttrs = this.getVertexAttributesUsedInShader(
				GLShader.getAllAttributesReferencedByChunk([shaderChunks['VS_Geometry']]), true);
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
				requires: ['VS_Geometry'],
				source: vsParts.join('\n')
			};
			
			fsParts.push(`void evaluateShader() {`);
			fsParts.push(this.source.shader);
			fsParts.push(`}`);
			
			const fsChunk: ShaderChunk = {
				requires: ['FS_Geometry'],
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
				'u_viewModelProjectionMatrix',
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
