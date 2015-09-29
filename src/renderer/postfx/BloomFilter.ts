/// <reference path="../Prefix.d.ts" />
/// <reference path="../core/RenderBuffers.ts" />
/// <reference path="../core/RendererCore.ts" />
/// <reference path="../core/GLFramebuffer.ts" />
/// <reference path="../utils/Geometry.ts" />
/// <reference path="BlurFilter.ts" />
/// <reference path="SimpleOps.ts" />
/// <reference path="ResampleFilter.ts" />
module Hyper.Renderer
{
	export interface BloomFilterParameters
	{
		amount: number;
		saturation: number;
	}
	export class BloomFilterRenderer
	{
		params: BloomFilterParameters;
		
		private blurFlt: GaussianBlurFilterRenderer;
		private resampler: ResampleFilterRenderer;
		private adder: BufferAdder;
		
		constructor(public renderer: RendererCore)
		{
			this.params = {
				amount: 0.5,
				saturation: 1
			};
			
			this.resampler = new ResampleFilterRenderer(renderer);
			this.blurFlt = new GaussianBlurFilterRenderer(renderer);
			this.adder = new BufferAdder(renderer);
		}
		
		dispose(): void
		{
		}
		
		setupFilter<T extends LogRGBTextureRenderBufferInfo | LinearRGBTextureRenderBufferInfo>
		(input: T, ops: RenderOperation[]): T
		{
			
			// convert input to linear RGB.
			// hope that GPU supports sRGB buffer... (or we'll lose much precision)
			let ds0: LinearRGBTextureRenderBufferInfo;
			
			if (input instanceof LogRGBTextureRenderBufferInfo) {
				ds0 = new LinearRGBTextureRenderBufferInfo("Bloom 1/2", 
						(input.width + 1) >> 1, (input.height + 1) >> 1,
						input.format);
				ops.push({
					inputs: {
						input: input
					},
					outputs: {
						output: ds0
					},
					bindings: [],
					optionalOutputs: [],
					name: `Resample and Convert To Linear RGB`,
					factory: (cfg) => new BloomDownsampleRenderer(this,
						<TextureRenderBuffer> cfg.inputs['input'],
						<TextureRenderBuffer> cfg.outputs['output'],
						1 / 32)
				});
			} else {
				// already linear
				ds0 = this.resampler.setupLinearResampler(input, {
					outWidth: (input.width + 1) >> 1,
					outHeight: (input.height + 1) >> 1
				}, ops);
				ds0.name = "Bloom 1/2";
			}
			
			const levels: LinearRGBTextureRenderBufferInfo[] = [];
			let prev = ds0;
			for (let i = 0; i < 6; ++i) { 
				let size = 4 << i;
				if (input.width < size * 4 || input.height < size * 4) {
					break;
				}
				const ds = this.resampler.setupLinearResampler(prev, {
					outWidth: (input.width + size - 1) >> (i + 2),
					outHeight: (input.height + size - 1) >> (i + 2)
				}, ops);
				ds.name = `Bloom 1/${size}`;
				
				if (i < 1) {
					prev = ds;
					continue;
				}
				const lp = this.blurFlt.setupFilter(ds, 1, ops);
				lp.name = `Bloom 1/${size} LPFed`;
				levels.push(lp);
				prev = lp;
			}
			
			// blend all levels (they're linear color so can be blended with BufferAdded)
			for (let i = levels.length - 2; i >= 0; --i) {
				let lum = 1.5;
				prev = this.adder.setupFilter(levels[i], prev, 
					new THREE.Vector4(lum, lum, lum, lum),
					ops);
			}
			
			// combine
			const outp = input instanceof LinearRGBTextureRenderBufferInfo ?
				new LinearRGBTextureRenderBufferInfo("Bloom Added", input.width, input.height,
					input.format) : 
				new LogRGBTextureRenderBufferInfo("Bloom Added", input.width, input.height,
					input.format);
			
			ops.push({
				inputs: {
					input: input,
					bloom: prev
				},
				outputs: {
					output: outp
				},
				bindings: [],
				optionalOutputs: [],
				name: `Combine Bloom`,
				factory: (cfg) => new BloomFinalPassRenderer(this,
					<TextureRenderBuffer> cfg.inputs['input'],
					<TextureRenderBuffer> cfg.inputs['bloom'],
					<TextureRenderBuffer> cfg.outputs['output'],
					input instanceof LogRGBTextureRenderBufferInfo,
					input instanceof LogRGBTextureRenderBufferInfo ? 1 : 1 / 32)
			});
			
			
			return <T> outp;
		}
	}
	class BloomDownsampleRenderer implements RenderOperator
	{
		private fb: GLFramebuffer;
		
		private program: {
			program: GLProgram;
			uniforms: GLProgramUniforms;
			attributes: GLProgramAttributes;		
		};
		
		constructor(
			private parent: BloomFilterRenderer,
			private input: TextureRenderBuffer,
			private out: TextureRenderBuffer,
			private gain: number
		)
		{
			
			this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
				depth: null,
				colors: [
					out.texture
				]
			});
			
			{
				const program = parent.renderer.shaderManager.get('VS_BloomDownsample', 'FS_BloomDownsample',
					['a_position']);
				this.program = {
					program,
					uniforms: program.getUniforms([
						'u_input',
						'u_gain',
						
						'u_texCoordOffset'
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
			gl.uniform1i(p.uniforms['u_input'], 0);
			
			gl.uniform1f(p.uniforms['u_gain'], this.gain * 0.25);
			
			gl.uniform2f(p.uniforms['u_texCoordOffset'],
				0.5 / this.input.width,
				0.5 / this.input.height);
				
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
	class BloomFinalPassRenderer implements RenderOperator
	{
		private fb: GLFramebuffer;
		
		private program: {
			program: GLProgram;
			uniforms: GLProgramUniforms;
			attributes: GLProgramAttributes;		
		};
		
		constructor(
			private parent: BloomFilterRenderer,
			private input: TextureRenderBuffer,
			private bloom: TextureRenderBuffer,
			private out: TextureRenderBuffer,
			useLogRGB: boolean,
			private gain: number
		)
		{
			
			this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
				depth: null,
				colors: [
					out.texture
				]
			});
			
			{
				const program = parent.renderer.shaderManager.get('VS_Bloom', 'FS_Bloom',
					['a_position'], {
						useLogRGB
					});
				this.program = {
					program,
					uniforms: program.getUniforms([
						'u_input',
						'u_bloom',
						
						'u_strength',
						'u_saturation'
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
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, this.bloom.texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			
			const p = this.program;
			p.program.use();
			gl.uniform1i(p.uniforms['u_input'], 0);
			gl.uniform1i(p.uniforms['u_bloom'], 1);
			
			const params = this.parent.params;
			gl.uniform1f(p.uniforms['u_strength'], params.amount * this.gain);
			gl.uniform1f(p.uniforms['u_saturation'], params.saturation);
			
			gl.uniform2f(p.uniforms['u_texCoordOffset'],
				0.5 / this.input.width,
				0.5 / this.input.height);
				
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