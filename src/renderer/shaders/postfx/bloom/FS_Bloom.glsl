#pragma require Globals
#pragma require LogRGB

#pragma parameter useLogRGB
#pragma parameter hasTexture

uniform sampler2D u_input;
uniform sampler2D u_bloom;
uniform sampler2D u_texture;
varying highp vec2 v_texCoord;
varying highp vec2 v_dustCoord;

uniform mediump float u_strength;
uniform mediump float u_saturation;

void main()
{
#if c_useLogRGB
    vec3 color = decodeLogRGB(texture2D(u_input, v_texCoord));
#else
    vec3 color = texture2D(u_input, v_texCoord).xyz;
#endif

    vec3 bloom = texture2D(u_bloom, v_texCoord).xyz;

    bloom = mix(vec3(dot(bloom, vec3(0.2126, 0.7152, 0.0722))), bloom, u_saturation);

#if c_hasTexture
	vec3 dust = texture2D(u_texture, v_dustCoord).xyz;
	bloom *= dust * dust; // linearize & multiply
#endif

    color += bloom * u_strength;

#if c_useLogRGB
    gl_FragColor = encodeLogRGB(color);
#else
    gl_FragColor = vec4(color, 1.);
#endif
}
