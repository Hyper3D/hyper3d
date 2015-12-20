/// <reference path="../Prefix.d.ts" />

// public material properties

import * as three from "three";

export enum MaterialShadingModel
{
    // deferred shaded models
    Unlit = 0,
    Opaque = 1,
    ClearCoat = 2,

    // forward pass only
    Transparent = 3
}

export enum MaterialParameterType
{
    Float = 0,
    Float2 = 1,
    Float3 = 2,
    Float4 = 3,
    Texture2D = 4,
    TextureCube = 5
}

export interface MaterialParameter
{
    type: MaterialParameterType;
    default?: any;
}

export interface MaterialParameters
{
    [name: string]: MaterialParameter;
}

/*
    in material shader codes, following output can be generated:

        * Disney principled BRDF-like parameters
        * m_albedo
        * m_roughness
        * m_metallic
        * m_specular
        * misc
        * m_normal
        * m_emissive

    */

export interface MaterialCreationParameters
{
    shadingModel: MaterialShadingModel;
    shader?: string; // FIXME: make this something like AST so that it can easily be editted
    parameters?: MaterialParameters;
    requiredVertexAttributes?: string[];
}

let matId = 0;
export class Material
{
    id: number;

    shader: string;
    shadingModel: MaterialShadingModel;
    parameters: MaterialParameters;
    requiredVertexAttributes: string[];

    constructor(params: MaterialCreationParameters)
    {
        this.id = matId++;

        this.shadingModel = params.shadingModel;
        this.parameters = params.parameters;
        this.requiredVertexAttributes = (params.requiredVertexAttributes || []).slice(0);
        this.shader = params.shader;
    }
}

export interface MaterialParameterAssignments
{
    [name: string]: any;
}

export class MaterialInstance extends three.Material
{
    parameters: MaterialParameterAssignments;

    constructor(public material: Material, assignments?: MaterialParameterAssignments)
    {
        super();
        this.parameters = {};
        for (const paramName in material.parameters) {
            this.parameters[paramName] = material.parameters[paramName].default;

            if (assignments && assignments[paramName] != null) {
                this.parameters[paramName] = assignments[paramName];
            }
        }
    }

}
