#extension GL_EXT_shader_texture_lod : enable
#extension GL_OES_standard_derivatives : require

#ifdef GL_EXT_shader_texture_lod
vec4 myTextureCubeLod(samplerCube tex, highp vec3 coord, float lod, float texSize)
{
	return textureCubeLodEXT(tex, coord, lod);
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
#endif
