#pragma parameter globalUseFullResolutionGBuffer
#pragma require Pack16

uniform highp float u_globalDepthFar;
uniform highp float u_globalInvDepthFar;

vec4 encodeGDepth(highp float depth)
{
	return vec4(pack16(depth * u_globalInvDepthFar), 0., 0.);
}

highp float decodeGDepth(highp vec4 encoded) 
{
	return unpack16(encoded.xy) * u_globalDepthFar;
}

highp float fetchDepth(sampler2D texDepth, highp vec2 texCoord)
{
	return decodeGDepth(texture2D(texDepth, texCoord));
}
