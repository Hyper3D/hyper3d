/// <reference path="../Prefix.d.ts" />
/// <reference path="../core/RenderPipeline.ts" />
/// <reference path="../core/RendererCore.ts" />
/// <reference path="../core/GLFramebuffer.ts" />
/// <reference path="../utils/Geometry.ts" />
module Hyper.Renderer
{
	export interface TemporalAAInput
	{
		g0: TextureRenderBufferInfo;
		g1: TextureRenderBufferInfo;
		color: TextureRenderBufferInfo;
		linearDepth: TextureRenderBufferInfo;
	}
	
	export interface TemporalAAFilterParameters
	{
		// TODO: parameters!
		
	}
	export class TemporalAAFilterRenderer
	{
		params: TemporalAAFilterParameters; // value can be modified
		
		constructor(public renderer: RendererCore)
		{
			this.params = {
			};
		}
		
		dispose(): void
		{
		}
		
		/** input must be LogRGB. */
		setupFilter(input: TemporalAAInput, ops: RenderOperation[]): TextureRenderBufferInfo
		{
			let width = input.color.width;
			let height = input.color.height;
			
			const outp = new TextureRenderBufferInfo("Antialiased", width, height, input.color.format);
			
			ops.push({
				inputs: {
					g0: input.g0, g1: input.g1,
					input: input.color,
					linearDepth: input.linearDepth
				},
				outputs: {
					output: outp
				},
				bindings: [],
				optionalOutputs: [],
				name: `Temporal AA`,
				factory: (cfg) => new TemporalAAFilterRendererInstance(this,
					<TextureRenderBuffer> cfg.inputs['input'],
					<TextureRenderBuffer> cfg.inputs['g0'],
					<TextureRenderBuffer> cfg.inputs['g1'],
					<TextureRenderBuffer> cfg.inputs['linearDepth'],
					<TextureRenderBuffer> cfg.outputs['output'])
			});
			return outp;
		}
	}
	
	class TemporalAAFilterRendererInstance implements RenderOperator
	{
		private fb: GLFramebuffer;
		
		private program: {
			program: GLProgram;
			uniforms: GLProgramUniforms;
			attributes: GLProgramAttributes;		
		};
		private pre: {
			program: GLProgram;
			uniforms: GLProgramUniforms;
			attributes: GLProgramAttributes;		
		};
		
		private accumTex: WebGLTexture;
		private accumFb: GLFramebuffer;
		
		private savedDepthTex: WebGLTexture;
		private savedDepthFb: GLFramebuffer;
		
		private firstTime: boolean;
		
		constructor(
			private parent: TemporalAAFilterRenderer,
			private input: TextureRenderBuffer,
			private inG0: TextureRenderBuffer,
			private inG1: TextureRenderBuffer,
			private inLinearDepth: TextureRenderBuffer,
			private out: TextureRenderBuffer
		)
		{
			
			this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
				depth: null,
				colors: [
					out.texture
				]
			});
			
			const gl = parent.renderer.gl;
			
			this.accumTex = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, this.accumTex);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			const fmt = input.format == TextureRenderBufferFormat.SRGBA8 ?
				parent.renderer.ext.get('EXT_sRGB').SRGB_ALPHA_EXT : gl.RGBA;
			gl.texImage2D(gl.TEXTURE_2D, 0, fmt, input.width, input.height, 0,
				fmt, gl.UNSIGNED_BYTE, null);
			
			this.savedDepthTex = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, this.savedDepthTex);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, input.width, input.height, 0,
				gl.RGBA, gl.UNSIGNED_BYTE, null);
			
			this.accumFb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
				depth: null,
				colors: [
					this.accumTex
				]
			});
			
			this.savedDepthFb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
				depth: null,
				colors: [
					this.savedDepthTex
				]
			});
			
			this.firstTime = true;
			
			{
				const program = parent.renderer.shaderManager.get('VS_TemporalAA', 'FS_TemporalAA',
					['a_position']);
				this.program = {
					program,
					uniforms: program.getUniforms([
						'u_input',
						'u_linearDepth',
						'u_oldAccum',
						'u_oldDepth',
						'u_g0', 'u_g1'
					]),
					attributes: program.getAttributes(['a_position'])
				};
			}
			{
				const program = parent.renderer.shaderManager.get('VS_TemporalAA', 'FS_TemporalAAPrepass',
					['a_position']);
				this.pre = {
					program,
					uniforms: program.getUniforms([
						'u_input',
						'u_linearDepth',
						'u_oldAccum',
						'u_oldDepth',
						'u_g0', 'u_g1'
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
			
			const gl = this.parent.renderer.gl;
			gl.viewport(0, 0, this.out.width, this.out.height);
			this.parent.renderer.state.flags = GLStateFlags.DepthWriteDisabled;
			
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.input.texture);
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, this.inLinearDepth.texture);
			gl.activeTexture(gl.TEXTURE2);
			gl.bindTexture(gl.TEXTURE_2D, this.inG0.texture);
			gl.activeTexture(gl.TEXTURE3);
			gl.bindTexture(gl.TEXTURE_2D, this.inG1.texture);
			gl.activeTexture(gl.TEXTURE4);
			gl.bindTexture(gl.TEXTURE_2D, this.accumTex);
			gl.activeTexture(gl.TEXTURE5);
			gl.bindTexture(gl.TEXTURE_2D, this.savedDepthTex);
			
			const quad = this.parent.renderer.quadRenderer;
			
			{
				this.fb.bind();
				this.parent.renderer.invalidateFramebuffer(gl.COLOR_ATTACHMENT0);
			
				const p = this.pre;
				p.program.use();
				gl.uniform1i(p.uniforms['u_input'], 0);
				gl.uniform1i(p.uniforms['u_linearDepth'], 1);
				gl.uniform1i(p.uniforms['u_g0'], 2);
				gl.uniform1i(p.uniforms['u_g1'], 3);
				gl.uniform1i(p.uniforms['u_oldAccum'], 4);
				gl.uniform1i(p.uniforms['u_oldDepth'], 5);
				
				const params = this.parent.params;
				
				// TODO: set some parameters
				quad.render(p.attributes['a_position']);
			}
			{
				this.accumFb.bind();
				this.parent.renderer.invalidateFramebuffer(gl.COLOR_ATTACHMENT0);
				
				gl.activeTexture(gl.TEXTURE4);
				gl.bindTexture(gl.TEXTURE_2D, this.out.texture);
			
				const p = this.program;
				p.program.use();
				gl.uniform1i(p.uniforms['u_input'], 0);
				gl.uniform1i(p.uniforms['u_linearDepth'], 1);
				gl.uniform1i(p.uniforms['u_g0'], 2);
				gl.uniform1i(p.uniforms['u_g1'], 3);
				gl.uniform1i(p.uniforms['u_oldAccum'], 4);
				gl.uniform1i(p.uniforms['u_oldDepth'], 5);
				
				const params = this.parent.params;
				
				// TODO: set some parameters
				quad.render(p.attributes['a_position']);
			}
			
			// copy to accumulation buffer
			this.fb.bind();
			this.parent.renderer.invalidateFramebuffer(gl.COLOR_ATTACHMENT0);
			
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.accumTex);
			this.parent.renderer.passthroughRenderer.render();
			
			// save depth
			this.savedDepthFb.bind();
			this.parent.renderer.invalidateFramebuffer(gl.COLOR_ATTACHMENT0);
			
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.inLinearDepth.texture);
			this.parent.renderer.passthroughRenderer.render();
		}
		afterRender(): void
		{
		}
		dispose(): void
		{
			const gl = this.parent.renderer.gl;
			
			this.fb.dispose();
			this.accumFb.dispose();
			this.savedDepthFb.dispose();
			
			gl.deleteTexture(this.accumTex);
			gl.deleteTexture(this.savedDepthTex);
		}
	}
}