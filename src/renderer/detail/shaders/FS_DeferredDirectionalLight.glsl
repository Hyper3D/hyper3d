#pragma require GBuffer
#pragma require ShadingModel
#pragma require HdrMosaic

uniform sampler2D u_g0;
uniform sampler2D u_g1;
uniform sampler2D u_g2;
uniform sampler2D u_g3;
uniform sampler2D u_linearDepth;

uniform vec3 u_lightDir;
uniform vec3 u_lightColor;

varying highp vec2 v_texCoord;
varying mediump vec2 v_viewDir;

void main()
{
	vec4 g0 = texture2D(u_g0, v_texCoord);
	vec4 g1 = texture2D(u_g1, v_texCoord);
	vec4 g2 = texture2D(u_g2, v_texCoord);
	vec4 g3 = texture2D(u_g3, v_texCoord);

	GBufferContents g;
	decodeGBuffer(g, g0, g1, g2, g3);

	MaterialInfo mat = getMaterialInfoFromGBuffer(g);

	vec3 viewDir = vec3(v_viewDir, 1.);
	PointLightBRDFParameters params = computePointLightBRDFParameters(
		g.normal, u_lightDir, normalize(viewDir));

	vec3 lit = evaluatePointLight(params, mat, u_lightColor);

	vec4 mosaicked = encodeHdrMosaic(lit);
	gl_FragColor = mosaicked;
	gl_FragColor.xyz = lit.xyz; // DEBUG
}
