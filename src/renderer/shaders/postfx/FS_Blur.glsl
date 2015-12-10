#pragma require Globals
#pragma require LogRGB

uniform sampler2D u_texture;
varying highp vec2 v_texCoord1;
varying highp vec2 v_texCoord2;
varying highp vec2 v_texCoord3;

void main()
{
	vec3 color0 = decodeLogRGB(texture2D(u_texture, v_texCoord1));
	vec3 color1 = decodeLogRGB(texture2D(u_texture, vec2(v_texCoord1.x, v_texCoord2.y)));
	vec3 color2 = decodeLogRGB(texture2D(u_texture, vec2(v_texCoord1.x, v_texCoord3.y)));
	vec3 color3 = decodeLogRGB(texture2D(u_texture, vec2(v_texCoord2.x, v_texCoord1.y)));
	vec3 color4 = decodeLogRGB(texture2D(u_texture, vec2(v_texCoord3.x, v_texCoord1.y)));

	vec3 outColor = color0 * 0.5 + (color1 + color2 + color3 + color4) * 0.125;

	gl_FragColor = encodeLogRGB(outColor);
}
