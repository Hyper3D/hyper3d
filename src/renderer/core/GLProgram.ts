/// <reference path="../Prefix.d.ts" />

import { IDisposable } from '../utils/Utils';
import { shaderChunks } from './shaders';
import { RendererCore } from '../core/RendererCore';
import { GlobalShaderUniformSubscriber } from './ShaderManager';
import { GLShader } from './GLShader';
import { Logger } from '../utils/Logger';

export interface GLProgramAttributes
{
	[name: string]: number;
}
export interface GLProgramUniforms
{
	[name: string]: WebGLUniformLocation;
}
export interface GLProgramUniformSetters
{
	[name: string]: Function;
}

export class GLProgram implements IDisposable
{
    private logger: Logger;
	private gl: WebGLRenderingContext;
	private linked: boolean;
	
	private globalUniformSubscriber: GlobalShaderUniformSubscriber;
	
	constructor(private core: RendererCore, public program: WebGLProgram)
	{
        this.logger = core.log.getLogger('shader');
        
		this.attrLocs = {};
		this.nextAttrLoc = 0;
		this.gl = core.gl;
		this.linked = false;
		this.globalUniformSubscriber = core.shaderManager.subscribeGlobalUniforms(this);
	}
	
	dispose(): void
	{
		this.gl.deleteProgram(this.program);
	}
	
	use(): void
	{
		if (!this.linked)
			this.link();
		this.gl.useProgram(this.program);
		this.globalUniformSubscriber.updateGlobalUniforms();
	}
	
	private link(): void
	{
		if (this.linked) {
			throw new Error();
		}
		const gl = this.gl;
		gl.linkProgram(this.program);
			
        if (this.logger.isEnabled) {
            const log = gl.getProgramInfoLog(this.program);
            if (log.length > 0) {
                this.logger.log(`Program link log was generated:\n${log}`);
            }
        }
		if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
			throw new Error("program compilation failed.");
		}
		
		this.linked = true;
	}
	
	// leaving attribute 0 unused has "significant performance penalty", so
	// we reassign the attribute location
	private attrLocs: any;
	private nextAttrLoc: number;
	
	private initializeAttributes(names: string[]): void
	{
		if (this.linked) {
			throw new Error("already linked");
		}
		for (const name of names) {
			let loc: number = this.attrLocs[name];
			if (loc == null) {
				loc = this.nextAttrLoc;
				this.gl.bindAttribLocation(this.program, loc, name);
				this.attrLocs[name] = loc;
				this.nextAttrLoc = loc + 1;
			}
		}
	}
	getAttributes(names: string[]): GLProgramAttributes
	{
		const ret: GLProgramAttributes = {};
		for (const name of names) {
			ret[name] = this.attrLocs[name];
		}
		return ret;
	}
	getUniforms(names: string[]): GLProgramUniforms
	{
		if (!this.linked) {
			throw new Error("not linked");
		}
		
		const ret: GLProgramUniforms = {};
		for (const name of names) {
			ret[name] = this.gl.getUniformLocation(this.program, name);
		}
		return ret;
	}
	createUniformSetter(setters: GLProgramUniformSetters): GLProgramUniformSetters
	{
		const ret: any = {};
		const gl = this.gl;
		for (const name in setters) {
			const loc = this.gl.getUniformLocation(this.program, name);
			if (loc) {
				ret[name] = eval(`(function(gl, fn, loc) {
					return function (a1, a2, a3, a4) {
						fn.call(gl, loc, a1, a2, a3, a4);
					};
				})`)(gl, setters[name], loc);
			} else {
				ret[name] = () => {};
			}
		}
		return ret;
	}
	
	static link(renderer: RendererCore, shaders: GLShader[], attributes: string[]): GLProgram
	{
		const gl = renderer.gl;
		let program = new GLProgram(renderer, gl.createProgram());
		try {
			
			for (const shader of shaders)
				gl.attachShader(program.program, shader.shader);
			
			const ret = program;
			ret.initializeAttributes(attributes);
			ret.link();
			program = null;
			return ret;
		} finally {
			if (program != null) {
				program.dispose();
			}
		}
	}
}
