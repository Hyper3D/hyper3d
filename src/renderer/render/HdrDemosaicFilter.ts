/// <reference path="../Prefix.d.ts" />
/// <reference path="../core/RenderBuffers.ts" />
/// <reference path="../core/RendererCore.ts" />
/// <reference path="../core/GLFramebuffer.ts" />
/// <reference path="../utils/Geometry.ts" />
module Hyper.Renderer
{
	export interface HdrDemosaicFilterParameters
	{
		halfSized: boolean;
	}
	export class HdrDemosaicFilterRenderer
	{
		constructor(public renderer: RendererCore)
		{
		}
		
		dispose(): void
		{
		}
		
		setupFilter(input: HdrMosaicTextureRenderBufferInfo, params: HdrDemosaicFilterParameters, ops: RenderOperation[]): LogRGBTextureRenderBufferInfo
		{
			let width = input.width;
			let height = input.height;
			
			if (params.halfSized) {
				width >>= 1; height >>= 1;
			}
			
			const tmp = new LogRGBTextureRenderBufferInfo("LogRGB", width, height, input.format);
			const outp = new LogRGBTextureRenderBufferInfo("LogRGB", width, height, input.format);
			
			ops.push({
				inputs: {
					input: input,
				},
				outputs: {
					output: tmp
				},
				bindings: [],
				optionalOutputs: [],
				name: `HDR Demosaic`,
				factory: (cfg) => new HdrDemosaicFilterRendererInstance(this,
					<TextureRenderBuffer> cfg.inputs['input'],
					<TextureRenderBuffer> cfg.outputs['output'],
					params)
			});
			
			ops.push({
				inputs: {
					input: tmp,
				},
				outputs: {
					output: outp
				},
				bindings: [],
				optionalOutputs: [],
				name: `Smoothen Demosaic Result`,
				factory: (cfg) => new BlurFilterRendererInstance(this,
					<TextureRenderBuffer> cfg.inputs['input'],
					<TextureRenderBuffer> cfg.outputs['output'])
			});
			
			return outp;
		}
	}
	
	class HdrDemosaicFilterRendererInstance implements RenderOperator
	{
		private fb: GLFramebuffer;
		
		private program: {
			program: GLProgram;
			uniforms: GLProgramUniforms;
			attributes: GLProgramAttributes;		
		};
		
		constructor(
			private parent: HdrDemosaicFilterRenderer,
			private input: TextureRenderBuffer,
			private out: TextureRenderBuffer,
			private params: HdrDemosaicFilterParameters
		)
		{
			
			this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
				depth: null,
				colors: [
					out.texture
				]
			});
			
			{
				const program = parent.renderer.shaderManager.get('VS_HdrDemosaic', 'FS_HdrDemosaic',
					['a_position']);
				this.program = {
					program,
					uniforms: program.getUniforms([
						'u_mosaic'
					]),
					attributes: program.getAttributes(['a_position'])
				};
			}
		}
		beforeRender(): void
		{
		}
		perform(): void
		{
			const scene = this.parent.renderer.currentScene;
			this.fb.bind();
			
			const gl = this.parent.renderer.gl;
			gl.viewport(0, 0, this.out.width, this.out.height);
			this.parent.renderer.invalidateFramebuffer(gl.COLOR_ATTACHMENT0);
			this.parent.renderer.state.flags = GLStateFlags.DepthWriteDisabled;
			
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.input.texture);
			
			const p = this.program;
			p.program.use();
			gl.uniform1i(p.uniforms['u_mosaic'], 0);
				
			const quad = this.parent.renderer.quadRenderer;
			quad.render(p.attributes['a_position']);
		
		}
		afterRender(): void
		{
		}
		dispose(): void
		{
			this.fb.dispose();
		}
	}
	
	class BlurFilterRendererInstance implements RenderOperator
	{
		private fb: GLFramebuffer;
		
		private program: {
			program: GLProgram;
			uniforms: GLProgramUniforms;
			attributes: GLProgramAttributes;		
		};
		
		constructor(
			private parent: HdrDemosaicFilterRenderer,
			private input: TextureRenderBuffer,
			private out: TextureRenderBuffer
		)
		{
			
			this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
				depth: null,
				colors: [
					out.texture
				]
			});
			
			{
				const program = parent.renderer.shaderManager.get('VS_Blur', 'FS_Blur',
					['a_position']);
				this.program = {
					program,
					uniforms: program.getUniforms([
						'u_texture'
					]),
					attributes: program.getAttributes(['a_position'])
				};
			}
		}
		beforeRender(): void
		{
		}
		perform(): void
		{
			const scene = this.parent.renderer.currentScene;
			this.fb.bind();
			
			const gl = this.parent.renderer.gl;
			gl.viewport(0, 0, this.out.width, this.out.height);
			this.parent.renderer.invalidateFramebuffer(gl.COLOR_ATTACHMENT0);
			this.parent.renderer.state.flags = GLStateFlags.DepthWriteDisabled;
			
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.input.texture);
			
			const p = this.program;
			p.program.use();
			gl.uniform1i(p.uniforms['u_texture'], 0);
				
			const quad = this.parent.renderer.quadRenderer;
			quad.render(p.attributes['a_position']);
		
		}
		afterRender(): void
		{
		}
		dispose(): void
		{
			this.fb.dispose();
		}
	}
}