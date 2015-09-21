#pragma require Globals
#pragma require LogRGB
#pragma parameter globalSupportsSRGB

uniform sampler2D u_input;
varying highp vec2 v_texCoord;

varying vec2 v_vignetteCoord;
uniform mediump float u_vignetteAmount;

uniform float u_gain;

uniform vec3 u_color;

uniform float u_highlightCrush;
uniform float u_contrast;

void main()
{
	vec3 color = decodeLogRGB(texture2D(u_input, v_texCoord));

	// vignette
	float vigTan2 = dot(v_vignetteCoord, v_vignetteCoord);
	float vigCos2 =  1. / (1. + vigTan2);
	float vigCos4 = vigCos2 * vigCos2;
	color *= max(mix(1., vigCos4, u_vignetteAmount) * u_gain, 0.);

	// apply color
	color *= u_color;

	// tone mapping
	float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
	float toneMapScale = 1. / (1. + luma * u_highlightCrush);
	color *= toneMapScale;

	color = mix(color, smoothstep(vec3(0.), vec3(1.), color), u_contrast);

	gl_FragColor.xyz = color;

#if !c_globalSupportsSRGB
	gl_FragColor.xyz = sqrt(gl_FragColor.xyz);
#endif

	gl_FragColor.w = 1.;
}
