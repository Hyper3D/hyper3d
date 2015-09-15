declare module Hyper 
{
	export interface WebGLHyperRendererParameters
	{
		canvas?: HTMLCanvasElement;
		useFullResolutionGBuffer?: boolean;
	}
	
	export class WebGLHyperRenderer implements THREE.Renderer
	{
		constructor(params?: WebGLHyperRendererParameters);
		
        render(scene: THREE.Scene, camera: THREE.Camera): void;
        setSize(width:number, height:number, updateStyle?:boolean): void;
        domElement: HTMLCanvasElement;
	}
}