#pragma require DepthFetch
#pragma require ScreenSpaceRaytrace
#pragma require Globals
#pragma require GBuffer
#pragma require LogRGB
#pragma require HdrMosaic
#pragma require ShadingModel

#pragma parameter useHdrMosaic
#pragma parameter colorIsLogRGB

uniform sampler2D u_g0;
uniform sampler2D u_g1;
uniform sampler2D u_g2;
uniform sampler2D u_linearDepth;
uniform sampler2D u_color; // LogRGB
uniform sampler2D u_reflections; // HdrMosaic
uniform sampler2D u_jitter;

varying highp vec2 v_texCoord;
varying mediump vec2 v_viewDir;
varying highp vec2 v_jitterCoord;

uniform highp vec2 u_viewDirCoefX;
uniform highp vec2 u_viewDirCoefY;

uniform highp mat4 u_projectionMatrix;

uniform mediump float u_stride;

// DDA based ray caster
// see http://casual-effects.blogspot.jp/2014/08/screen-space-ray-tracing.html

GBufferContents g;

vec3 decodeInputColor(vec4 color)
{
#if c_colorIsLogRGB
	return decodeLogRGB(color);
#else
	return color.xyz;
#endif
}

vec3 doSSR(out float confidence)
{
	highp float baseDepth = fetchDepth(u_linearDepth, v_texCoord);
	highp vec3 baseViewDir = vec3(v_viewDir, 1.);
	highp vec3 baseViewPos = baseViewDir * baseDepth;
	vec3 baseNormal = g.normal;

	vec3 reflectionVec = normalize(reflect(baseViewDir, baseNormal));

	float jitter = texture2D(u_jitter, v_jitterCoord).x;

	vec3 hitPoint;
	vec2 hitPixel;
	float hitSteps;

	if (rayTraceScreenSpace(
		u_linearDepth,
		baseViewPos,
		reflectionVec,
		u_projectionMatrix,
		u_globalRenderSize,
		u_globalInvRenderSize,
		u_stride,
		0.5 + jitter,
		64.,
		hitPixel,
		hitPoint,
		hitSteps
		)) {

		hitPixel.xy *= u_globalInvRenderSize;

		vec3 color = decodeInputColor(texture2D(u_color, hitPixel.xy));
		
		// distance fade
		hitSteps = clamp(0., 1., 2. - hitSteps * 2.); hitSteps *= hitSteps;
		float fade = hitSteps;

		// screen border fade
		float dfb = min(hitPixel.x, 1. - hitPixel.x);
		dfb = min(dfb, min(hitPixel.y, 1. - hitPixel.y));
		dfb = clamp(0., 1., dfb * 10.);
		fade *= dfb;

		confidence = fade;

		return color.xyz;
	} else {
		confidence = 0.;
		return vec3(0.);
	}
}

void main()
{
	vec4 g0 = texture2D(u_g0, v_texCoord);
	vec4 g1 = texture2D(u_g1, v_texCoord);
	vec4 g2 = texture2D(u_g2, v_texCoord);
	vec4 g3 = vec4(0.); // unused

	if (isGBufferEmpty(g0, g1, g2, g3)) {
		discard;
		return;
	}

	decodeGBuffer(g, g0, g1, g2, g3);

	gl_FragColor = texture2D(u_reflections, v_texCoord);

	// TODO: adjust SSR confidence value
	float nvDot = clamp(0., 1., dot(g.normal, normalize(vec3(v_viewDir, 1.))));
	float fresnel = 1. - nvDot;
	MaterialInfo mat = getMaterialInfoFromGBuffer(g);
	float roughness = mat.roughness;
	if (isMaterialClearCoat(mat)) {
		roughness = min(roughness, mat.clearCoatRoughness);
	}
	roughness *= roughness;
	float ssrAmount = min(1., 1.5 - roughness * 8.);
	if (ssrAmount > 0.) {
		vec4 reflAmt = evaluateReflection(nvDot, mat);
		reflAmt += evaluateReflectionForClearCoat(nvDot, mat);
		if (reflAmt.w > 0.00001) { 
			ssrAmount = 1.;

			float ssrConfidence;
			vec3 ssr = doSSR(ssrConfidence);
			ssr *= reflAmt.xyz * (1. / M_PI);

			ssrConfidence *= ssrAmount;

#if c_useHdrMosaic
			vec4 encoded = encodeHdrMosaic(ssr);
			gl_FragColor.xyz = mix(gl_FragColor.xyz, encoded.xyz, ssrConfidence);
			gl_FragColor.w = max(gl_FragColor.w, encoded.w);
#else
			gl_FragColor.xyz = mix(gl_FragColor.xyz, ssr, ssrConfidence);
			gl_FragColor.w = 1.;
#endif
		}
	}

}