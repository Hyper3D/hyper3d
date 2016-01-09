/// <reference path="../Prefix.d.ts" />

import { RendererCore } from "./RendererCore";

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

export class QuadsRenderer
{
    private buffer: WebGLBuffer;
    private indexBuffer: WebGLBuffer;

    constructor(private renderer: RendererCore, private maxCount: number)
    {
        const gl = renderer.gl;
        this.buffer = gl.createBuffer();
        this.indexBuffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        const vertices = new Int16Array(4 * maxCount * 3);
        for (let i = 0, k = 0; i < maxCount; ++i) {
            vertices[k     ] = -1;
            vertices[k +  1] = -1;
            vertices[k +  2] = i;
            vertices[k +  3] = 1;
            vertices[k +  4] = -1;
            vertices[k +  5] = i;
            vertices[k +  6] = -1;
            vertices[k +  7] = 1;
            vertices[k +  8] = i;
            vertices[k +  9] = 1;
            vertices[k + 10] = 1;
            vertices[k + 11] = i;
            k += 12;
        }
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        const indices = new Uint16Array(6 * maxCount);
        for (let i = 0, k = 0, j = 0; i < maxCount; ++i) {
            indices[j    ] = k;
            indices[j + 1] = k + 1;
            indices[j + 2] = k + 2;
            indices[j + 3] = k + 2;
            indices[j + 4] = k + 1;
            indices[j + 5] = k + 3;
            k += 4; j += 6;
        }
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    }

    dispose(): void
    {
        const gl = this.renderer.gl;
        gl.deleteBuffer(this.buffer);
        gl.deleteBuffer(this.indexBuffer);
    }

    render(offset: number, numQuads: number, attr: number)
    {
        if (offset + numQuads > this.maxCount) {
            throw new Error("Too many quads.");
        }
        const gl = this.renderer.gl;
        this.renderer.vertexAttribs.toggleAllWithTrueIndex(attr);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.vertexAttribPointer(attr, 3, gl.SHORT, false, 6, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.drawElements(gl.TRIANGLES, numQuads * 6, gl.UNSIGNED_SHORT, 12 * offset);
    }
}