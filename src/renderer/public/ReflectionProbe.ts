/// <reference path="../Prefix.d.ts" />

import * as three from "three";

export class ReflectionProbe extends three.Object3D
{
    distance: number;
    decayDistance: number;
    priority: number;

    texture: three.CubeTexture;

    constructor()
    {
        super();

        this.distance = Infinity;
        this.decayDistance = 5;
    }

}
