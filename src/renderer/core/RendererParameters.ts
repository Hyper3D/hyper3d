/// <reference path="../Prefix.d.ts" />

import * as three from "three";
import {
    WebGLHyperRendererParameters,
    WebGLHyperRendererVolumetricsMode
} from "../public/WebGLHyperRenderer";
import { RendererCore } from "./RendererCore";

export class RendererCoreParameters implements WebGLHyperRendererParameters
{
    constructor(private core: RendererCore)
    {
    }

    get bloomAmount(): number
    {
        return this.core.bloom.params.amount;
    }
    set bloomAmount(value: number)
    {
        this.core.bloom.params.amount = value;
    }

    get bloomSaturation(): number
    {
        return this.core.bloom.params.saturation;
    }
    set bloomSaturation(value: number)
    {
        this.core.bloom.params.saturation = value;
    }

    get bloomTexture(): three.Texture
    {
        return this.core.bloom.params.texture;
    }
    set bloomTexture(value: three.Texture)
    {
        this.core.bloom.params.texture = value;
    }

    get motionBlurAmount(): number
    {
        return this.core.motionBlur.amount;
    }
    set motionBlurAmount(value: number)
    {
        this.core.motionBlur.amount = value;
    }

    get exposureBias(): number
    {
        return this.core.toneMapFilter.params.exposureBias;
    }
    set exposureBias(value: number)
    {
        this.core.toneMapFilter.params.exposureBias = value;
    }

    get vignette(): number
    {
        return this.core.toneMapFilter.params.vignette;
    }
    set vignette(value: number)
    {
        this.core.toneMapFilter.params.vignette = value;
    }

    get autoExposureEnabled(): boolean
    {
        return this.core.toneMapFilter.params.autoExposureEnabled;
    }
    set autoExposureEnabled(value: boolean)
    {
        this.core.toneMapFilter.params.autoExposureEnabled = value;
    }

    get color(): three.Vector3
    {
        return this.core.toneMapFilter.params.color;
    }

    get highlightCrush(): number
    {
        return this.core.toneMapFilter.params.highlightCrush;
    }
    set highlightCrush(value: number)
    {
        this.core.toneMapFilter.params.highlightCrush = value;
    }

    get contrast(): number
    {
        return this.core.toneMapFilter.params.contrast;
    }
    set contrast(value: number)
    {
        this.core.toneMapFilter.params.contrast = value;
    }

    get volumetricsMode(): WebGLHyperRendererVolumetricsMode
    {
        return this.core.volumetricsMode;
    }

    set volumetricsMode(value: WebGLHyperRendererVolumetricsMode)
    {
        this.core.volumetricsMode = value;
        // TODO: force pipeline recompilation
    }
}
