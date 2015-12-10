/// <reference path="../Prefix.d.ts" />

import * as three from 'three';

import {
	GLProgram,
	GLProgramUniforms,
	GLProgramUniformSetters,
	GLProgramAttributes
} from '../core/GLProgram';
import { GLShader } from '../core/GLShader';
import { RendererCore } from '../core/RendererCore';
import { ulog2 } from '../utils/Utils';
import { pack32FToU8 } from '../utils/Pack';

export const enum SkinningMode
{
	None = 0,
	Uniform = 1,
	Texture = 2,
	FloatTexture = 3
}

export class SkinningShader
{
	private uniforms: GLProgramUniforms;
	
	numTextureStagesNeeded: number; // do not modify!
	textureStageIndex: number; // must be set by user (if numTextureStagesNeeded > 0)
	
	constructor(
		private core: RendererCore,
		private program: GLProgram,
		private needsLastPosition: boolean,
		private mode: SkinningMode)
	{
		this.uniforms = program.getUniforms([
			'u_skinTexture',
			'u_lastSkinTexture',
			'u_skinTexSize',
			'u_skinInvTexSize',
			'u_skinInvTexSize2',
			
			'u_skinBindMatrix',
			'u_skinInvBindMatrix'
		]);
		
		this.numTextureStagesNeeded = 0;
		this.textureStageIndex = -1;
		
		switch (mode) {
			case SkinningMode.Texture:
			case SkinningMode.FloatTexture:
				this.numTextureStagesNeeded++;
				if (needsLastPosition) {
					this.numTextureStagesNeeded++;
				}
		}
	}
	
	createInstance(mesh: three.SkinnedMesh)
	{
		return new SkinningShaderInstance(this.core, this.uniforms, mesh,
			this.needsLastPosition, this.mode, this);
	}
}

export class SkinningShaderInstance
{
	
	texture: BaseBoneMatrixTexture;
	lastTexture: BaseBoneMatrixTexture;
	
	firstTime: boolean;
	
	constructor(
		private core: RendererCore,
		private uniforms: GLProgramUniforms,
		private mesh: three.SkinnedMesh,
		private needsLastPosition: boolean,
		private mode: SkinningMode,
		private parent: SkinningShader)
	{
		
		this.texture = null;
		this.lastTexture = null;
		
		const numBones = mesh.skeleton.bones.length;
		
		this.lastTexture = null;
		
		switch (mode) {
			case SkinningMode.Texture:
				this.texture = new BoneMatrixTexture(core, numBones);
				if (needsLastPosition) {
					this.lastTexture = new BoneMatrixTexture(core, numBones);
				}
				break;
			case SkinningMode.FloatTexture:
				this.texture = new BoneMatrixFloatTexture(core, numBones);
				if (needsLastPosition) {
					this.lastTexture = new BoneMatrixFloatTexture(core, numBones);
				}
				break;
		}
		
		this.firstTime = true;
	}
	
	update(): void
	{
		const gl = this.core.gl;
		const sh = this.parent;
		
		gl.uniformMatrix4fv(this.uniforms['u_skinBindMatrix'], false,
			this.mesh.bindMatrix.elements);
		gl.uniformMatrix4fv(this.uniforms['u_skinInvBindMatrix'], false,
			this.mesh.bindMatrixInverse.elements);
		
		gl.activeTexture(gl.TEXTURE0 + sh.textureStageIndex);
		
		this.texture.update(this.mesh);
		
		// TODO: support uniform mode?
		
		gl.bindTexture(gl.TEXTURE_2D, this.texture.texture);
		
		gl.uniform1i(this.uniforms['u_skinTexture'], sh.textureStageIndex);
		
		if (this.needsLastPosition) {
			gl.activeTexture(gl.TEXTURE0 + sh.textureStageIndex + 1);
			gl.bindTexture(gl.TEXTURE_2D, this.lastTexture.texture);
			
			gl.uniform1i(this.uniforms['u_lastSkinTexture'], sh.textureStageIndex + 1);
		} else {
			gl.uniform1i(this.uniforms['u_lastSkinTexture'], sh.textureStageIndex);
		}
		
		gl.uniform2f(this.uniforms['u_skinTexSize'], 
			this.texture.texCols, this.texture.texRows);
		gl.uniform2f(this.uniforms['u_skinInvTexSize'], 
			1 / this.texture.texCols, 1 / this.texture.texRows);
		gl.uniform4f(this.uniforms['u_skinInvTexSize2'], 
			1 / this.texture.texWidth, 1 / this.texture.texHeight,
			0.5 / this.texture.texWidth, 0.5 / this.texture.texHeight);
			
		if (this.needsLastPosition) {
			const t = this.lastTexture;
			this.lastTexture = this.texture;
			this.texture = t;
		}
	}
}	

class BaseBoneMatrixTexture
{
	texture: WebGLTexture;
	
	texCols: number;
	texRows: number;
	texWidth: number;
	texHeight: number;
	
	dispose(): void
	{
	}
	
	constructor(public core: RendererCore, numBones: number)
	{
		// decide layout of texture
		if (numBones == 0) {
			this.texCols = 1;
			this.texRows = 1;
		} else {
			// smallest POT texture
			const bits = ulog2(numBones - 1);
			const sep = bits >> 1;
			this.texCols = 1 << sep;
			this.texRows = 1 << (bits - sep);
		}
		
		this.texture = null;
	}
	
	update(mesh: three.SkinnedMesh): void
	{
		throw new Error("not implemented");
	}
}

class BoneMatrixTexture extends BaseBoneMatrixTexture
{
	buffer: Uint8Array;
	
	constructor(core: RendererCore, numBones: number)
	{
		super(core, numBones);
		
		this.texWidth = this.texCols * 4;
		this.texHeight = this.texRows * 4;
		
		this.buffer = new Uint8Array(this.texWidth * this.texHeight * 4);
		
		const gl = core.gl;
		this.texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.texWidth, this.texHeight, 0,
			gl.RGBA, gl.UNSIGNED_BYTE, null);
	}
	
	dispose(): void
	{
		const gl = this.core.gl;
		gl.deleteTexture(this.texture);
		
		BaseBoneMatrixTexture.prototype.dispose.call(this);
	}
	
	update(mesh: three.SkinnedMesh): void
	{
		if (!mesh.skeleton) {
			return;
		}
		
		const mats = mesh.skeleton.boneMatrices;
		let x = 0, idx = 0;
		const w = this.texWidth;
		
		const buffer = this.buffer;
		
		for (let i = 0; i < mats.length; i += 16)
		{
			let idx2 = idx + (x << 2);
			for (let iy = 0; iy < 4; ++iy) {
				for (let ix = 0; ix < 4; ++ix) {
					pack32FToU8(buffer, idx2 + (ix << 2), mats[i + iy + (ix << 2)]);
				}
				idx2 += w << 2;
			}
			
			x += 4;
			if (x == w) {
				x = 0;
				idx += w << 4;
			}
		}
		
		const gl = this.core.gl;
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.texWidth, this.texHeight,
			gl.RGBA, gl.UNSIGNED_BYTE, buffer);
	}
}

class BoneMatrixFloatTexture extends BaseBoneMatrixTexture
{
	buffer: Uint8Array;
	
	constructor(core: RendererCore, numBones: number)
	{
		super(core, numBones);
		
		this.texWidth = this.texCols * 2;
		this.texHeight = this.texRows * 2;
		
		this.buffer = new Float32Array(this.texWidth * this.texHeight * 4);
		
		// OES_texture_float should be already enabled
		
		const gl = core.gl;
		this.texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.texWidth, this.texHeight, 0,
			gl.RGBA, gl.FLOAT, null);
	}
	
	dispose(): void
	{
		const gl = this.core.gl;
		gl.deleteTexture(this.texture);
		
		BaseBoneMatrixTexture.prototype.dispose.call(this);
	}
	
	update(mesh: three.SkinnedMesh): void
	{
		if (!mesh.skeleton) {
			return;
		}
		
		const mats = mesh.skeleton.boneMatrices;
		let x = 0, idx = 0;
		const w = this.texWidth;
		
		const buffer = this.buffer;
		
		for (let i = 0; i < mats.length; i += 16)
		{
			let idx2 = idx + (x << 2);
			let i2 = i;
			for (let iy = 0; iy < 2; ++iy) {
				buffer[idx2]     = mats[i2];
				buffer[idx2 + 1] = mats[i2 + 1];
				buffer[idx2 + 2] = mats[i2 + 2];
				buffer[idx2 + 3] = mats[i2 + 3];
				buffer[idx2 + 4] = mats[i2 + 4];
				buffer[idx2 + 5] = mats[i2 + 5];
				buffer[idx2 + 6] = mats[i2 + 6];
				buffer[idx2 + 7] = mats[i2 + 7];
				idx2 += w << 2; i2 += 8;
			}
			
			x += 2;
			if (x == w) {
				x = 0;
				idx += w << 3;
			}
		}
		
		const gl = this.core.gl;
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.texWidth, this.texHeight,
			gl.RGBA, gl.FLOAT, buffer);
	}
}
