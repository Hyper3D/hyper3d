/// <reference path="../Prefix.d.ts" />

import { ShaderChunk } from "./GLShader";

export interface ShaderChunkMap
{
    [name: string]: ShaderChunk;
}

export { shaderChunks } from "../shaders/ShaderChunk";
