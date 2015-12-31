/// <reference path="../Prefix.d.ts" />

import * as three from "three";

import {
    BaseTextureManager,
    TextureManager,
    BaseTextureProvider
} from "./TextureManager";

export class Texture2DProvider implements BaseTextureProvider<Texture2D>
{
    create(manager: TextureManager<Texture2D>, tex: three.Texture): Texture2D
    {
        if (tex instanceof three.CubeTexture) {
            throw new Error("Shouldn't be CubeTexture");
        }
        return new Texture2D(manager, tex);
    }
}

export class TextureCubeProvider implements BaseTextureProvider<TextureCube>
{
    create(manager: TextureManager<TextureCube>, tex: three.Texture): TextureCube
    {
        if (tex instanceof three.CubeTexture) {
            return new TextureCube(manager, tex);
        } else {
            throw new Error("Should be CubeTexture");
        }
    }
}

export class Texture
{
    textureHandle: WebGLTexture;
    disposeHandler: () => void;

    constructor(public manager: BaseTextureManager,
        public source: three.Texture,
        public textureTarget: number)
    {
        this.textureHandle = manager.gl.createTexture();
    }

    setupCommon(): void
    {
        const gl = this.manager.gl;

        gl.texParameteri(this.textureTarget, gl.TEXTURE_MAG_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(this.textureTarget, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    }

    dispose(): void
    {
        this.manager.gl.deleteTexture(this.textureHandle);
        this.textureHandle = null;
    }

    bind(): void
    {
        throw new Error("not implemented");
    }
}

export class Texture2D extends Texture
{
    setupDone: boolean;

    constructor(manager: BaseTextureManager,
        source: three.Texture)
    {
        super(manager, source, manager.gl.TEXTURE_2D);

        this.setupDone = false;
    }

    setup(): boolean
    {
        if (this.setupDone) {
            return true;
        }

        // FIXME: compressed texture

        let image = this.source.image;
        if (image == null || image.width == 0) {
            // not loaded yet
            return false;
        }

        this.setupDone = true;

        // Setup texture object
        const gl = this.manager.gl;
        gl.bindTexture(this.textureTarget, this.textureHandle);
        this.setupCommon();
        gl.texParameteri(this.textureTarget, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(this.textureTarget, gl.TEXTURE_WRAP_T, gl.REPEAT);


        // Check size limitation
        const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        if (image.width > maxSize || image.height > maxSize) {
            // need to resize
            image = resizeImage(image, maxSize, maxSize);
        }

        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, this.source.flipY ? 1 : 0 );
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.source.premultiplyAlpha ? 1 : 0 );
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, this.source.unpackAlignment);

        gl.texImage2D(this.textureTarget, 0,
            this.manager.internalFormatForTexture(this.source),
            this.manager.formatForTexture(this.source),
            this.manager.typeForTexture(this.source),
            image);

        if (this.source.generateMipmaps) {
            gl.generateMipmap(this.textureTarget);
        }

        // restore default
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0 );
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);

        return true;
    }

    bind(): void
    {
        const gl = this.manager.gl;
        if (!this.setup()) {
            // TODO: load dummy image
        }
        gl.bindTexture(this.textureTarget, this.textureHandle);
    }
}

export class TextureCube extends Texture
{
    setupDone: boolean;

    constructor(manager: BaseTextureManager,
        source: three.CubeTexture)
    {
        super(manager, source, manager.gl.TEXTURE_CUBE_MAP);

        this.setupDone = false;
    }

    setup(): boolean
    {
        if (this.setupDone) {
            return true;
        }

        // FIXME: compressed texture

        const images = this.source.image;
        for (let i = 0; i < 6; ++i) {
            const image = images[i];
            if (image == null || image.width == 0) {
                // not loaded yet
                return false;
            }
        }

        this.setupDone = true;

        // Setup texture object
        const gl = this.manager.gl;
        gl.bindTexture(this.textureTarget, this.textureHandle);
        this.setupCommon();
        gl.texParameteri(this.textureTarget, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(this.textureTarget, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Check size limitation
        const maxSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
        if (images[0].width > maxSize || images[0].height > maxSize) {
            // need to resize
            for (let i = 0; i < 6; ++i) {
                images[i] = resizeImage(images[i], maxSize, maxSize);
            }
        }

        for (let i = 0; i < 6; ++i) {
            const image = images[i];
            gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0,
                this.manager.internalFormatForTexture(this.source),
                this.manager.formatForTexture(this.source),
                this.manager.typeForTexture(this.source),
                image);
        }

        if (this.source.generateMipmaps) {
            gl.generateMipmap(this.textureTarget);
        }

        return true;
    }

    bind(): void
    {
        const gl = this.manager.gl;
        if (!this.setup()) {
            // TODO: load dummy image
        }
        gl.bindTexture(this.textureTarget, this.textureHandle);
    }
}

function resizeImage(image: any, width: number, height: number): any
{
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, width, height);

    return canvas;
}
