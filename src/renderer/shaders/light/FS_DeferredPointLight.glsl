#pragma require GBuffer
#pragma require ShadingModel
#pragma require DepthFetch
#pragma require FS_BasePointLight
#pragma require FS_BasePositionalLight
#pragma parameter isFullScreen

uniform highp vec3 u_lightPos;
uniform float u_lightInvInfluenceRadiusSquared;
uniform float u_minimumDistance; // squared
uniform float u_lightRadius;
uniform float u_lightLength;
uniform vec3 u_lightDir; // capsule

void main()
{
	setupPositionalLight();
	setupLight();
	setupPointLight();

	float shadowValue = 1.;
	// TODO: shadow

	vec3 lightDir = u_lightPos - viewPos;
	float dist = dot(lightDir, lightDir) * u_lightInvInfluenceRadiusSquared;

	if (dist >= 1.) {
		discard;
	}

	if (u_lightRadius > 0. || u_lightLength > 0.) {
		// TODO: sized point light
	}

	float strength = 1. - dist;

	strength *= 1. / max(u_minimumDistance, dot(lightDir, lightDir));

	doPointLight(normalize(lightDir), shadowValue * strength);
}
