/// <reference path="../Prefix.d.ts" />

import * as three from 'three';
import { RendererCore } from '../core/RendererCore';

export const REVISION = '0.0.1';

export interface WebGLHyperRendererLogParameters
{
    core: boolean;
    shader: boolean;
    
    [topic: string]: boolean;
}

export interface WebGLHyperRendererParameters
{
	canvas?: HTMLCanvasElement;
	useFullResolutionGBuffer?: boolean;
	useFPBuffer?: boolean;
    log?: WebGLHyperRendererLogParameters | boolean;
}

export class WebGLHyperRenderer implements three.Renderer
{
	private canvas: HTMLCanvasElement;
	
	private gl: WebGLRenderingContext;
	
	private core: RendererCore;
	
	constructor(params?: WebGLHyperRendererParameters)
	{
		console.log("Hyper.WebGLHyperRenderer", REVISION);
		
		params = params || {};
		
		this.canvas = params.canvas ? params.canvas : document.createElement('canvas');
		
		const glAttrs = {
			alpha: false,
			depth: false,
			stencil: false,
			antialias: false,
			preserveDrawingBuffer: false	
		};
		
		this.gl = <WebGLRenderingContext> (
			this.canvas.getContext('webgl', glAttrs) ||
			this.canvas.getContext('experimental-webgl', glAttrs));
			
		if (!this.gl) {
			throw new Error("could not create WebGL context.");
		}
		
		this.canvas.addEventListener('webglcontextlost', () => {
			this.setup();
		});
		this.canvas.addEventListener('webglcontextrestored', () => {
			
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
	setSize(width:number, height:number, updateStyle?:boolean): void
	{
		this.canvas.width = width;
		this.canvas.height = height;
		
		this.core.setSize(width, height);
	}
	get domElement(): HTMLCanvasElement
	{
		return this.canvas;
	}
}
