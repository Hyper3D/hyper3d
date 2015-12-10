/// <reference path="../Prefix.d.ts" />

import {
	TextureRenderBufferInfo,
	TextureRenderBufferFormat,
	TextureRenderBuffer
} from '../core/RenderBuffers';

import {
	INearestResampleableRenderBufferInfo,
	LinearRGBTextureRenderBufferInfo
} from '../core/TypedRenderBuffers';

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

export const enum ResampleFilterType
{
	Nearest,
	Linear
}
export interface ResampleFilterParameters
{
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
	
	setupNearestResampler<T extends TextureRenderBufferInfo>
	(input: INearestResampleableRenderBufferInfo<T>, params: ResampleFilterParameters, ops: RenderOperation[]): T
	{
		const width = params.outWidth;
		const height = params.outHeight;
		const outp: T = 
			input.cloneWithDimension(input.name + " Resampled", width, height);
		
		ops.push({
			inputs: {
				input: input,
			},
			outputs: {
				output: outp
			},
			bindings: [],
			optionalOutputs: [],
			name: `Resample (Nearest)`,
			factory: (cfg) => new ResampleFilterRendererInstance(this,
				<TextureRenderBuffer> cfg.inputs['input'],
				<TextureRenderBuffer> cfg.outputs['output'],
				ResampleFilterType.Nearest)
		});
		return outp;
	}
	
	setupLinearResampler(input: LinearRGBTextureRenderBufferInfo, 
		params: ResampleFilterParameters, ops: RenderOperation[]): LinearRGBTextureRenderBufferInfo
	{
		const width = params.outWidth;
		const height = params.outHeight;
		const outp = new LinearRGBTextureRenderBufferInfo(input.name + " Resampled", width, height, input.format);
		
		ops.push({
			inputs: {
				input: input,
			},
			outputs: {
				output: outp
			},
			bindings: [],
			optionalOutputs: [],
			name: `Resample (Linear)`,
			factory: (cfg) => new ResampleFilterRendererInstance(this,
				<TextureRenderBuffer> cfg.inputs['input'],
				<TextureRenderBuffer> cfg.outputs['output'],
				ResampleFilterType.Linear)
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
		private type: ResampleFilterType
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
		if (this.type == ResampleFilterType.Linear) {
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
