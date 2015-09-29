/// <reference path="../Prefix.d.ts" />
/// <reference path="../core/RenderBuffers.ts" />
/// <reference path="../core/RendererCore.ts" />
/// <reference path="../core/GLFramebuffer.ts" />
/// <reference path="../utils/Geometry.ts" />
module Hyper.Renderer
{
	export class GaussianBlurFilterRenderer
	{
		constructor(public renderer: RendererCore)
		{
		}
		
		dispose(): void
		{
		}
		
		setupFilter(input: LinearRGBTextureRenderBufferInfo, sigma: number, ops: RenderOperation[]): LinearRGBTextureRenderBufferInfo
		{
			const outp = new LinearRGBTextureRenderBufferInfo("H & V Blurred", input.width, input.height,
					input.format);
			
			const tmp = new LinearRGBTextureRenderBufferInfo("H Blurred", input.width, input.height,
					input.format);
					
			ops.push({
				inputs: {
					input: input
				},
				outputs: {
					output: tmp
				},
				bindings: [],
				optionalOutputs: [],
				name: `H Gaussian Blur (sigma=${sigma})`,
				factory: (cfg) => new GaussianBlurFilterRendererInstance(this,
					<TextureRenderBuffer> cfg.inputs['input'],
					<TextureRenderBuffer> cfg.outputs['output'],
					sigma, GaussianBlurFilterDirection.Horitonzal)
			});
			ops.push({
				inputs: {
					input: tmp
				},
				outputs: {
					output: outp
				},
				bindings: [],
				optionalOutputs: [],
				name: `V Gaussian Blur (sigma=${sigma})`,
				factory: (cfg) => new GaussianBlurFilterRendererInstance(this,
					<TextureRenderBuffer> cfg.inputs['input'],
					<TextureRenderBuffer> cfg.outputs['output'],
					sigma, GaussianBlurFilterDirection.Vertical)
			});
			return outp;
		}
	}
	enum GaussianBlurFilterDirection
	{
		Horitonzal,
		Vertical
	}
	
	class GaussianBlurFilterRendererInstance implements RenderOperator
	{
		private fb: GLFramebuffer;
		private kernelSize: number;
		private kernelRadius: number;
		private weights: number[];
		private weightUniforms: WebGLUniformLocation[];
		
		private program: {
			program: GLProgram;
			uniforms: GLProgramUniforms;
			attributes: GLProgramAttributes;		
		};
		
		constructor(
			private parent: GaussianBlurFilterRenderer,
			private input: TextureRenderBuffer,
			private out: TextureRenderBuffer,
			private sigma: number,
			private dir: GaussianBlurFilterDirection
		)
		{
			this.kernelRadius = Math.floor(sigma * 2);
			this.kernelSize = 1 + this.kernelRadius * 2;
			
			let kernelTotal = 0;
			this.weights = [];
			for (let i = 0; i < this.kernelSize; ++i) {
				let d = (i - this.kernelRadius) / sigma;
				let k = Math.exp(-d * d);
				this.weights.push(k);
				kernelTotal += k;
			}
			
			const scale = 1 / kernelTotal;
			for (let i = 0; i < this.kernelSize; ++i) {
				this.weights[i] *= scale;
			}
			
			
			this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
				depth: null,
				colors: [
					out.texture
				]
			});
			
			{
				const program = parent.renderer.shaderManager.get('VS_GaussianBlur', 'FS_GaussianBlur',
					['a_position'], {
						kernelSize: this.kernelSize
					});
				this.program = {
					program,
					uniforms: program.getUniforms([
						'u_input', 'u_linearDepth',
						'u_texCoordOffset', 'u_texCoordIncr',
						'u_weight1',
						'u_weight2',
						'u_weight3',
						'u_weight4',
						'u_weight5',
						'u_weight6',
						'u_weight7',
						'u_weight8',
						'u_weight9',
						'u_weight10',
						'u_weight11'
					]),
					attributes: program.getAttributes(['a_position'])
				};
				
				this.weightUniforms = [];
				for (let i = 1; i <= this.kernelSize; ++i) {
					this.weightUniforms.push(this.program.uniforms[`u_weight${i}`]);
				}
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
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			
			const p = this.program;
			p.program.use();
			gl.uniform1i(p.uniforms['u_input'], 0);
			gl.uniform1i(p.uniforms['u_linearDepth'], 1);
			
			const unifs = this.weightUniforms;
			const weights = this.weights;
			for (let i = 0; i < weights.length; ++i) {
				gl.uniform1f(unifs[i], weights[i]);
			}
			
			let offsX = 1 / this.out.width;
			let offsY = 1 / this.out.height;
			switch (this.dir) {
				case GaussianBlurFilterDirection.Horitonzal: offsY = 0; break;
				case GaussianBlurFilterDirection.Vertical: offsX = 0; break;
			}
			gl.uniform2f(p.uniforms['u_texCoordIncr'], offsX, offsY);
			gl.uniform2f(p.uniforms['u_texCoordOffset'], 
				-offsX * this.kernelRadius, 
				-offsY * this.kernelRadius);
				
			const quad = this.parent.renderer.quadRenderer;
			quad.render(p.attributes['a_position']);
			
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
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