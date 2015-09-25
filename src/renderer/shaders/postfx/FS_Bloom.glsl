#pragma require Globals
#pragma require LogRGB

uniform sampler2D u_input;
uniform sampler2D u_bloom;
varying highp vec2 v_texCoord;

uniform mediump float u_strength;
uniform mediump float u_saturation;

void main()
{
	vec3 color = decodeLogRGB(texture2D(u_input, v_texCoord));

	vec3 bloom = texture2D(u_bloom, v_texCoord).xyz;

	bloom = mix(vec3(dot(bloom, vec3(0.2126, 0.7152, 0.0722))), bloom, u_saturation);

	color += bloom * u_strength;

	gl_FragColor = encodeLogRGB(color);
}
