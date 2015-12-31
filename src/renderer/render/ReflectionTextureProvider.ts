/// <reference path="../Prefix.d.ts" />

import * as three from "three";

import {
    BaseTextureManager,
    TextureManager,
    BaseTextureProvider
} from "./TextureManager";

import {
    TextureCube
} from "./TextureProvider";

import {
    ulog2
} from "../utils/Utils";

import {
    RendererCore,
    GLStateFlags
} from "../core/RendererCore";

/*
 * ReflectionTextureCubeProvider generates a texture cube map suitable for
 * soft reflection with GGX normal distribution function.
 * Conversion from roughness to MIP level is done with the following
 * equation:
 *
 *   MipLevel = log2(TexSize) - 19 + 18.1 * sqrt(sqrt(Roughness))
 *
 */

export class ReflectionTextureCubeProvider implements BaseTextureProvider<ReflectionTextureCube>
{
    constructor(private core: RendererCore)
    {
    }

    create(manager: TextureManager<ReflectionTextureCube>, tex: three.Texture): ReflectionTextureCube
    {
        if (tex instanceof three.CubeTexture) {
            return new ReflectionTextureCube(manager, this.core, tex);
        } else {
            throw new Error("Should be CubeTexture");
        }
    }
}

export class ReflectionTextureCube
{
    private textureCube: TextureCube;
    private setupDone: boolean;
    private textureHandle: WebGLTexture;

    log2Size: number;

    constructor(private manager: BaseTextureManager, private core: RendererCore, tex: three.Texture)
    {
        this.textureCube = core.textureCubes.get(tex);
        this.setupDone = false;

        this.textureHandle = manager.gl.createTexture();
        this.log2Size = 0;
    }

    setup(): boolean
    {
        if (this.setupDone) {
            return true;
        }
        if (!this.textureCube.setup()) {
            return false;
        }

        const pyramid = buildReflectionPyramid(this.core, this.textureCube.textureHandle,
            this.textureCube.size);

        const gl = this.manager.gl;
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.textureHandle);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        const numLevels = pyramid.length / 6;

        this.log2Size = numLevels - 1;

        for (let mip = 0; mip < numLevels; ++mip) {
            let size = 1 << (numLevels - mip - 1);
            for (let i = 0; i < 6; ++i) {
                gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, mip,
                    gl.RGBA, size, size, 0,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    pyramid[i + mip * 6]);
            }
        }

        this.setupDone = true;
        return true;
    }

    dispose(): void
    {
        this.manager.gl.deleteTexture(this.textureHandle);
        this.textureHandle = null;
    }

    bind(): void
    {
        const gl = this.manager.gl;
        if (!this.setup()) {
            // TODO: load dummy image
        }
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.textureHandle);
    }
}

const faces = [
    {   // +X
        x: 0, y: 1,
        dir: new three.Vector3(1, 0, 0),
        u: new three.Vector3(0, 0, -1),
        v: new three.Vector3(0, -1, 0)
    },
    {   // -X
        x: 1, y: 1,
        dir: new three.Vector3(-1, 0, 0),
        u: new three.Vector3(0, 0, 1),
        v: new three.Vector3(0, -1, 0)
    },
    {   // +Y
        x: 2, y: 1,
        dir: new three.Vector3(0, 1, 0),
        u: new three.Vector3(1, 0, 0),
        v: new three.Vector3(0, 0, 1)
    },
    {   // -Y
        x: 3, y: 1,
        dir: new three.Vector3(0, -1, 0),
        u: new three.Vector3(1, 0, 0),
        v: new three.Vector3(0, 0, -1)
    },
    {   // +Z
        x: 2, y: 0,
        dir: new three.Vector3(0, 0, 1),
        u: new three.Vector3(1, 0, 0),
        v: new three.Vector3(0, -1, 0)
    },
    {   // -Z
        x: 3, y: 0,
        dir: new three.Vector3(0, 0, -1),
        u: new three.Vector3(-1, 0, 0),
        v: new three.Vector3(0, -1, 0)
    }
];

function roughnessForMipLevel(texSizeLog: number, level: number): number
{
    const t = level + 19 - texSizeLog;
    const r = Math.max(Math.min(t / 18.1, 1), 0);
    return (r * r) * (r * r);
}

function buildReflectionPyramid(core: RendererCore, inTex: WebGLTexture, inSize: number): Uint8Array[]
{
    const program = core.shaderManager.get("VS_PrefilterCubemap", "FS_PrefilterCubemap",
        ["a_position"], {
            seamless: true
        });
    const uniforms = program.getUniforms([
        "u_axisMajor", "u_axisU", "u_axisV",
        "u_texture", "u_textureLod", "u_roughness",
        "u_sampleRange",
        "u_borderCoord", "u_axisIsMinor"
    ]);
    const attrs = program.getAttributes(["a_position"]);
    const gl = core.gl;

    // Create render target
    const outSize = Math.min(ulog2(inSize), 8);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4 << outSize, 2 << outSize, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D, tex, 0);
    core.state.flags = GLStateFlags.Default;

    program.use();

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, inTex);
    gl.uniform1i(uniforms["u_texture"], 0);

    // Render levels
    for (let i = 0; i <= outSize; ++i) {
        const curSize = 1 << (outSize - i);
        gl.uniform1f(uniforms["u_borderCoord"], 1 - 2 / curSize);
        gl.uniform1f(uniforms["u_sampleRange"],  Math.min(8 / curSize, Math.SQRT1_2));
        gl.uniform1f(uniforms["u_textureLod"], i);
        gl.uniform1f(uniforms["u_roughness"], roughnessForMipLevel(outSize, i));
        for (const face of faces) {
            gl.viewport(face.x * curSize, face.y * curSize, curSize, curSize);
            gl.uniform3i(uniforms["u_axisIsMinor"],
                face.dir.x == 0 ? 1 : 0,
                face.dir.y == 0 ? 1 : 0,
                face.dir.z == 0 ? 1 : 0);
            gl.uniform3f(uniforms["u_axisMajor"],
                face.dir.x, face.dir.y, face.dir.z);
            gl.uniform3f(uniforms["u_axisU"],
                face.u.x, face.u.y, face.u.z);
            gl.uniform3f(uniforms["u_axisV"],
                face.v.x, face.v.y, face.v.z);
            core.quadRenderer.render(attrs["a_position"]);
        }
    }

    // Read to buffer (do this only once to reduce overhead)
    const buf = new ArrayBuffer(32 << (outSize * 2));
    const u8 = new Uint8Array(buf);
    const u32 = new Uint32Array(buf);
    gl.readPixels(0, 0, 4 << outSize, 2 << outSize, gl.RGBA, gl.UNSIGNED_BYTE, u8);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    gl.deleteTexture(tex);

    // Split the result
    const ret: Uint32Array[] = [];
    const stride = 4 << outSize;
    for (let i = 0; i <= outSize; ++i) {
        const curSize = 1 << (outSize - i);
        for (const face of faces) {
            const out = new ArrayBuffer(curSize * curSize * 4);
            const out32 = new Uint32Array(out);
            let index = face.x * curSize + face.y * curSize * stride;
            if (i == outSize) {
                // make the final level completely even
                // because seam elimination doesn't work
                index = 2;
            }
            let outIndex = 0;
            for (let y = 0; y < curSize; ++y) {
                for (let x = 0; x < curSize; ++x) {
                    out32[outIndex++] = u32[index++];
                }
                index += stride - curSize;
            }
            ret.push(new Uint8Array(out));
        }
    }

    return ret;
}