/// <reference path="../Prefix.d.ts" />

import { RendererCore } from "../core/RendererCore";
import { GLFramebuffer } from "../core/GLFramebuffer";

export function validateHalfFloatColorBuffer(core: RendererCore): boolean
{
    const gl = core.gl;
    const halfFloat = core.ext.get("OES_texture_half_float");

    if (halfFloat == null) {
        console.warn("validateHalfFloatColorBuffer: OES_texture_half_float is not available.");
        return false;
    }

    const tex = gl.createTexture();

    try {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        while (gl.getError()); // clear error
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
        fb.dispose();
    } catch (e) {
        console.warn(`validateHalfFloatColorBuffer: error: ${e}`);
        return false;
    } finally {
        gl.deleteTexture(tex);
    }

    return true;
}
