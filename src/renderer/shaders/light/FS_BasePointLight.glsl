// this shader is abstract; must be imported and main function must be provided

#pragma require FS_BaseLight

GBufferContents g;
MaterialInfo mat;

void setupPointLight()
{
	vec4 g0 = texture2D(u_g0, v_texCoord * perspectiveScaling);
	vec4 g1 = texture2D(u_g1, v_texCoord * perspectiveScaling);
	vec4 g2 = texture2D(u_g2, v_texCoord * perspectiveScaling);
	vec4 g3 = vec4(0.);

	if (isGBufferEmpty(g0, g1, g2, g3)) {
		discard;
	}

	decodeGBuffer(g, g0, g1, g2, g3);
}

void doPointLight(vec3 lightDir, highp float shadow)
{
	mat = getMaterialInfoFromGBuffer(g);

	PointLightBRDFParameters params = computePointLightBRDFParameters(
		g.normal, lightDir, viewDirNormalized);

	vec3 lit = evaluatePointLight(params, mat, u_lightColor);

	lit *= shadow * u_lightStrength;
	
	emitLightPassOutput(lit);
}
