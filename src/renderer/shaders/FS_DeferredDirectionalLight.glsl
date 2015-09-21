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
#endif

void main()
{
	highp vec3 viewDir = vec3(v_viewDir, 1.);

#if c_hasShadowMap
	highp vec3 viewPos = viewDir * fetchDepth(u_linearDepth, v_texCoord);
	viewPos = -viewPos; // FIXME: ??
	highp vec3 shadowCoord = (u_shadowMapMatrix * vec4(viewPos, 1.)).xyz; // w is always 1 for orthographic camera

	highp float shadowMapValue = texture2D(u_shadowMap, shadowCoord.xy).r;

	if (shadowMapValue + 0.001 < shadowCoord.z) {
		discard;
	}
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

	vec4 mosaicked = encodeHdrMosaic(lit);
	gl_FragColor = mosaicked;
	gl_FragColor.xyz = lit.xyz; // DEBUG
}
