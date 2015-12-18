/// <reference path="../Prefix.d.ts" />

import {
	RendererCore,
	GLStateFlags 
} from '../core/RendererCore';
import { GLFramebuffer } from '../core/GLFramebuffer';

export function validateHalfFloatColorBuffer(core: RendererCore): boolean
{
	const program = core.shaderManager.get('VS_Passthrough', 'FS_Constant', [
		'a_position'
	]);
	const attrs = program.getAttributes(['a_position']);
	const unifs = program.getUniforms(['u_constantColor']);
	const quad = core.quadRenderer;
	const gl = core.gl;
	const halfFloat = core.ext.get('OES_texture_half_float');
	
	if (halfFloat == null) {
		console.warn("validateHalfFloatColorBuffer: OES_texture_half_float is not available.");
		return false;
	}
	
	program.use();
	
	const tex = gl.createTexture();
	
	try {
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 7, 7, 0,
			gl.RGBA, halfFloat.HALF_FLOAT_OES, null);
		if (gl.getError()) {
			console.warn("validateHalfFloatColorBuffer: could not create half float texture.");
			return false;
		}
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		
		const fb = GLFramebuffer.createFramebuffer(gl, {
			colors: [tex]
		});
		try {
			fb.bind();
			core.state.flags = GLStateFlags.BlendEnabled;
			
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.blendFunc(gl.ONE, gl.ONE);
			gl.viewport(0, 0, 7, 7);
			
			const buf = new Float32Array(7 * 7 * 4);
			for (let i = 1; i <= 8; ++i) {
				const inValue = 0.2;
				const outValueExpected = 0.2 * i;
				gl.uniform4f(unifs['u_constantColor'], inValue, inValue, inValue, 1);
				quad.render(attrs['a_position']);
				
				gl.readPixels(0, 0, 7, 7, gl.RGBA, gl.FLOAT, buf);
				
				for (let j = 0; j < buf.length; ++j) {
					const expect = (j & 3) == 3 ? i : outValueExpected;
					if (Math.abs(buf[j] - expect) > 0.05) {
						console.warn(`validateHalfFloatColorBuffer: expected ${expect}, got ${buf[j]} at ${j}`);
						return false;
					}
				}
			}
		} finally {
			fb.dispose();
		}
	} catch (e) {
		console.warn(`validateHalfFloatColorBuffer: error: ${e}`);
		return false;
	} finally {
		gl.deleteTexture(tex);
	}
	
	return true;
}
