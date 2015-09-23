declare module Hyper 
{
	export interface WebGLHyperRendererParameters
	{
		canvas?: HTMLCanvasElement;
		useFullResolutionGBuffer?: boolean;
	}
	
	export class ReflectionProbe extends THREE.Object3D
	{
		distance: number;
		decayDistance: number;
		priority: number;
		
		texture: THREE.CubeTexture;
		
		constructor();
	}
	
	export class WebGLHyperRenderer implements THREE.Renderer
	{
		constructor(params?: WebGLHyperRendererParameters);
		
        render(scene: THREE.Scene, camera: THREE.Camera): void;
        setSize(width:number, height:number, updateStyle?:boolean): void;
        domElement: HTMLCanvasElement;
	}
}