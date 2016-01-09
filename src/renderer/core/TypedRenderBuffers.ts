/// <reference path="../Prefix.d.ts" />

import * as three from "three";

import {
    TextureRenderBufferInfo,
    TextureRenderBufferFormat
} from "./RenderBuffers";

import {
    isPowerOfTwo,
    ulog2
} from "../utils/Utils";

export interface INearestResampleableRenderBufferInfo<T extends TextureRenderBufferInfo> extends TextureRenderBufferInfo
{
    cloneWithDimension(name: string, width: number, height: number): T;
}

export class LogRGBTextureRenderBufferInfo extends TextureRenderBufferInfo
    implements INearestResampleableRenderBufferInfo<LogRGBTextureRenderBufferInfo>
{
    get logicalFormatDescription(): string
    {
        return "LogRGB";
    }
    cloneWithDimension(name: string, width: number, height: number)
    {
        return new LogRGBTextureRenderBufferInfo(name, width, height, this.format);
    }
}

export class LinearRGBTextureRenderBufferInfo extends TextureRenderBufferInfo
    implements INearestResampleableRenderBufferInfo<LinearRGBTextureRenderBufferInfo>
{
    get logicalFormatDescription(): string
    {
        return "Linear RGB";
    }
    cloneWithDimension(name: string, width: number, height: number)
    {
        return new LinearRGBTextureRenderBufferInfo(name, width, height, this.format);
    }
}

export class VolumeTexture2DLayout
{
    numCols: number;
    numRows: number;
    textureWidth: number;
    textureHeight: number;

    constructor(
        public volumeWidth: number,
        public volumeHeight: number,
        public volumeDepth: number)
    {
        if (!isPowerOfTwo(volumeDepth)) {
            throw new Error("depth must be a power-of-two number.");
        }

        const depthLog = ulog2(volumeDepth);
        const colsLog = depthLog >> 1;
        this.numCols = 1 << colsLog;
        this.numRows = 1 << (depthLog - colsLog);

        this.textureWidth = volumeWidth * this.numCols;
        this.textureHeight = volumeHeight * this.numRows;
    }

    getSamplerParameters(old?: three.Vector4): three.Vector4
    {
        if (!old) {
            old = new three.Vector4();
        }
        old.x = 1 / this.numCols;
        old.y = 1 / this.numRows;
        old.z = this.volumeDepth;
        old.w = this.numCols;
        return old;
    }
}

/** Volume texture stored in a 2D texture. */
export class VolumeTexture2DRenderBufferInfo extends TextureRenderBufferInfo
{

    constructor(name: string,
        public layout: VolumeTexture2DLayout, format: TextureRenderBufferFormat)
    {
        super(name, layout.textureWidth, layout.textureHeight, format);
    }
}

export class LinearRGBVolumeTexture2DRenderBufferInfo extends VolumeTexture2DRenderBufferInfo
{
    get logicalFormatDescription(): string
    {
        return "Linear RGB";
    }
}

export class HdrMosaicTextureRenderBufferInfo extends TextureRenderBufferInfo
{
    get logicalFormatDescription(): string
    {
        return "HDR Mosaic";
    }
}

export class GBufferMosaicTextureRenderBufferInfo extends TextureRenderBufferInfo
{
    get logicalFormatDescription(): string
    {
        return "Mosaiced G-Buffer";
    }
}

export class DepthTextureRenderBufferInfo extends TextureRenderBufferInfo
    implements INearestResampleableRenderBufferInfo<DepthTextureRenderBufferInfo>
{
    get logicalFormatDescription(): string
    {
        return "Depth";
    }
    cloneWithDimension(name: string, width: number, height: number)
    {
        return new DepthTextureRenderBufferInfo(name, width, height, this.format);
    }
}

export class LinearDepthTextureRenderBufferInfo extends TextureRenderBufferInfo
    implements INearestResampleableRenderBufferInfo<LinearDepthTextureRenderBufferInfo>
{
    get logicalFormatDescription(): string
    {
        return "Linearized Depth";
    }
    cloneWithDimension(name: string, width: number, height: number)
    {
        return new LinearDepthTextureRenderBufferInfo(name, width, height, this.format);
    }
}

export class GBuffer0TextureRenderBufferInfo extends TextureRenderBufferInfo
    implements INearestResampleableRenderBufferInfo<GBuffer0TextureRenderBufferInfo>
{
    get logicalFormatDescription(): string
    {
        return "G0";
    }
    cloneWithDimension(name: string, width: number, height: number)
    {
        return new GBuffer0TextureRenderBufferInfo(name, width, height, this.format);
    }
}

export class GBuffer1TextureRenderBufferInfo extends TextureRenderBufferInfo
    implements INearestResampleableRenderBufferInfo<GBuffer1TextureRenderBufferInfo>
{
    get logicalFormatDescription(): string
    {
        return "G1";
    }
    cloneWithDimension(name: string, width: number, height: number)
    {
        return new GBuffer1TextureRenderBufferInfo(name, width, height, this.format);
    }
}

export class GBuffer2TextureRenderBufferInfo extends TextureRenderBufferInfo
    implements INearestResampleableRenderBufferInfo<GBuffer2TextureRenderBufferInfo>
{
    get logicalFormatDescription(): string
    {
        return "G2";
    }
    cloneWithDimension(name: string, width: number, height: number)
    {
        return new GBuffer2TextureRenderBufferInfo(name, width, height, this.format);
    }
}

export class GBuffer3TextureRenderBufferInfo extends TextureRenderBufferInfo
    implements INearestResampleableRenderBufferInfo<GBuffer3TextureRenderBufferInfo>
{
    get logicalFormatDescription(): string
    {
        return "G3";
    }
    cloneWithDimension(name: string, width: number, height: number)
    {
        return new GBuffer3TextureRenderBufferInfo(name, width, height, this.format);
    }
}
