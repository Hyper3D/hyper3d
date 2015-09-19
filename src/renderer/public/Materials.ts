/// <reference path="../Prefix.d.ts" />
/// <reference path="../version.ts" />

// public material properties
module Hyper
{
	export enum MaterialShadingModel
	{
		// deferred shaded models
		Opaque,
		ClearCoat,
		
		// forward pass only
		Transparent
	}
	
	export enum MaterialParameterType
	{
		Float,
		Float2,
		Float3,
		Float4,
		Texture2D
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
		    * m_radiosity
		 
	 */
	
	export interface MaterialCreationParameters
	{
		shadingModel: MaterialShadingModel;
		shader?: string; // FIXME: make this something like AST so that it can easily be editted
		parameters?: MaterialParameters;
		requiredVertexAttributes?: string[];
	}
	
	let matId: number = 0;
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
	
	export class MaterialInstance extends THREE.Material
	{
		parameters: MaterialParameterAssignments;
		
		constructor(public material: Material)
		{
			super();
			this.parameters = {};
			for (const paramName in material.parameters) {
				this.parameters[paramName] = material.parameters[paramName].default;
			}
		}
		
	}
}
