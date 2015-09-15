/// <reference path="Prefix.d.ts" />
/// <reference path="Utils.ts" />
/// <reference path="RendererCore.ts" />
module Hyper.Renderer
{
	interface ShaderChunkMap
	{
		[name: string]: ShaderChunk;
	}
	export let shaderChunks: ShaderChunkMap;
}
