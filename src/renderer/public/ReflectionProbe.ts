/// <reference path="../Prefix.d.ts" />
/// <reference path="../version.ts" />

module Hyper
{
	export class ReflectionProbe extends THREE.Object3D
	{
		distance: number;
		decayDistance: number;
		priority: number;
		
		texture: THREE.CubeTexture;
		
		constructor()
		{
			super();
			
			this.distance = Infinity;
			this.decayDistance = 5;
		}
		
	}
}