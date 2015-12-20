#pragma require DepthFetch
uniform sampler2D u_texture;
varying highp vec2 v_texCoord;

void main()
{
    highp float depth = decodeGDepth(texture2D(u_texture, v_texCoord));
    highp float depthScaled = depth * u_globalInvDepthFar;

    gl_FragColor.xyz = vec3(0.2, 0.05, 1.) * clamp(depthScaled * 3., 0., 1.);

    gl_FragColor.xyz = mix(gl_FragColor.xyz, vec3(1.0, 0.8, 0.0), clamp(depthScaled * 3. - 1., 0., 1.));

    gl_FragColor.xyz = mix(gl_FragColor.xyz, vec3(1.0, 1.0, 0.0), clamp(depthScaled * 3. - 1.5, 0., 1.));

    gl_FragColor.xyz = mix(gl_FragColor.xyz, vec3(1.0, 1.0, 1.0), clamp(depthScaled * 3. - 2.0, 0., 1.));

    float frac = fract(depth);
    gl_FragColor.xyz += vec3(0., 1., 1.) * max(0., 1. - abs(frac - 0.5) * 5.);

    gl_FragColor.w = 1.;
}
