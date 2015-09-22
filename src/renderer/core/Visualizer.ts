/// <reference path="../Prefix.d.ts" />
/// <reference path="../core/RenderBufferManager.ts" />
/// <reference path="../core/RendererCore.ts" />
/// <reference path="../core/GLFramebuffer.ts" />
module Hyper.Renderer
{
	export class BufferVisualizer
	{
		constructor(private core: RendererCore)
		{		
		}
		
		dispose(): void
		{
		}
		
		setupColorVisualizer(input: TextureRenderBufferInfo, ops: RenderOperation[]): DummyRenderBufferInfo
		{
			const outp = new DummyRenderBufferInfo("Visualized Output");
			
			ops.push({
				inputs: {
					input: input
				},
				outputs: {
					output: outp
				},
				optionalOutputs: ['output'],
				name: "Visualize Color Buffer",
				factory: (cfg) => new BufferVisualizerInstance(
					this.core,
					<TextureRenderBuffer> cfg.inputs['input'],
					'FS_VisualizeColor')
			});
			
			return outp;
		}
		
		setupLinearDepthVisualizer(input: TextureRenderBufferInfo, ops: RenderOperation[]): DummyRenderBufferInfo
		{
			const outp = new DummyRenderBufferInfo("Visualized Output");
			
			ops.push({
				inputs: {
					input: input
				},
				outputs: {
					output: outp
				},
				optionalOutputs: ['output'],
				name: "Visualize Linear Depth Buffer",
				factory: (cfg) => new BufferVisualizerInstance(
					this.core,
					<TextureRenderBuffer> cfg.inputs['input'],
					'FS_VisualizeLinearDepth')
			});
			
			return outp;
		}
	}
	
	class BufferVisualizerInstance implements RenderOperator
	{
		private program: GLProgram;
		private uniforms: GLProgramUniforms;
		private attributes: GLProgramAttributes;
		
		constructor(private core: RendererCore,
			private input: TextureRenderBuffer,
			private shader: string)
		{
			this.program = core.shaderManager.get('VS_Passthrough', shader, [
				'a_position'
			]);
			this.attributes = this.program.getAttributes(['a_position']);
			this.uniforms = this.program.getUniforms(['u_texture', 'u_uvScale']);
		}
		dispose(): void
		{
			
		}
		beforeRender(): void
		{ }
		perform(): void
		{
			const gl = this.core.gl;
			
			// bind default framebuffer
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.input.texture);
			
			this.program.use();
			gl.uniform1i(this.uniforms['u_texture'], 0);
			gl.uniform4f(this.uniforms['u_uvScale'], 0.5, 0.5, 0.5, 0.5);
			
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
			gl.clearColor(0, 0, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT);
			this.core.state.flags = GLStateFlags.Default;
			
			const quad = this.core.quadRenderer;
			quad.render(this.attributes['a_position']);
		}
		afterRender(): void
		{ }
	}
}