#pragma require FS_BaseVolumetricLight

uniform vec3 u_lightDir;

void main()
{
	setupVolumetricLight();

    // TODO: shadow
    float shadowValue = 1.;

	emitVolumetricLightOutput(u_lightColor * (u_lightStrength * shadowValue));
}
