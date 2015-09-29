/// <reference path="../Prefix.d.ts" />
/// <reference path="../version.ts" />
/// <reference path="../core/RendererCore.ts" />
module Hyper 
{
	export interface WebGLHyperRendererParameters
	{
		canvas?: HTMLCanvasElement;
		useFullResolutionGBuffer?: boolean;
		useFPBuffer?: boolean;
	}
	
	export class WebGLHyperRenderer implements THREE.Renderer
	{
		private canvas: HTMLCanvasElement;
		
		private gl: WebGLRenderingContext;
		
		private core: Hyper.Renderer.RendererCore;
		
		constructor(params?: WebGLHyperRendererParameters)
		{
			console.log("Hyper.WebGLHyperRenderer", Hyper.REVISION);
			
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
			
			this.core = new Hyper.Renderer.RendererCore(this.gl, params);
		}
		
		private setup(): void
		{
			
		}
		
        render(scene: THREE.Scene, camera: THREE.Camera): void
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
}