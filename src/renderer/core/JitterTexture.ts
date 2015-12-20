/// <reference path="../Prefix.d.ts" />

export class JitterTexture
{
    texture: WebGLTexture;
    size: number;

    private textures: WebGLTexture[];
    private index: number;

    constructor(private gl: WebGLRenderingContext, generator: (x: number, y: number, ch: number, frame: number) => number)
    {
        this.size = 64;
        this.textures = [];
        this.index = 0;

        const buffer = new Uint8Array(this.size * this.size * 4);
        for (let i = 0; i < 32; ++i) {
            const texture = gl.createTexture();
            this.generate(buffer, i, generator);
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

    private generate(buffer: Uint8Array, frame: number, generator: (x: number, y: number, ch: number, frame: number) => number): void
    {
        const len = buffer.byteLength;

        for (let i = 0; i < len; i ++) {
            buffer[i] = generator((i >> 2) & 63, i >> 8, i & 3, frame);
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

const pat3 = [
    0, 48, 12, 60, 3, 51, 15, 63,
    32, 16, 44, 28, 35, 19, 47, 31,
    8, 56, 4, 52, 11, 59, 7, 55,
    40, 24, 36, 20, 43, 27, 39, 23,
    2, 50, 14, 62, 1, 49, 13, 61,
    34, 18, 46, 30, 33, 17, 45, 29,
    10, 58, 6, 54, 9, 57, 5, 53,
    42, 26, 38, 22, 41, 25, 37, 21
];

function temporalOrderedDither(frame: number): number
{
    let bias = frame & 1; frame >>= 1;
    bias = (bias << 1) | (frame & 1); frame >>= 1;
    bias = (bias << 1) | (frame & 1); frame >>= 1;
    bias = (bias << 1) | (frame & 1); frame >>= 1;
    bias = (bias << 1) | (frame & 1); frame >>= 1;
    bias <<= 3;
    return bias;
}

function orderedDither(x: number, y: number, type: number, frame: number): number
{
    let bias = temporalOrderedDither(frame);

    if (type & 1) x += 4;
    if (type & 2) y += 4;
    x &= 7; y &= 7;
    return (pat3[x | (y << 3)] << 2) + bias & 255;
}

export class DitherJitterTexture extends JitterTexture
{
    constructor(gl: WebGLRenderingContext)
    {
        super(gl, orderedDither);
    }
}

export class GaussianDitherJitterTexture extends JitterTexture
{
    constructor(gl: WebGLRenderingContext)
    {
        super(gl, (x, y, ch, frame) => {
            // approximate InverseErf[x]
            let v = (orderedDither(x, y, ch, frame) - 128) * (1 / 128);
            const v2 = v * v;
            const v4 = v2 * v2;
            const v8 = v4 * v4;
            const v9 = v8 * v;
            const mapped = 0.4736 * v + 0.5263 * v9;
            return mapped * 160 + 128;
        });
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
