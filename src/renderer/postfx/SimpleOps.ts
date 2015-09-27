/// <reference path="../Prefix.d.ts" />
/// <reference path="../core/RenderPipeline.ts" />
/// <reference path="../core/RendererCore.ts" />
/// <reference path="../core/GLFramebuffer.ts" />
/// <reference path="../utils/Geometry.ts" />
module Hyper.Renderer
{
	export class BufferAdder
	{
		constructor(public renderer: RendererCore)
		{
		}
		
		dispose(): void
		{
		}
		
		setupFilter(input: TextureRenderBufferInfo, added: TextureRenderBufferInfo, modulation: THREE.Vector4, ops: RenderOperation[]): TextureRenderBufferInfo
		{
			const width = input.width;
			const height = input.height;
			const outp = new TextureRenderBufferInfo("Sum", width, height, input.format);
			
			ops.push({
				inputs: {
					input1: input,
					input2: added,
				},
				outputs: {
					output: outp
				},
				bindings: ['input1', 'output'],
				optionalOutputs: [],
				name: `Add`,
				factory: (cfg) => new BufferAdderInstance(this,
					<TextureRenderBuffer> cfg.inputs['input1'],
					<TextureRenderBuffer> cfg.inputs['input2'],
					<TextureRenderBuffer> cfg.outputs['output'],
					modulation ? modulation.clone() : null)
			});
			return outp;
		}
	}
	
	class BufferAdderInstance implements RenderOperator
	{
		private fb: GLFramebuffer;
		
		constructor(
			private parent: BufferAdder,
			private input1: TextureRenderBuffer,
			private input2: TextureRenderBuffer,
			private out: TextureRenderBuffer,
			private modulation: THREE.Vector4
		)
		{
			
			this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
				depth: null,
				colors: [
					out.texture
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
			gl.viewport(0, 0, this.out.width, this.out.height);
			this.parent.renderer.state.flags = 
				GLStateFlags.DepthWriteDisabled;
				
			gl.activeTexture(gl.TEXTURE0);
			
			if (this.input1 != this.out) {
				this.parent.renderer.invalidateFramebuffer(gl.COLOR_ATTACHMENT0);
				gl.bindTexture(gl.TEXTURE_2D, this.input1.texture);
				this.parent.renderer.passthroughRenderer.render();
			}
			
			this.parent.renderer.state.flags = 
				GLStateFlags.DepthWriteDisabled |
				GLStateFlags.BlendEnabled;
			gl.blendFunc(gl.ONE, gl.ONE);
			
			gl.bindTexture(gl.TEXTURE_2D, this.input2.texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			
			if (this.modulation)
				this.parent.renderer.passthroughRenderer.renderModulated(
					this.modulation.x, this.modulation.y, this.modulation.z,
					this.modulation.w
				);
			else
				this.parent.renderer.passthroughRenderer.render();
			
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