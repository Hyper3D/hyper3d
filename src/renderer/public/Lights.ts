/// <reference path="../Prefix.d.ts" />

// public specialized lights

import * as three from "three";

export class PointLight extends three.PointLight
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

export class DirectionalLight extends three.DirectionalLight
{
    shadowCascadeCount: number;
    shadowCamera: three.Camera[];

    constructor(hex?: number | string, intensity?: number)
    {
        super(hex, intensity);

        this.shadowCascadeCount = 0;
        this.shadowCamera = null;
    }
}