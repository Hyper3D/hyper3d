/// <reference path="Prefix.d.ts" />
/// <reference path="RendererCore.ts" />
/// <reference path="Utils.ts" />
/// <reference path="GLFramebuffer.ts" />
/// <reference path="../WebGLHyperRenderer.ts" />
module Hyper.Renderer
{
	export function validateSRGBCompliance(core: RendererCore): boolean
	{
		const program = core.shaderManager.get('VS_Passthrough', 'FS_Constant', [
			'a_position'
		]);
		const attrs = program.getAttributes(['a_position']);
		const unifs = program.getUniforms(['u_constantColor']);
		const quad = core.quadRenderer;
		const gl = core.gl;
		const srgb = core.ext.get('EXT_sRGB');
		
		program.use();
		
		const tex = gl.createTexture();
		
		try {
			gl.bindTexture(gl.TEXTURE_2D, tex);
			gl.texImage2D(gl.TEXTURE_2D, 0, srgb.SRGB_ALPHA_EXT, 8, 8, 0,
				srgb.SRGB_ALPHA_EXT, gl.UNSIGNED_BYTE, null);
			if (gl.getError()) {
				console.warn("validateSRGBCompliance: could not create sRGB texture.");
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
				core.state.flags = GLStateFlags.Default;
				
				const testPatterns: number[][] = [
					[0, 0], [13, 63], [54, 127], [133, 191], [255, 255]	
				];
				
				const buf = new Uint8Array(8 * 8 * 4);
				for (const pat of testPatterns) {
					const inValue = pat[0] / 255;
					const outValueExpected = pat[1];
					gl.uniform4f(unifs['u_constantColor'], inValue, inValue, inValue, 1);
					quad.render(attrs['a_position']);
					
					gl.readPixels(0, 0, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, buf);
					
					for (let i = 0; i < buf.length; ++i) {
						const expect = (i & 3) == 3 ? 255 : outValueExpected;
						if (Math.abs(buf[i] - expect) > 1) {
							console.warn(`validateSRGBCompliance: expected ${expect}, got ${buf[i]}`);
							return false;
						}
					}
				}
			} finally {
				fb.dispose();
			}
		} catch (e) {
			console.warn(`validateSRGBCompliance: error: ${e}`);
			return false;
		} finally {
			gl.deleteTexture(tex);
		}
		
		return true;
	}
}