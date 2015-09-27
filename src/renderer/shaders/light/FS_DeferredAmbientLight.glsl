#pragma require GBuffer
#pragma require ShadingModel
#pragma require FS_BaseLight

uniform sampler2D u_ssao;

void main()
{
	vec4 g0 = texture2D(u_g0, v_texCoord);
	vec4 g1 = texture2D(u_g1, v_texCoord);
	vec4 g2 = texture2D(u_g2, v_texCoord);
	vec4 g3 = vec4(0.);

	if (isGBufferEmpty(g0, g1, g2, g3)) {
		discard;
		return;
	}

	GBufferContents g;
	decodeGBuffer(g, g0, g1, g2, g3);

	MaterialInfo mat = getMaterialInfoFromGBuffer(g);

	float ssao = texture2D(u_ssao, v_texCoord).r;
	ssao *= ssao;

	vec3 viewDir = vec3(v_viewDir, 1.);
	UniformLightBRDFParameters params = computeUniformLightBRDFParameters(
		g.normal, normalize(viewDir));

	vec3 lit = evaluateUniformLight(params, mat, u_lightColor * ssao);

	emitLightPassOutput(lit);
}
