#pragma parameter globalUseFullResolutionGBuffer
#pragma require Pack16

uniform float u_globalDepthFar;

vec4 encodeGDepth(float depth)
{
	return vec4(pack16(depth), 0., 0.);
}

float decodeGDepth(vec4 encoded) 
{
	return unpack16(encoded.xy);
}

float fetchDepth(sampler2D texDepth, vec2 texCoord)
{
	return decodeGDepth(texture2D(texDepth, texCoord));
}
