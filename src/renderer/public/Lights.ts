/// <reference path="../Prefix.d.ts" />
/// <reference path="../version.ts" />

// public specialized lights
module Hyper
{
	export class PointLight extends THREE.PointLight
	{
		radius: number;
		length: number;
		shadowCameraNear: number;
		
		constructor(hex?: number, intensity?: number, distance?: number)
		{
			super(hex, intensity, distance);
			
			this.radius = 0;
			this.length = 0;
			this.shadowCameraNear = this.distance != 0 ? this.distance * 0.01 : 0.1;
		}
		
	}
}
