/// <reference path="../Prefix.d.ts" />
/// <reference path="../utils/Utils.ts" />
/// <reference path="RendererCore.ts" />
/// <reference path="GLShader.ts" />
module Hyper.Renderer
{
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
	
	interface GlobalUniformMapping
	{
		index: WebGLUniformLocation;
		unif: GlobalUniform;
	}
	
	export class GLProgram implements Utils.IDisposable
	{
		private gl: WebGLRenderingContext;
		private linked: boolean;
		
		constructor(private core: RendererCore, public program: WebGLProgram)
		{
			this.attrLocs = {};
			this.nextAttrLoc = 0;
			this.gl = core.gl;
			this.lastGlobalUniformStructureVersion = null;
			this.lastGlobalUniformVersion = null;
			this.globalUniforms = null;
			this.linked = false;
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
			this.updateGlobalUniforms();
		}
		
		private link(): void
		{
			if (this.linked) {
				throw new Error();
			}
			const gl = this.gl;
			gl.linkProgram(this.program);
				
			const log = gl.getProgramInfoLog(this.program);
			if (log.length > 0) {
				console.log("program link log:");
				console.log(log);
			}
			if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
				throw new Error("program compilation failed.");
			}
			
			this.linked = true;
		}
		
		private lastGlobalUniformVersion: any;
		private lastGlobalUniformStructureVersion: any;
		private globalUniforms: GlobalUniformMapping[];
		private updateGlobalUniforms(): void
		{
			const sm = this.core.shaderManager;
			if (sm.globalUniformVersion === this.lastGlobalUniformVersion) {
				return;
			}
			this.lastGlobalUniformVersion = sm.globalUniformVersion;
			
			if (sm.globalUniformStructureVersion != this.lastGlobalUniformStructureVersion) {
				this.lastGlobalUniformStructureVersion = sm.globalUniformStructureVersion;
				const locs = this.getUniforms(sm.globalUniforms.map((u) => 'u_' + u.name));
				const mapping: GlobalUniformMapping[] = [];
				for (const unif of sm.globalUniforms) {
					let loc = locs['u_' + unif.name];
					if (loc != null) {
						mapping.push({
							index: loc,
							unif: unif
						});
					}
				}	
				this.globalUniforms = mapping;
			}
			
			const gl = this.gl;
			for (const mapping of this.globalUniforms) {
				const value = mapping.unif.value;
				
				if (value instanceof Array) {
					switch (value.length) {
						case 1:
							gl.uniform1f(mapping.index, value[0]);
							break;
						case 2:
							gl.uniform2f(mapping.index, value[0], value[1]);
							break;
						case 3:
							gl.uniform3f(mapping.index, value[0], value[1], value[2]);
							break;
						case 4:
							gl.uniform4f(mapping.index, value[0], value[1], value[2], value[3]);
							break;
						default:
							throw new Error();
					}
				} else {
					// FIXME: check number
					gl.uniform1f(mapping.index, value);
				}
			}
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
}
