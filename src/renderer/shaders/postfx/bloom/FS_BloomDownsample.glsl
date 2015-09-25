#pragma require Globals
#pragma require LogRGB

uniform sampler2D u_input;
varying highp vec4 v_texCoord;

uniform mediump float u_gain;

void main()
{
	vec4 sample1 = texture2D(u_input, v_texCoord.xy);
	vec4 sample2 = texture2D(u_input, v_texCoord.zy);
	vec4 sample3 = texture2D(u_input, v_texCoord.xw);
	vec4 sample4 = texture2D(u_input, v_texCoord.zw);
	vec3 color1 = decodeLogRGB(sample1);
	vec3 color2 = decodeLogRGB(sample2);
	vec3 color3 = decodeLogRGB(sample3);
	vec3 color4 = decodeLogRGB(sample4);
	vec3 color = (color1 + color2 + color3 + color4) * u_gain;

	gl_FragColor.xyz = color;
}
