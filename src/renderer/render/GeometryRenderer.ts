/// <reference path="../Prefix.d.ts" />
/// <reference path="TextureManager.ts" />
/// <reference path="../core/RenderBufferManager.ts" />
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
			this.gpMaterials = new GeometryPassMaterialManager(renderer, 'VS_Geometry', 'FS_Geometry');
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
	
	class GeometryPassRenderer extends BaseGeometryPassRenderer implements RenderOperator
	{
		private fb: GLFramebuffer;
		
		constructor(
			private parent: GeometryRenderer,
			private outMosaic: TextureRenderBuffer,
			private outDepth: TextureRenderBuffer
		)
		{
			super(parent.renderer, parent.gpMaterials);
			
			this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
				depth: outDepth.texture,
				colors: [
					outMosaic.texture
				]
			});
			
		}
		
		beforeRender(): void
		{
		}
		perform(): void
		{
			
			const scene = this.parent.renderer.currentScene;
			this.fb.bind();
			
			const gl = this.parent.renderer.gl;
			gl.viewport(0, 0, this.outMosaic.width, this.outMosaic.height);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			this.parent.renderer.state.flags = GLStateFlags.DepthTestEnabled;
			this.renderGeometry(this.parent.renderer.currentCamera.matrixWorldInverse,
				this.parent.renderer.currentCamera.projectionMatrix);
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