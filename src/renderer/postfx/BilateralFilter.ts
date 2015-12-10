/// <reference path="../Prefix.d.ts" />

import {
	TextureRenderBufferInfo,
	TextureRenderBufferFormat,
	TextureRenderBuffer
} from '../core/RenderBuffers';

import {
	RenderOperator,
	RenderOperation
} from '../core/RenderPipeline';

import {
	RendererCore,
	GLStateFlags
} from '../core/RendererCore';

import {
	GLProgram,
	GLProgramUniforms,
	GLProgramUniformSetters,
	GLProgramAttributes
} from '../core/GLProgram';

import { GLShader } from '../core/GLShader';

import { GLFramebuffer } from '../core/GLFramebuffer';

export interface BilateralFilterInput
{
	input: TextureRenderBufferInfo;
	linearDepth: TextureRenderBufferInfo;
}
export interface BilateralFilterOutput
{
	output: TextureRenderBufferInfo;
}
export const enum BilateralFilterDirection
{
	Horitonzal,
	Vertical
}
export interface BilateralFilterParameters
{
	outWidth: number;
	outHeight: number;
	dir: BilateralFilterDirection;
	kernelScale: number;
}
export class BilateralFilterRenderer
{
	constructor(public renderer: RendererCore)
	{
	}
	
	dispose(): void
	{
	}
	
	setupFilter(input: BilateralFilterInput, params: BilateralFilterParameters, ops: RenderOperation[]): BilateralFilterOutput
	{
		const width = params.outWidth;
		const height = params.outHeight;
		const dir = params.dir;
		const outp: BilateralFilterOutput = {
			output: new TextureRenderBufferInfo( dir == BilateralFilterDirection.Horitonzal ? "H Bilateral Result" : "V Bilateral Result", width, height,
				TextureRenderBufferFormat.R8)
		};
		
		ops.push({
			inputs: {
				input: input.input,
				linearDepth: input.linearDepth
			},
			outputs: {
				output: outp.output
			},
			bindings: [],
			optionalOutputs: [],
			name: dir == BilateralFilterDirection.Horitonzal ? "H Bilateral Filter" : "V Bilateral Filter",
			factory: (cfg) => new BilateralFilterRendererInstance(this,
				<TextureRenderBuffer> cfg.inputs['input'],
				<TextureRenderBuffer> cfg.inputs['linearDepth'],
				<TextureRenderBuffer> cfg.outputs['output'],
				params)
		});
		return outp;
	}
}

export class BilateralFilterRendererInstance implements RenderOperator
{
	private fb: GLFramebuffer;
	
	private program: {
		program: GLProgram;
		uniforms: GLProgramUniforms;
		attributes: GLProgramAttributes;		
	};
	
	constructor(
		private parent: BilateralFilterRenderer,
		private input: TextureRenderBuffer,
		private inLinearDepth: TextureRenderBuffer,
		private out: TextureRenderBuffer,
		private params: BilateralFilterParameters
	)
	{
		
		this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
			depth: null,
			colors: [
				out.texture
			]
		});
		
		{
			const program = parent.renderer.shaderManager.get('VS_BilateralFilter', 'FS_BilateralFilter',
				['a_position']);
			this.program = {
				program,
				uniforms: program.getUniforms([
					'u_input', 'u_linearDepth',
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
		
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, this.inLinearDepth.texture);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.input.texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		
		const p = this.program;
		p.program.use();
		gl.uniform1i(p.uniforms['u_input'], 0);
		gl.uniform1i(p.uniforms['u_linearDepth'], 1);
		
		let offsX = this.params.kernelScale / this.out.width;
		let offsY = this.params.kernelScale / this.out.height;
		switch (this.params.dir) {
			case BilateralFilterDirection.Horitonzal: offsY = 0; break;
			case BilateralFilterDirection.Vertical: offsX = 0; break;
		}
		gl.uniform2f(p.uniforms['u_texCoordOffset'], offsX, offsY);
			
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