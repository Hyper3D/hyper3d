/// <reference path="../Prefix.d.ts" />

import { IDisposable } from "../utils/Utils";
import { shaderChunks } from "./shaders";
import { RendererCore } from "../core/RendererCore";

export interface ShaderChunk
{
    requires?: string[];
    parameters?: string[];
    attributes?: string[];
    source?: string;
}

export class GLShader implements IDisposable
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

        let highpRequired = false;

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
            if (chunk.source.indexOf("// --- precision highp ---") >= 0) {
                highpRequired = true;
            }
        }

        const gl = renderer.gl;

        chunks.forEach((chunk) => scan(chunk));

        switch (type) {
            case gl.VERTEX_SHADER:
                break;
            case gl.FRAGMENT_SHADER:
                parts.unshift(`precision ${highpRequired ? "highp" : "mediump"} float;`);
                break;
            default:
                throw new Error();
        }

        const globalParams: any = renderer.shaderManager.globalParameters;

        for (const name in foundParams) {
            let value = parameters[name];
            if (value == null) {
                value = globalParams[name];
            }
            if (value == null) {
                throw new Error(`value for parameter ${name} is missing`);
            }

            if (value === true) {
                parts.unshift(`#define c_${name} 1`);
            } else if (value === false) {
                parts.unshift(`#define c_${name} 0`);
            } else if (typeof value === "number") {
                parts.unshift(`#define c_${name} ${value}`);
            } else {
                throw new Error("bad parameter type");
            }
        }

        return parts.join("\n");
    }

    static compile(renderer: RendererCore, type: number, source: string): GLShader
    {
        const gl = renderer.gl;
        const logger = renderer.log.getLogger("shader");
        let shader = new GLShader(gl, gl.createShader(type));
        try {

            gl.shaderSource(shader.shader, source);
            gl.compileShader(shader.shader);

            if (logger.isEnabled) {
                const log = gl.getShaderInfoLog(shader.shader);
                if (log.length > 0) {
                    logger.log(`Shader compilation log generated for the following shader:\n${source}\n` +
                        `Following is the log message:\n${log}`);
                }
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
