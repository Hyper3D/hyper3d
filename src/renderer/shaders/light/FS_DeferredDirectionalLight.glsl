#pragma parameter hasShadowMap

#pragma require GBuffer
#pragma require ShadingModel
#pragma require DepthFetch
#pragma require FS_BasePointLight
#pragma require ShadowTexture

uniform vec3 u_lightDir;

#if c_hasShadowMap
uniform sampler2D u_shadowMap;
uniform sampler2D u_jitter;
uniform mat4 u_shadowMapMatrix;
uniform vec2 u_jitterAmount;
varying vec2 v_jitterCoord;
#endif

void main()
{
	setupLight();
	setupPointLight();

#if c_hasShadowMap

	highp vec3 viewPos = viewPos;
	highp vec3 shadowCoord = (u_shadowMapMatrix * vec4(viewPos, 1.)).xyz; // w is always 1 for orthographic camera
	shadowCoord.z -= 0.002;
	
	float shadowValue = 0.;
	vec4 jitter1 = texture2D(u_jitter, v_ditherCoord.xy) - 0.5;
	vec4 jitter2 = texture2D(u_jitter, v_jitterCoord.xy) - 0.5;

	jitter1 *= u_jitterAmount.xyxy;
	jitter2 *= u_jitterAmount.xyxy;

	shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter1.xy, 0.));
	shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter1.zw, 0.));
	shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter2.xy, 0.));
	shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter2.zw, 0.));

	if (shadowValue < 0.0001) {
		discard;
	}

	shadowValue *= 1. / 4.;

#else // c_hasShadowMap

	float shadowValue = 1.;

#endif // c_hasShadowMap

	doPointLight(u_lightDir, shadowValue);

}
