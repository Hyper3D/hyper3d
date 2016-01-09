
uniform vec3 u_lightColor;
uniform highp float u_lightStrength;

varying highp vec4 v_viewPos;
varying vec2 v_ditherCoord;

highp vec3 viewPos;

void setupVolumetricLight()
{
	viewPos = v_viewPos.xyz / v_viewPos.w;
}

void emitVolumetricLightOutput(vec3 scatter)
{
	gl_FragColor = vec4(scatter, 0.);
}
