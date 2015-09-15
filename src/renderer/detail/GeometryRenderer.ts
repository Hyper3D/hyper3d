/// <reference path="Prefix.d.ts" />
/// <reference path="TextureManager.ts" />
/// <reference path="RenderBufferManager.ts" />
/// <reference path="RendererCore.ts" />
/// <reference path="MaterialManager.ts" />
/// <reference path="GLFramebuffer.ts" />
module Hyper.Renderer
{
	export enum ShadowMapType
	{
		Depth,
		Color
	}
	
	export class ShadowMapRenderBufferInfo extends RenderBufferInfo
	{
		private bufferInfo: TextureRenderBufferInfo;
		
		constructor(private shadowMapType: ShadowMapType)
		{ 
			super("Shadow Maps");
			
			this.hash = 931810;
			this.cost = 2048 * 2048;
			switch (shadowMapType) {
				case ShadowMapType.Depth:
					this.cost *= 2;
					this.bufferInfo = new TextureRenderBufferInfo("Shadow Maps: Depth", 2048, 2048,
						TextureRenderBufferFormat.Depth);
					break;
				case ShadowMapType.Color:
					this.cost *= 4;
					this.bufferInfo = new TextureRenderBufferInfo("Shadow Maps: Color", 2048, 2048,
						TextureRenderBufferFormat.Depth);
					break;
			}
		}
		canMergeWith(o: RenderBufferInfo): boolean
		{
			if (o instanceof ShadowMapRenderBufferInfo) {
				return this == o || this.shadowMapType == o.shadowMapType;
			}
			return false;
		}
		create(manager: RenderBufferManager): ShadowMapRenderBuffer
		{
			return new ShadowMapRenderBufferImpl(this.bufferInfo.create(manager));
		}
		toString(): string
		{
			let fmtStr: string = `${this.shadowMapType}`;
			switch (this.shadowMapType) {
				case ShadowMapType.Depth:
					fmtStr = "Depth";
					break;
				case ShadowMapType.Color:
					fmtStr = "Color";
					break;
			}
			return `${fmtStr} Provider`;
		}
	}
	
	export interface ShadowMapRenderBuffer extends RenderBuffer
	{
		service: ShadowMapRenderService;
	}
	
	export interface ShadowMapRenderService
	{
		
	}
	
	class ShadowMapRenderBufferImpl implements ShadowMapRenderBufferImpl
	{
		service: ShadowMapRenderService;
		
		constructor(private tex: TextureRenderBuffer)
		{
			
		}
		
		dispose(): void
		{
			this.tex.dispose();
		}
	}
	
	export interface GeometryPassOutput
	{
		g0: TextureRenderBufferInfo;
		g1: TextureRenderBufferInfo;
		g2: TextureRenderBufferInfo;
		g3: TextureRenderBufferInfo;
		depth: TextureRenderBufferInfo;
		shadowMapsDepth: ShadowMapRenderBufferInfo;
		shadowMapsColor: ShadowMapRenderBufferInfo;
	}
	
	export class GeometryRenderer
	{
		gpMaterials: GeometryPassMaterialManager;
		
		constructor(public renderer: RendererCore)
		{
			this.gpMaterials = new GeometryPassMaterialManager(renderer);
		}
		
		dispose(): void
		{
			this.gpMaterials.dispose();
		}
		
		setupGeometryPass(width: number, height: number, ops: RenderOperation[]): GeometryPassOutput
		{
			const fullRes = this.renderer.useFullResolutionGBuffer;
			const mosaicked = new TextureRenderBufferInfo("Mosaicked G-Buffer", 
				fullRes ? width * 2 : width, fullRes ? height * 2 : height,
				TextureRenderBufferFormat.RGBA8);
			const rawDepth = new TextureRenderBufferInfo("Raw Depth", 
				width, height,
				TextureRenderBufferFormat.Depth);
			const outp: GeometryPassOutput = {
				g0: new TextureRenderBufferInfo("G0", width, height,
					TextureRenderBufferFormat.SRGBA8),
				g1: new TextureRenderBufferInfo("G1", width, height,
					TextureRenderBufferFormat.RGBA8),
				g2: new TextureRenderBufferInfo("G2", width, height,
					TextureRenderBufferFormat.RGBA8),
				g3: new TextureRenderBufferInfo("G3", width, height,
					TextureRenderBufferFormat.SRGBA8),
				depth: new TextureRenderBufferInfo("Depth", width, height,
					TextureRenderBufferFormat.RGBA8),
				shadowMapsDepth: new ShadowMapRenderBufferInfo(ShadowMapType.Depth),
				shadowMapsColor: new ShadowMapRenderBufferInfo(ShadowMapType.Color)
			};
			
			ops.push({
				inputs: {},
				outputs: {
					mosaic: mosaicked,
					depth: rawDepth,
					shadowMapsDepth: outp.shadowMapsDepth,
					shadowMapsColor: outp.shadowMapsColor
				},
				bindings: [],
				optionalOutputs: ['shadowMapsDepth', 'shadowMapsColor'],
				name: "Geometry Pass",
				factory: (cfg) => new GeometryPassRenderer(this,
					<TextureRenderBuffer> cfg.outputs['mosaic'],
					<TextureRenderBuffer> cfg.outputs['depth'],
					<ShadowMapRenderBufferImpl> cfg.outputs['shadowMapsDepth'],
					<ShadowMapRenderBufferImpl> cfg.outputs['shadowMapsColor'])
			});
			ops.push({
				inputs: {
					mosaic: mosaicked,
					depth: rawDepth
				},
				outputs: {
					g0: outp.g0,
					g1: outp.g1,
					g2: outp.g2,
					g3: outp.g3,
					depth: outp.depth
				},
				bindings: [],
				optionalOutputs: [
					"g0", "g1", "g2", "g3", "depth"
				],
				name: "Demosaick G-Buffer",
				factory: (cfg) => new DemosaicGBufferRenderer(this,
					<TextureRenderBuffer> cfg.inputs['mosaic'],
					<TextureRenderBuffer> cfg.inputs['depth'],
					[
						<TextureRenderBuffer> cfg.outputs['g0'],
						<TextureRenderBuffer> cfg.outputs['g1'],
						<TextureRenderBuffer> cfg.outputs['g2'],
						<TextureRenderBuffer> cfg.outputs['g3'],
						<TextureRenderBuffer> cfg.outputs['depth']
					])
			});
			
			return outp;
		}
		
	}
	
	class GeometryPassRenderer implements RenderOperator
	{
		private fb: GLFramebuffer;
		private tmpMat: THREE.Matrix4;
		private projectionViewMat: THREE.Matrix4;
		private viewMat: THREE.Matrix4;
		
		constructor(
			private gr: GeometryRenderer,
			private outMosaic: TextureRenderBuffer,
			private outDepth: TextureRenderBuffer,
			private outShadowMapDepth: ShadowMapRenderBufferImpl,
			private outShadowMapColor: ShadowMapRenderBufferImpl
		)
		{
			if (outShadowMapDepth) {
				outShadowMapDepth.service = this;
			}
			if (outShadowMapColor) {
				outShadowMapColor.service = this;
			}
			
			this.fb = GLFramebuffer.createFramebuffer(gr.renderer.gl, {
				depth: outDepth.texture,
				colors: [
					outMosaic.texture
				]
			});
			
			this.tmpMat = new THREE.Matrix4();
			this.projectionViewMat = new THREE.Matrix4();
			this.viewMat = null;
		}
		beforeRender(): void
		{
			this.viewMat = this.gr.renderer.currentCamera.matrixWorldInverse;
			this.projectionViewMat.multiplyMatrices(
				this.gr.renderer.currentCamera.projectionMatrix,
				this.gr.renderer.currentCamera.matrixWorldInverse
			);
		}
		perform(): void
		{
			const scene = this.gr.renderer.currentScene;
			this.fb.bind();
			
			const gl = this.gr.renderer.gl;
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			gl.disable(gl.BLEND);
			gl.enable(gl.DEPTH_TEST);
			this.renderTree(scene);
			gl.disable(gl.DEPTH_TEST);
		}
		private renderTree(obj: THREE.Object3D): void
		{
			const geometry = (<any>obj).geometry;
			
			if (geometry != null) {
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
			const shaderInst = this.gr.gpMaterials.get(mesh.material);
			const shader = <GeometryPassShader> shaderInst.shader;
			const attrBinding = shader.getGeometryBinding(this.gr.renderer.geometryManager.get(geo));
			const gl = this.gr.renderer.gl;
			
			shader.glProgram.use();
			shaderInst.updateParameterUniforms();
			attrBinding.setupVertexAttribs();
			
			this.tmpMat.multiplyMatrices(this.projectionViewMat, mesh.matrixWorld);
			gl.uniformMatrix4fv(shader.uniforms['u_viewModelProjectionMatrix'], false,
				this.tmpMat.elements);
			
			this.tmpMat.multiplyMatrices(this.viewMat, mesh.matrixWorld);
			gl.uniformMatrix4fv(shader.uniforms['u_viewModelMatrix'], false,
				this.tmpMat.elements);
				
			const geo2 = this.gr.renderer.geometryManager.get(geo);
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
			this.fb.dispose();
		}
	}
	
	class GeometryPassMaterialManager extends MaterialManager
	{
		createShader(material: Material): Shader // override
		{
			return new GeometryPassShader(this, material);
		}
	}
	
	class GeometryPassShader extends Shader
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
	
	class DemosaicGBufferRenderer implements RenderOperator
	{
		private programs: GLProgram[];
		private uniforms: GLProgramUniforms[];
		private attributes: GLProgramAttributes[];
		private fbs: GLFramebuffer[];
		
		constructor(
			private gr: GeometryRenderer,
			private inMosaic: TextureRenderBuffer,
			private inDepth: TextureRenderBuffer,
			private outG: TextureRenderBuffer[]
		)
		{
			this.programs = [];
			this.fbs = [];
			this.uniforms = [];
			this.attributes = [];
			
			for (let i = 0; i < outG.length; ++i) {
				const g = outG[i];
				if (g) {
					this.programs.push(this.gr.renderer.shaderManager.get('VS_GBufferDemosaic', 'FS_GBufferDemosaic', 
						['a_position'], {
						gBufferIndex: i
					}));
					this.fbs.push(GLFramebuffer.createFramebuffer(gr.renderer.gl, {
						depth: null,
						colors: [g.texture]
					}));
				}
			}
			for (const p of this.programs) {
				this.uniforms.push(p.getUniforms(['u_uvScale', 'u_mosaic', 'u_depth']));
				this.attributes.push(p.getAttributes(['a_position']));
			}
		}
		beforeRender(): void
		{
		}
		perform(): void
		{
			const programs = this.programs;
			const uniforms = this.uniforms;
			const attributes = this.attributes;
			const fbs = this.fbs;
			const quadRenderer = this.gr.renderer.quadRenderer;
			const gl = this.gr.renderer.gl;
			
			gl.disable(gl.BLEND);
			
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.inMosaic.texture);
			
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, this.inDepth.texture);
			
			for (let i = 0; i < fbs.length; ++i) {
				const unif = uniforms[i];
			
				fbs[i].bind();
				programs[i].use();
				
				gl.uniform1i(unif['u_mosaic'], 0);
				gl.uniform1i(unif['u_depth'], 1);
				gl.uniform4f(unif['u_uvScale'], 0.5, 0.5, 0.5, 0.5);
				
				quadRenderer.render(attributes[i]['a_position']);
			}
		}
		afterRender(): void
		{
		}
		dispose(): void
		{
			for (const fb of this.fbs) {
				fb.dispose();
			}
			// shaders are owned by ShaderManager.
		}
	}
}