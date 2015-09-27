// this shader is abstract; must be imported and main function must be provided

#pragma require FS_BaseLight

void doPointLight(vec3 lightDir, float shadow)
{
	highp vec3 viewDir = vec3(v_viewDir, 1.);

	vec4 g0 = texture2D(u_g0, v_texCoord);
	vec4 g1 = texture2D(u_g1, v_texCoord);
	vec4 g2 = texture2D(u_g2, v_texCoord);
	vec4 g3 = vec4(0.);

	if (isGBufferEmpty(g0, g1, g2, g3)) {
		discard;
	}

	GBufferContents g;
	decodeGBuffer(g, g0, g1, g2, g3);

	MaterialInfo mat = getMaterialInfoFromGBuffer(g);

	PointLightBRDFParameters params = computePointLightBRDFParameters(
		g.normal, lightDir, normalize(viewDir));

	vec3 lit = evaluatePointLight(params, mat, u_lightColor);

	lit *= shadow;
	
	emitLightPassOutput(lit);
}
