#extension GL_EXT_shader_texture_lod : enable
#extension GL_OES_standard_derivatives : require

#ifdef GL_EXT_shader_texture_lod
vec4 myTextureCubeLod(samplerCube tex, highp vec3 coord, float lod, float texSize)
{
	return textureCubeLodEXT(tex, coord, lod);
}
vec4 myTextureCubeLodSeamless(samplerCube tex, highp vec3 coord, float lod, float texSize)
{
	highp vec3 coordAbs = abs(coord);
	highp float majorValue = max(max(coordAbs.x, coordAbs.y), coordAbs.z);
	bvec3 isMajor = equal(coordAbs, vec3(majorValue));

	float logTexSize = log2(texSize); lod = min(lod, logTexSize - 2.);
	float lodFloor = floor(lod);
	float actualTexSizeInv1 = exp2(lodFloor - log2(texSize));
	float actualTexSizeInv2 = actualTexSizeInv1 * 2.;
	highp vec3 modifiedCoord1 = coord * (1. - actualTexSizeInv1);
	highp vec3 modifiedCoord2 = coord * (1. - actualTexSizeInv2);

	highp vec3 coord1, coord2;
	coord1.x = isMajor.x ? coord.x : modifiedCoord1.x;
	coord1.y = isMajor.y ? coord.y : modifiedCoord1.y;
	coord1.z = isMajor.z ? coord.z : modifiedCoord1.z;
	coord2.x = isMajor.x ? coord.x : modifiedCoord2.x;
	coord2.y = isMajor.y ? coord.y : modifiedCoord2.y;
	coord2.z = isMajor.z ? coord.z : modifiedCoord2.z;

	return mix(textureCubeLodEXT(tex, coord1, lodFloor), textureCubeLodEXT(tex, coord2, lodFloor + 1.), fract(lod));
}
#else
vec4 myTextureCubeLod(samplerCube tex, highp vec3 coord, float lod, float texSize)
{
	highp vec3 coordAbs = abs(coord);
	highp vec3 cubeCoord = coord / max(coordAbs.x, max(coordAbs.y, coordAbs.z));
	highp vec3 cubeCoordD = fwidth(cubeCoord);
	float diff = max(max(cubeCoordD.x, cubeCoordD.y), cubeCoordD.z) * texSize * 0.5;
	float autolod = max(log2(diff + .125), 0.);
	return textureCube(tex, coord, lod - autolod);
}
vec4 myTextureCubeLodSeamless(samplerCube tex, highp vec3 coord, float lod, float texSize)
{
	// TODO
	return myTextureCubeLod(tex, coord, lod, texSize);
}
#endif
