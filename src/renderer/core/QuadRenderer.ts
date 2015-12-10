/// <reference path="../Prefix.d.ts" />

import { RendererCore } from './RendererCore';

export class QuadRenderer
{
	private buffer: WebGLBuffer;
	
	constructor(private renderer: RendererCore)
	{
		const gl = renderer.gl;
		this.buffer = gl.createBuffer();
		
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
		const vertices = new Uint8Array([
			-1, -1, 1, -1, -1, 1, 1, 1
		]);
		gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
	}
	
	dispose(): void
	{
		const gl = this.renderer.gl;
		gl.deleteBuffer(this.buffer);
	}
	
	render(attr: number)
	{
		const gl = this.renderer.gl;
		this.renderer.vertexAttribs.toggleAllWithTrueIndex(attr);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
		gl.vertexAttribPointer(attr, 2, gl.BYTE, false, 2, 0);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}
}
