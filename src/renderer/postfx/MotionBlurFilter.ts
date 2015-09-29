/// <reference path="../Prefix.d.ts" />
/// <reference path="../core/RenderBuffers.ts" />
/// <reference path="../core/RendererCore.ts" />
/// <reference path="../core/GLFramebuffer.ts" />
/// <reference path="../utils/Geometry.ts" />
module Hyper.Renderer
{
	export interface MotionBlurInput
	{
		color: TextureRenderBufferInfo; // LogRGB
		linearDepth: TextureRenderBufferInfo;
		g0: TextureRenderBufferInfo;
		g1: TextureRenderBufferInfo;
	}
	
	export interface MotionBlurFilterParameters
	{
		maxBlur: number;
	}
	
	export class MotionBlurFilterRenderer
	{
		constructor(public renderer: RendererCore)
		{
		}
		
		dispose(): void
		{
		}
		
		setupFilter(input: MotionBlurInput, params: MotionBlurFilterParameters, ops: RenderOperation[]): TextureRenderBufferInfo
		{
			const width = input.color.width;
			const height = input.color.height;
			
			const outp = new TextureRenderBufferInfo("Motion Blur Result", width, height,
					input.color.format);
					
			const tilesW = Math.ceil(input.color.width / params.maxBlur);
			const tilesH = Math.ceil(input.color.height / params.maxBlur);
			
			const tileMax = new TextureRenderBufferInfo("TileMax Velocity Map", tilesW, tilesH,
					TextureRenderBufferFormat.R8G8);
					
			const velocityMapT = new TextureRenderBufferInfo("NeighboxMax Velocity Map 1", tilesW, tilesH,
					TextureRenderBufferFormat.R8G8);
			const velocityMap = new TextureRenderBufferInfo("NeighboxMax Velocity Map 2", tilesW, tilesH,
					TextureRenderBufferFormat.R8G8);
					
			ops.push({
				inputs: {
					g0: input.g0,
					g1: input.g1
				},
				outputs: {
					output: tileMax
				},
				bindings: [],
				optionalOutputs: [],
				name: `Motion Blur: TileMax`,
				factory: (cfg) => new MotionBlurTileMaxRenderer(this,
					<TextureRenderBuffer> cfg.inputs['g0'],
					<TextureRenderBuffer> cfg.inputs['g1'],
					<TextureRenderBuffer> cfg.outputs['output'],
					params.maxBlur)
			});
			
			ops.push({
				inputs: {
					input: tileMax
				},
				outputs: {
					output: velocityMapT
				},
				bindings: [],
				optionalOutputs: [],
				name: `Motion Blur: NeighborMax`,
				factory: (cfg) => new MotionBlurNeighborMaxRenderer(this,
					<TextureRenderBuffer> cfg.inputs['input'],
					<TextureRenderBuffer> cfg.outputs['output'])
			});
					
			// we will use this velocity map with linear interpolation, so
			// we need to do this again
			ops.push({
				inputs: {
					input: velocityMapT
				},
				outputs: {
					output: velocityMap
				},
				bindings: [],
				optionalOutputs: [],
				name: `Motion Blur: NeighborMax`,
				factory: (cfg) => new MotionBlurNeighborMaxRenderer(this,
					<TextureRenderBuffer> cfg.inputs['input'],
					<TextureRenderBuffer> cfg.outputs['output'])
			});
					
			ops.push({
				inputs: {
					g0: input.g0,
					g1: input.g1,
					neighborVel: velocityMap,
					color: input.color,
					linearDepth: input.linearDepth
				},
				outputs: {
					output: outp
				},
				bindings: [],
				optionalOutputs: [],
				name: `Motion Blur: Final Pass`,
				factory: (cfg) => new MotionBlurFinalPassRenderer(this,
					<TextureRenderBuffer> cfg.inputs['color'],
					<TextureRenderBuffer> cfg.inputs['g0'],
					<TextureRenderBuffer> cfg.inputs['g1'],
					<TextureRenderBuffer> cfg.inputs['neighborVel'],
					<TextureRenderBuffer> cfg.inputs['linearDepth'],
					<TextureRenderBuffer> cfg.outputs['output'],
					params.maxBlur)
			});
			
			return outp;
		}
	}
	
	class MotionBlurTileMaxRenderer implements RenderOperator
	{
		private fb: GLFramebuffer;
		
		private program: {
			program: GLProgram;
			uniforms: GLProgramUniforms;
			attributes: GLProgramAttributes;		
		};
		
		constructor(
			private parent: MotionBlurFilterRenderer,
			private inG0: TextureRenderBuffer,
			private inG1: TextureRenderBuffer,
			private out: TextureRenderBuffer,
			private maxVelocity: number
		)
		{
			
			const scale = inG0.width / out.width;
			
			this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
				depth: null,
				colors: [
					out.texture
				]
			});
			
			const gl = this.parent.renderer.gl;
			
			{
				const program = parent.renderer.shaderManager.get('VS_MotionBlurDownsample', 'FS_MotionBlurDownsample',
					['a_position'], {
						scale: Math.ceil(scale)
					});
				const p = this.program = {
					program,
					uniforms: program.getUniforms([
						'u_g0', 'u_g1',
						'u_texCoordIncr',
						'u_texCoordOffset',
						'u_velocityScale'
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
			gl.bindTexture(gl.TEXTURE_2D, this.inG0.texture);
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, this.inG1.texture);
			
			const p = this.program;
			p.program.use();
			
			gl.uniform1i(p.uniforms['u_g0'], 0);
			gl.uniform1i(p.uniforms['u_g1'], 1);
			gl.uniform2f(p.uniforms['u_velocityScale'],
				this.inG0.width / this.maxVelocity * 0.25,
				this.inG0.height / this.maxVelocity * 0.25);
			gl.uniform2f(p.uniforms['u_texCoordIncr'],
				1 / this.inG0.width,
				1 / this.inG0.height);
			gl.uniform2f(p.uniforms['u_texCoordOffset'],
				this.out.width / this.inG0.width * -0.5,
				this.out.height / this.inG0.height * -0.5);
			
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
	class MotionBlurNeighborMaxRenderer implements RenderOperator
	{
		private fb: GLFramebuffer;
		
		private program: {
			program: GLProgram;
			uniforms: GLProgramUniforms;
			attributes: GLProgramAttributes;		
		};
		
		constructor(
			private parent: MotionBlurFilterRenderer,
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
			
			const gl = this.parent.renderer.gl;
			
			{
				const program = parent.renderer.shaderManager.get('VS_MotionBlurNeighborMax', 'FS_MotionBlurNeighborMax',
					['a_position']);
				const p = this.program = {
					program,
					uniforms: program.getUniforms([
						'u_input',
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
			this.parent.renderer.state.flags = 
				GLStateFlags.DepthWriteDisabled;
			
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.input.texture);
			
			const p = this.program;
			p.program.use();
			
			gl.uniform1i(p.uniforms['u_input'], 0);
			gl.uniform2f(p.uniforms['u_texCoordOffset'],
				1 / this.input.width,
				1 / this.input.height);
			
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
	class MotionBlurFinalPassRenderer implements RenderOperator
	{
		private fb: GLFramebuffer;
		
		private program: {
			program: GLProgram;
			uniforms: GLProgramUniforms;
			attributes: GLProgramAttributes;		
		};
		
		constructor(
			private parent: MotionBlurFilterRenderer,
			private inColor: TextureRenderBuffer,
			private inG0: TextureRenderBuffer,
			private inG1: TextureRenderBuffer,
			private inVelTile: TextureRenderBuffer,
			private inLinearDepth: TextureRenderBuffer,
			private out: TextureRenderBuffer,
			private maxVelocity: number
		)
		{
			
			const scale = inG0.width / out.width;
			
			this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
				depth: null,
				colors: [
					out.texture
				]
			});
			
			const gl = this.parent.renderer.gl;
			
			{
				const program = parent.renderer.shaderManager.get('VS_MotionBlur', 'FS_MotionBlur',
					['a_position'], {
						numSamples: 8
					});
				const p = this.program = {
					program,
					uniforms: program.getUniforms([
						'u_g0', 'u_g1',
						'u_velTile', 'u_color',
						'u_linearDepth',
						'u_velocityScale',
						'u_velocityInvScale',
						'u_minimumVelocity',
						
						'u_jitter',
						'u_jitterScale'
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
			
			const jitter = this.parent.renderer.uniformJitter;
			
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.inG0.texture);
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, this.inG1.texture);
			gl.activeTexture(gl.TEXTURE2);
			gl.bindTexture(gl.TEXTURE_2D, this.inVelTile.texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.activeTexture(gl.TEXTURE3);
			gl.bindTexture(gl.TEXTURE_2D, this.inColor.texture);
			gl.activeTexture(gl.TEXTURE4);
			gl.bindTexture(gl.TEXTURE_2D, this.inLinearDepth.texture);
			gl.activeTexture(gl.TEXTURE5);
			gl.bindTexture(gl.TEXTURE_2D, jitter.texture);
			
			const p = this.program;
			p.program.use();
			
			gl.uniform1i(p.uniforms['u_g0'], 0);
			gl.uniform1i(p.uniforms['u_g1'], 1);
			gl.uniform1i(p.uniforms['u_velTile'], 2);
			gl.uniform1i(p.uniforms['u_color'], 3);
			gl.uniform1i(p.uniforms['u_linearDepth'], 4);
			gl.uniform1i(p.uniforms['u_jitter'], 5);
			gl.uniform2f(p.uniforms['u_velocityScale'],
				this.inG0.width / this.maxVelocity * 0.25,
				this.inG0.height / this.maxVelocity * 0.25);
			gl.uniform2f(p.uniforms['u_velocityInvScale'],
				this.maxVelocity / this.inG0.width * 2,
				this.maxVelocity / this.inG0.height * 2);
			gl.uniform1f(p.uniforms['u_minimumVelocity'], Math.pow(0.5 / this.maxVelocity, 2));
			gl.uniform2f(p.uniforms['u_jitterScale'],
				this.inG0.width / jitter.size,
				this.inG0.height / jitter.size);
			
			const quad = this.parent.renderer.quadRenderer;
			quad.render(p.attributes['a_position']);
			
			gl.activeTexture(gl.TEXTURE2);
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