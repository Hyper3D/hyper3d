/// <reference path="../Prefix.d.ts" />
/// <reference path="../utils/Utils.ts" />
/// <reference path="RendererCore.ts" />
module Hyper.Renderer
{
	
	export class JitterTexture
	{
		texture: WebGLTexture;
		size: number;
		
		private textures: WebGLTexture[];
		private index: number;
		
		constructor(private gl: WebGLRenderingContext, generator: () => number)
		{
			this.size = 64;
			this.textures = [];
			this.index = 0;
			
			const buffer = new Uint8Array(this.size * this.size * 4);
			for (let i = 0; i < 32; ++i) {
				const texture = gl.createTexture();
				this.generate(buffer, generator);
				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.size, this.size, 0,
					gl.RGBA, gl.UNSIGNED_BYTE, buffer);
				this.textures.push(texture);
			}
			
			this.texture = this.textures[0];
		}
		
		dispose(): void
		{
			const gl = this.gl;
			for (const tex of this.textures) {
				gl.deleteTexture(tex);
			}
		}
		
		private generate(buffer: Uint8Array, generator: () => number): void
		{
			const len = buffer.byteLength;
			
			for (let i = 0; i < len; i ++) {
				buffer[i] = generator();
			}
		}
		
		update(): void
		{
			this.texture = this.textures[this.index];
			this.index++;
			if (this.index == this.textures.length) {
				this.index = 0;
			}
		}
	}	
	export class UniformJitterTexture extends JitterTexture
	{
		constructor(gl: WebGLRenderingContext)
		{
			super(gl, () => {
				return Math.random() * 256;
			});
		}
	}
	
	export class GaussianJitterTexture extends JitterTexture
	{
		constructor(gl: WebGLRenderingContext)
		{
			super(gl, () => {
				let u1: number, u2: number;
				
				do {
					u1 = Math.random();
					u2 = Math.random();
				} while (u1 == 0);
				
				const value = Math.sqrt(-2 * Math.log(u1)) * Math.cos(Math.PI * 2 * u2);
				
				return (128 + value * 32);
			});
		}
	}
}
