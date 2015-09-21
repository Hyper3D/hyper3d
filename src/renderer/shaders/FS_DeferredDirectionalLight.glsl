#pragma parameter hasShadowMap

#pragma require GBuffer
#pragma require ShadingModel
#pragma require HdrMosaic
#pragma require DepthFetch

uniform sampler2D u_g0;
uniform sampler2D u_g1;
uniform sampler2D u_g2;
uniform sampler2D u_g3;
uniform sampler2D u_linearDepth;

uniform vec3 u_lightDir;
uniform vec3 u_lightColor;

varying highp vec2 v_texCoord;
varying mediump vec2 v_viewDir;

#if c_hasShadowMap
uniform sampler2D u_shadowMap;
uniform mat4 u_shadowMapMatrix;

uniform sampler2D u_jitter;
uniform vec2 u_jitterAmount;
varying highp vec4 v_jitterCoord;
#endif

#if c_hasShadowMap
float shadowTexture2D(sampler2D tex, highp vec3 coord)
{
	highp float value = texture2D(tex, coord.xy).r;
	return step(coord.z, value);
}
#endif

void main()
{
	highp vec3 viewDir = vec3(v_viewDir, 1.);

#if c_hasShadowMap
	highp vec3 viewPos = viewDir * fetchDepth(u_linearDepth, v_texCoord);
	viewPos = -viewPos; // FIXME: ??
	highp vec3 shadowCoord = (u_shadowMapMatrix * vec4(viewPos, 1.)).xyz; // w is always 1 for orthographic camera
	shadowCoord.z -= 0.002;
	
	float shadowValue = 0.;
	vec4 jitter1 = texture2D(u_jitter, v_jitterCoord.xy) - 0.5;
	vec4 jitter2 = texture2D(u_jitter, v_jitterCoord.zw) - 0.5;

	jitter1 *= u_jitterAmount.xyxy;
	jitter2 *= u_jitterAmount.xyxy;

	shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter1.xy, 0.));
	shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter1.zw, 0.));
	shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter2.xy, 0.));
	shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter2.zw, 0.));

	if (shadowValue < 0.0001) {
		discard;
	}

	shadowValue *= 1. / 4.;

#endif

	vec4 g0 = texture2D(u_g0, v_texCoord);
	vec4 g1 = texture2D(u_g1, v_texCoord);
	vec4 g2 = texture2D(u_g2, v_texCoord);
	vec4 g3 = texture2D(u_g3, v_texCoord);

	if (isGBufferEmpty(g0, g1, g2, g3)) {
		discard;
	}

	GBufferContents g;
	decodeGBuffer(g, g0, g1, g2, g3);

	MaterialInfo mat = getMaterialInfoFromGBuffer(g);

	PointLightBRDFParameters params = computePointLightBRDFParameters(
		g.normal, u_lightDir, normalize(viewDir));

	vec3 lit = evaluatePointLight(params, mat, u_lightColor);

#if c_hasShadowMap
	lit *= shadowValue;
#endif

	vec4 mosaicked = encodeHdrMosaic(lit);
	gl_FragColor = mosaicked;
	gl_FragColor.xyz = lit.xyz; // DEBUG
}
