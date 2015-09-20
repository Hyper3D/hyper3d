/// <reference path="../Prefix.d.ts" />
/// <reference path="../core/RenderBufferManager.ts" />
/// <reference path="../core/RendererCore.ts" />
/// <reference path="../core/GLFramebuffer.ts" />
/// <reference path="../utils/Geometry.ts" />
module Hyper.Renderer
{
	export const enum ResampleFilterType
	{
		Nearest,
		Linear
	}
	export interface ResampleFilterParameters
	{
		type: ResampleFilterType;
		outWidth: number;
		outHeight: number;
	}
	export class ResampleFilterRenderer
	{
		constructor(public renderer: RendererCore)
		{
		}
		
		dispose(): void
		{
		}
		
		setupFilter(input: TextureRenderBufferInfo, params: ResampleFilterParameters, ops: RenderOperation[]): TextureRenderBufferInfo
		{
			const width = params.outWidth;
			const height = params.outHeight;
			const outp = new TextureRenderBufferInfo(input.name + " Resampled", width, height, input.format);
			
			let name: string;
			switch (params.type) {
				case ResampleFilterType.Linear: name = "Linear"; break;
				case ResampleFilterType.Nearest: name = "Nearest"; break;
			}
			
			ops.push({
				inputs: {
					input: input,
				},
				outputs: {
					output: outp
				},
				bindings: [],
				optionalOutputs: [],
				name: `Resample (${name})`,
				factory: (cfg) => new ResampleFilterRendererInstance(this,
					<TextureRenderBuffer> cfg.inputs['input'],
					<TextureRenderBuffer> cfg.outputs['output'],
					params)
			});
			return outp;
		}
	}
	
	export class ResampleFilterRendererInstance implements RenderOperator
	{
		private fb: GLFramebuffer;
		
		private program: {
			program: GLProgram;
			uniforms: GLProgramUniforms;
			attributes: GLProgramAttributes;		
		};
		
		constructor(
			private parent: ResampleFilterRenderer,
			private input: TextureRenderBuffer,
			private out: TextureRenderBuffer,
			private params: ResampleFilterParameters
		)
		{
			
			this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
				depth: null,
				colors: [
					out.texture
				]
			});
			
			{
				const program = parent.renderer.shaderManager.get('VS_Passthrough', 'FS_Passthrough',
					['a_position']);
				this.program = {
					program,
					uniforms: program.getUniforms([
						'u_texture',
						'u_uvScale'
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
			this.parent.renderer.state.flags = 
				GLStateFlags.DepthWriteDisabled;
			
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.input.texture);
			if (this.params.type == ResampleFilterType.Linear) {
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			}
			
			const p = this.program;
			p.program.use();
			gl.uniform1i(p.uniforms['u_texture'], 0);
			gl.uniform4f(p.uniforms['u_uvScale'], .5, .5, .5, .5);
				
			const quad = this.parent.renderer.quadRenderer;
			quad.render(p.attributes['a_position']);
			
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
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