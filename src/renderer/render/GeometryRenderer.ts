/// <reference path="../Prefix.d.ts" />
/// <reference path="TextureManager.ts" />
/// <reference path="../core/RenderPipeline.ts" />
/// <reference path="../core/RendererCore.ts" />
/// <reference path="MaterialManager.ts" />
/// <reference path="BaseGeometryPassRenderer.ts" />
/// <reference path="../core/GLFramebuffer.ts" />
module Hyper.Renderer
{
	
	export interface GeometryPassOutput
	{
		g0: TextureRenderBufferInfo;
		g1: TextureRenderBufferInfo;
		g2: TextureRenderBufferInfo;
		g3: TextureRenderBufferInfo;
		linearDepth: TextureRenderBufferInfo;
		depth: TextureRenderBufferInfo;
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
		
		setupShadowPass(ops: RenderOperation[])
		{
			
		}
		
		setupGeometryPass(width: number, height: number, ops: RenderOperation[]): GeometryPassOutput
		{
			const fullRes = this.renderer.useFullResolutionGBuffer;
			const mosaicked = new TextureRenderBufferInfo("Mosaicked G-Buffer", 
				fullRes ? width * 2 : width, fullRes ? height * 2 : height,
				TextureRenderBufferFormat.RGBA8);
			const rawDepth = new TextureRenderBufferInfo("Raw Depth", 
				fullRes ? width * 2 : width, fullRes ? height * 2 : height,
				TextureRenderBufferFormat.Depth);
			const outp: GeometryPassOutput = {
				g0: new TextureRenderBufferInfo("G0", width, height,
					this.renderer.supportsSRGB ?
						TextureRenderBufferFormat.SRGBA8 :
						TextureRenderBufferFormat.RGBA8),
				g1: new TextureRenderBufferInfo("G1", width, height,
					TextureRenderBufferFormat.RGBA8),
				g2: new TextureRenderBufferInfo("G2", width, height,
					TextureRenderBufferFormat.RGBA8),
				g3: new TextureRenderBufferInfo("G3", width, height,
					this.renderer.supportsSRGB ?
						TextureRenderBufferFormat.SRGBA8 :
						TextureRenderBufferFormat.RGBA8),
				linearDepth: new TextureRenderBufferInfo("Depth", width, height,
					TextureRenderBufferFormat.RGBA8),
				depth: rawDepth
			};
			
			ops.push({
				inputs: {},
				outputs: {
					mosaic: mosaicked,
					depth: rawDepth
				},
				bindings: [],
				optionalOutputs: ['shadowMapsDepth', 'shadowMapsColor'],
				name: "Geometry Pass",
				factory: (cfg) => new GeometryPassRenderer(this,
					<TextureRenderBuffer> cfg.outputs['mosaic'],
					<TextureRenderBuffer> cfg.outputs['depth'])
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
					depth: outp.linearDepth
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
	
	class GeometryPassShader extends BaseGeometryPassShader
	{
		geoUniforms: GLProgramUniforms;
		
		constructor(public manager: BaseGeometryPassMaterialManager, public source: Material, flags: number)
		{
			super(manager, source, flags);
			
			this.geoUniforms = this.glProgram.getUniforms([
				'u_screenVelOffset'
			]);
		}
	}
	
	class GeometryPassMaterialManager extends BaseGeometryPassMaterialManager
	{
		constructor(core: RendererCore)
		{
			super(core, 'VS_Geometry', 'FS_Geometry');
		}
		
		createShader(material: Material, flags: number): Shader // override
		{
			return new GeometryPassShader(this, material, flags | BaseGeometryPassShaderFlags.NeedsLastPosition);
		}
	}
	
	
	class GeometryPassRenderer extends BaseGeometryPassRenderer implements RenderOperator
	{
		private fb: GLFramebuffer;
		
		private lastJitX: number;
		private lastJitY: number;
		private screenVelOffX: number;
		private screenVelOffY: number;
		
		constructor(
			private parent: GeometryRenderer,
			private outMosaic: TextureRenderBuffer,
			private outDepth: TextureRenderBuffer
		)
		{
			super(parent.renderer, parent.gpMaterials, true);
			
			this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
				depth: outDepth.texture,
				colors: [
					outMosaic.texture
				]
			});
			
			this.lastJitX = this.lastJitY = 0;
			this.screenVelOffX = this.screenVelOffY = 0;
		}
		
		setupAdditionalUniforms(mesh: THREE.Mesh, shader: BaseGeometryPassShader): void // override
		{
			const shd = <GeometryPassShader>shader;
			const gl = this.parent.renderer.gl;
			gl.uniform2f(shd.geoUniforms['u_screenVelOffset'], this.screenVelOffX, this.screenVelOffY);
		}
		
		beforeRender(): void
		{
		}
		perform(): void
		{
			
			const scene = this.parent.renderer.currentScene;
			this.fb.bind();
			
			// jitter projection matrix for temporal AA
			const projMat = tmpM;
			projMat.copy(this.parent.renderer.currentCamera.projectionMatrix);
			
			const jitX = (Math.random() - Math.random()) / this.parent.renderer.renderWidth * 2;
			const jitY = (Math.random() - Math.random()) / this.parent.renderer.renderHeight * 2;
			for (let i = 0; i < 4; ++i) {
				projMat.elements[(i << 2)] += projMat.elements[(i << 2) + 3] * jitX;
				projMat.elements[(i << 2) + 1] += projMat.elements[(i << 2) + 3] * jitY;
			}
			this.screenVelOffX = this.lastJitX - jitX;
			this.screenVelOffY = this.lastJitY - jitY;
			this.lastJitX = jitX;
			this.lastJitY = jitY;
			
			const gl = this.parent.renderer.gl;
			gl.viewport(0, 0, this.outMosaic.width, this.outMosaic.height);
			gl.clearColor(0.5, 0.5, 0.5, 0.5); // this should be safe value
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			this.parent.renderer.state.flags = GLStateFlags.DepthTestEnabled;
			this.renderGeometry(this.parent.renderer.currentCamera.matrixWorldInverse,
				projMat);
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
	
	class DemosaicGBufferRenderer implements RenderOperator
	{
		private programs: GLProgram[];
		private uniforms: GLProgramUniforms[];
		private attributes: GLProgramAttributes[];
		private fbs: GLFramebuffer[];
		private outWidth: number;
		private outHeight: number;
		
		constructor(
			private parent: GeometryRenderer,
			private inMosaic: TextureRenderBuffer,
			private inDepth: TextureRenderBuffer,
			private outG: TextureRenderBuffer[]
		)
		{
			this.programs = [];
			this.fbs = [];
			this.uniforms = [];
			this.attributes = [];
			
			this.outWidth = 1;
			this.outHeight = 1;
			
			for (let i = 0; i < outG.length; ++i) {
				const g = outG[i];
				if (g) {
					this.programs.push(this.parent.renderer.shaderManager.get('VS_GBufferDemosaic', 'FS_GBufferDemosaic', 
						['a_position'], {
						gBufferIndex: i
					}));
					this.fbs.push(GLFramebuffer.createFramebuffer(parent.renderer.gl, {
						depth: null,
						colors: [g.texture]
					}));
					this.outWidth = g.width;
					this.outHeight = g.height;
				}
			}
			for (const p of this.programs) {
				this.uniforms.push(p.getUniforms(['u_uvScale', 'u_mosaic', 'u_depth', 'u_depthLinearizeCoef']));
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
			const quadRenderer = this.parent.renderer.quadRenderer;
			const gl = this.parent.renderer.gl;
			
			this.parent.renderer.state.flags = GLStateFlags.Default;
			
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.inMosaic.texture);
			
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, this.inDepth.texture);
			
			gl.viewport(0, 0, this.outWidth, this.outHeight);
			
			const proj = this.parent.renderer.currentCamera.projectionMatrix;
				
			for (let i = 0; i < fbs.length; ++i) {
				const unif = uniforms[i];
			
				fbs[i].bind();
				programs[i].use();
				
				this.parent.renderer.invalidateFramebuffer(gl.COLOR_ATTACHMENT0, gl.DEPTH_ATTACHMENT);
				
				gl.uniform1i(unif['u_mosaic'], 0);
				gl.uniform1i(unif['u_depth'], 1);
				gl.uniform4f(unif['u_uvScale'], 0.5, 0.5, 0.5, 0.5);
				gl.uniform4f(unif['u_depthLinearizeCoef'], 
					proj.elements[15], -proj.elements[14],
					proj.elements[11], -proj.elements[10]);
				
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