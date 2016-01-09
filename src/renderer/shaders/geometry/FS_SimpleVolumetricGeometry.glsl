#pragma parameter useNormalMap
#pragma require FS_BaseGeometry
#pragma parameter useThickness
#pragma require DepthFetch
#pragma require VolumeTexture2D

uniform sampler2D u_linearDepth;

uniform sampler2D u_lightVolume;
uniform vec4 u_lightVolumeParams;

varying highp vec4 v_position;
varying highp float v_depth;

void main()
{
    highp float depth = fetchDepth(u_linearDepth, gl_FragCoord.xy * u_globalInvRenderSize);
    if (v_depth > depth) {
        discard;
    }

    evaluateMaterial();

    vec3 color = m_albedo;
    vec3 lightCoord = (v_position.xyz / v_position.w) * .5 + .5;
    vec3 light = sampleVolumeTexture2D(u_lightVolume, lightCoord, u_lightVolumeParams).xyz;
    color *= light;

    float density = m_density;
#if c_useThickness
    density *= min(depth - v_depth, m_thickness);
#endif
    
    float alpha = 1. - exp2(-density);
    gl_FragColor.w = alpha * .5;
    gl_FragColor.xyz = alpha * color + m_emissive * density;
}
