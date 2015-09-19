/// <reference path="Prefix.d.ts" />
/// <reference path="Utils.ts" />
/// <reference path="RendererCore.ts" />
/// <reference path="Shaders.ts" />
module Hyper.Renderer
{
	export interface ShaderChunk
	{
		requires?: string[];
		parameters?: string[];
		attributes?: string[];
		source?: string;
	}
	
	export class GLShader implements Utils.IDisposable
	{
		constructor(private gl: WebGLRenderingContext, public shader: WebGLShader)
		{
		}
		
		dispose(): void
		{
			this.gl.deleteShader(this.shader);
		}
		
		static getAllAttributesReferencedByChunk(chunks: ShaderChunk[]): string[]
		{
			const attrs: string[] = [];
			const found: any = {};
			const included: any = {};
			
			function scan(chunk: ShaderChunk): void
			{
				if (chunk.requires) {
					for (const dep of chunk.requires) {
						if (!included[dep]) {
							included[dep] = true;
							if (!shaderChunks[dep]) {
								throw new Error(`shader chunk ${dep} not found.`);
							}
							scan(shaderChunks[dep]);
						}
					}
				}
				if (chunk.attributes) {
					for (const name of chunk.attributes) {
						if (!found[name]) {
							found[name] = true;
							attrs.push(name);
						}
					}
				}
			}
			
			chunks.forEach(scan);
			
			return attrs;
		}
		
		static preprocess(renderer: RendererCore, chunks: ShaderChunk[], parameters: any, type: number): string
		{
			const parts: string[] = [];
			const included: any = {};
			const foundParams: any = {};
			
			parameters = parameters || {};
			
			function scan(chunk: ShaderChunk, name?: string): void
			{
				if (chunk.requires) {
					for (const dep of chunk.requires) {
						if (!included[dep]) {
							included[dep] = true;
							if (!shaderChunks[dep]) {
								throw new Error(`shader chunk ${dep} not found.`);
							}
							scan(shaderChunks[dep], dep);
						}
					}
				}
				if (chunk.parameters) {
					for (const name of chunk.parameters) {
						foundParams[name] = null;
					}
				}
				if (name) {
					parts.push(`/* ---- ${name} ---- */`);
				}
				parts.push(chunk.source);
			}
			
			const gl = renderer.gl;
			switch (type) {
				case gl.VERTEX_SHADER:
					parts.push("");
					break;
				case gl.FRAGMENT_SHADER:
					parts.push("precision mediump float;");
					break;
				default:
					throw new Error();
			}
			
			chunks.forEach((chunk) => scan(chunk));
			
			const globalParams: any = renderer.shaderManager.globalParameters;
			
			for (const name in foundParams) {
				let value = parameters[name];
				if (value == null) {
					value = globalParams[name];
				}
				if (value == null) {
					throw new Error(`value for parameter ${name} is missing`);
				}
				
				let valStr: string = null;
				if (value === true) {
					parts.unshift(`#define c_${name} 1`);
				} else if (value === false) {
					parts.unshift(`#define c_${name} 0`);
				} else if (typeof value === 'number') {
					parts.unshift(`#define c_${name} ${value}`);
				} else {
					throw new Error("bad parameter type");
				}
			}
			
			
			return parts.join('\n');
		}
		
		static compile(renderer: RendererCore, type: number, source: string): GLShader
		{
			const gl = renderer.gl;
			let shader = new GLShader(gl, gl.createShader(type));
			try {
				
				gl.shaderSource(shader.shader, source);
				gl.compileShader(shader.shader);
				
				const log = gl.getShaderInfoLog(shader.shader);
				if (log.length > 0) {
					console.log("for shader:");
					console.log(source);
					console.log("shader compile log:");
					console.log(log);
				}
				if (!gl.getShaderParameter(shader.shader, gl.COMPILE_STATUS)) {
					throw new Error("shader compilation failed.");
				}
				
				const ret = shader;
				shader = null;
				return ret;
			} finally {
				if (shader != null) {
					shader.dispose();
				}
			}
		}
	}
}
