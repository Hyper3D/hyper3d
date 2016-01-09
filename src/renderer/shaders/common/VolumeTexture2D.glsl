
vec4 sampleVolumeTexture2D(sampler2D tex, vec3 coord, vec4 samplerParams)
{
	float depth = coord.z * samplerParams.z - 0.5;
	float idepth1 = floor(depth);
	float idepth2 = ceil(depth);
	float fdepth = fract(depth);

	float row1 = floor(idepth1 * samplerParams.x);
	float col1 = idepth1 - row1 * samplerParams.w;
	float row2 = floor(idepth2 * samplerParams.x);
	float col2 = idepth2 - row2 * samplerParams.w;

	vec2 coord1 = (coord.xy + vec2(col1, row1)) * samplerParams.xy;
	vec2 coord2 = (coord.xy + vec2(col2, row2)) * samplerParams.xy;

	vec4 value1 = texture2D(tex, coord1);
	vec4 value2 = texture2D(tex, coord2);

	return mix(value1, value2, fdepth);
}
