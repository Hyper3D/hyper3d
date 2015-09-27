/// <reference path="../Prefix.d.ts" />
/// <reference path="../utils/Utils.ts" />
/// <reference path="RendererCore.ts" />
/// <reference path="Shaders.ts" />
module Hyper.Renderer
{
	export interface GLFramebufferAttachments
	{
		depth?: WebGLTexture;
		colors: WebGLTexture[];
	}
	
	export class GLFramebuffer implements IDisposable
	{
		constructor(private gl: WebGLRenderingContext, public handle: WebGLFramebuffer)
		{
		}
		
		static createFramebuffer(gl: WebGLRenderingContext, attachments: GLFramebufferAttachments): GLFramebuffer
		{
			const handle = gl.createFramebuffer();
			gl.bindFramebuffer(gl.FRAMEBUFFER, handle);
			
			if (attachments.depth != null) {
				gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
					gl.TEXTURE_2D, attachments.depth, 0);
			}
			
			const colors = attachments.colors;
			for (let i = 0; i < colors.length; ++i) {
				gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i,
					gl.TEXTURE_2D, colors[i], 0);
			}
			
			const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
			
			if (status != gl.FRAMEBUFFER_COMPLETE) {
				throw new Error(`incomplete framebuffer: ${status}`);
			}
				
			return new GLFramebuffer(gl, handle);
		}
		
		bind(): void
		{
			this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.handle);
		}
		
		dispose(): void
		{
			this.gl.deleteFramebuffer(this.handle);
		}
		
	}
}