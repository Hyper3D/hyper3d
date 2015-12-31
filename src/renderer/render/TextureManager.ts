/// <reference path="../Prefix.d.ts" />

import * as three from "three";

import { IdWeakMapWithDisposable } from "../utils/IdWeakMap";
import { RendererCore } from "../core/RendererCore";
import { IDisposable } from "../utils/Utils";

export interface BaseTextureProvider<T extends IDisposable>
{
    create(manager: TextureManager<T>, tex: three.Texture): T;
}

export interface BaseTextureManager
{
    gl: WebGLRenderingContext;
    internalFormatForTexture(threeTex: three.Texture): number;
    formatForTexture(threeTex: three.Texture): number;
    typeForTexture(threeTex: three.Texture): number;
}

export class TextureManager<T extends IDisposable> implements BaseTextureManager
{
    gl: WebGLRenderingContext;
    private map: IdWeakMapWithDisposable<three.Texture, IDisposable>;

    constructor(private core: RendererCore, private provider: BaseTextureProvider<T>)
    {
        this.gl = core.gl;
        this.map = new IdWeakMapWithDisposable<three.Texture, IDisposable>();
    }

    dispose(): void
    {
        this.map.dispose();
    }

    get(tex: three.Texture): T
    {
        if (tex == null) {
            return null;
        }

        let t = <T> this.map.get(tex);
        if (t == null) {
            t = this.provider.create(this, tex);
            this.map.set(tex, t);
        }
        return t;
    }

    flush(tex: three.Texture): void
    {
        this.map.remove(tex);
    }

    internalFormatForTexture(threeTex: three.Texture): number
    {
        switch (threeTex.format) {
            case three.RGBAFormat:
                return this.gl.RGBA;
            default:
                throw new Error(`unsupported format: ${threeTex.format}`);
        }
    }
    formatForTexture(threeTex: three.Texture): number
    {
        switch (threeTex.format) {
            case three.RGBAFormat:
                return this.gl.RGBA;
            default:
                throw new Error(`unsupported format: ${threeTex.format}`);
        }
    }
    typeForTexture(threeTex: three.Texture): number
    {
        switch (threeTex.type) {
            case three.UnsignedByteType:
                return this.gl.UNSIGNED_BYTE;
            default:
                throw new Error(`unsupported type: ${threeTex.type}`);
        }
    }
}
