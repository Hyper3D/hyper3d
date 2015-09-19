#pragma parameter globalUseFullResolutionGBuffer
#pragma require Globals
#pragma require Pack

vec4 encodeGDepth(highp float depth)
{
	return vec4(pack24(depth * u_globalInvDepthFar), 0.);
}

highp float decodeGDepth(highp vec4 encoded) 
{
	return unpack24(encoded.xyz) * u_globalDepthFar;
}

highp float fetchDepth(sampler2D texDepth, highp vec2 texCoord)
{
	return decodeGDepth(texture2D(texDepth, texCoord));
}
