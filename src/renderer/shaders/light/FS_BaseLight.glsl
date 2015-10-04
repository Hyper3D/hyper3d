// this shader is abstract; must be imported and main function must be provided

#pragma require HdrMosaic
#pragma require GBuffer
#pragma require ShadingModel
#pragma require DepthFetch

#pragma parameter useHdrMosaic

uniform sampler2D u_g0;
uniform sampler2D u_g1;
uniform sampler2D u_g2;
uniform sampler2D u_g3;
uniform sampler2D u_linearDepth;

uniform vec3 u_lightColor;

varying highp vec2 v_texCoord;
varying mediump vec2 v_viewDir;

uniform sampler2D u_dither;
varying highp vec2 v_ditherCoord;

highp float perspectiveScaling = 1.;
highp vec3 viewDir;
highp vec3 viewDirNormalized;
highp vec3 viewPos;

void setupLight()
{
	viewDir = vec3(v_viewDir * perspectiveScaling, 1.);
	viewPos = viewDir * fetchDepth(u_linearDepth, v_texCoord * perspectiveScaling);
	viewPos = -viewPos; // FIXME: ??

	viewDirNormalized = normalize(viewDir);
}

void emitLightPassOutput(vec3 lit)
{
#if c_useHdrMosaic
	float lum = max(max(lit.x, lit.y), lit.z);

	// overflow protection
	const float lumLimit = HdrMosaicMaximumLevel * 0.7;
	if (lum > lumLimit) {
		lit *= lumLimit / lum;
	}

	// dither
	vec3 dither = texture2D(u_dither, v_ditherCoord * perspectiveScaling).xyz;

	gl_FragColor = encodeHdrMosaicDithered(lit, dither);
#else
	if (lit != lit) lit *= 0.; // reject denormals
	gl_FragColor = vec4(lit, 0.);
#endif
}
