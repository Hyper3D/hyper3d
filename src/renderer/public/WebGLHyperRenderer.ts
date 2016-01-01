/// <reference path="../Prefix.d.ts" />

import * as three from "three";
import { RendererCore } from "../core/RendererCore";

import { REVISION } from "./Version";

export interface WebGLHyperRendererLogParameters
{
    core: boolean;
    shader: boolean;

    [topic: string]: boolean;
}

export interface WebGLHyperRendererCreationParameters
{
    canvas?: HTMLCanvasElement;
    useFullResolutionGBuffer?: boolean;
    useFPBuffer?: boolean;
    log?: WebGLHyperRendererLogParameters | boolean;
}

export interface WebGLHyperRendererParameters
{
    bloomAmount: number;
    bloomSaturation: number;
    bloomTexture: three.Texture;
    motionBlurAmount: number;
    vignette: number;
    autoExposureEnabled: boolean;
    exposureBias: number;
    color: three.Vector3;
    highlightCrush: number;
    contrast: number;
}

export class WebGLHyperRenderer implements three.Renderer
{
    private canvas: HTMLCanvasElement;

    private gl: WebGLRenderingContext;

    private core: RendererCore;

    rendererInfo: string;
    rendererName: string;
    rendererVersion: string;

    constructor(params?: WebGLHyperRendererCreationParameters)
    {
        this.rendererName = "Hyper.WebGLHyperRenderer";
        this.rendererVersion = REVISION;
        this.rendererInfo = `${this.rendererName} ${this.rendererVersion}`;

        console.log(this.rendererInfo);

        params = params || {};

        this.canvas = params.canvas ? params.canvas : document.createElement("canvas");

        const glAttrs = {
            alpha: false,
            depth: false,
            stencil: false,
            antialias: false,
            preserveDrawingBuffer: false
        };

        this.gl = <WebGLRenderingContext> (
            this.canvas.getContext("webgl", glAttrs) ||
            this.canvas.getContext("experimental-webgl", glAttrs));

        if (!this.gl) {
            throw new Error("could not create WebGL context.");
        }

        this.canvas.addEventListener("webglcontextlost", () => {
            this.setup();
        });
        this.canvas.addEventListener("webglcontextrestored", () => {

        });

        this.core = new RendererCore(this.gl, params);
    }

    private setup(): void
    {

    }

    render(scene: three.Scene, camera: three.Camera): void
    {
        this.core.render(scene, camera);
    }
    setSize(width: number, height: number, updateStyle?: boolean): void
    {
        this.canvas.width = width;
        this.canvas.height = height;

        this.core.setSize(width, height);
    }
    get domElement(): HTMLCanvasElement
    {
        return this.canvas;
    }
    get parameters(): WebGLHyperRendererParameters
    {
        return this.core.parameters;
    }
}
