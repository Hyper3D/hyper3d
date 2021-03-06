#pragma require DepthFetch

#extension GL_OES_standard_derivatives : require

// screen coord [0, 1] must be provided to texCoord.
vec3 computeNormalFromDepthUsingStandardDerivatives(sampler2D texDepth, highp vec2 texCoord, highp vec3 viewDir)
{
	highp float depth = fetchDepth(texDepth, texCoord);
	highp vec3 viewPos = depth * viewDir;

	vec3 dx = dFdx(viewPos), dy = dFdy(viewPos);

	return normalize(cross(dx, dy));
}
