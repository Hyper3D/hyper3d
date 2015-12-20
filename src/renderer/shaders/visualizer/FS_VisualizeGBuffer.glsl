#pragma require GBuffer
#pragma parameter visualizedAttribute
uniform sampler2D u_g0;
uniform sampler2D u_g1;
uniform sampler2D u_g2;
uniform sampler2D u_g3;
varying highp vec2 v_texCoord;
void main()
{
    vec4 g0 = texture2D(u_g0, v_texCoord);
    vec4 g1 = texture2D(u_g1, v_texCoord);
    vec4 g2 = texture2D(u_g2, v_texCoord);
    vec4 g3 = texture2D(u_g3, v_texCoord);

    GBufferContents g;
    decodeGBuffer(g, g0, g1, g2, g3);

#if c_visualizedAttribute == 0 // Albedo
    gl_FragColor.xyz = sqrt(g.albedo);
#elif c_visualizedAttribute == 1 // Normal
    gl_FragColor.xyz = g.normal * .5 + .5;
#elif c_visualizedAttribute == 2 // Velocity
    gl_FragColor.xy = g.velocity * .5 + .5;
    gl_FragColor.z = 0.5;
#elif c_visualizedAttribute == 3 // Roughness
    gl_FragColor.xyz = vec3(g.roughness);
#elif c_visualizedAttribute == 4 // Metallic
    gl_FragColor.xyz = vec3(g.metallic);
#elif c_visualizedAttribute == 5 // Specular
    gl_FragColor.xyz = vec3(g.specular);
#elif c_visualizedAttribute == 6 // Preshaded
    gl_FragColor.xyz = sqrt(g.preshaded);
#elif c_visualizedAttribute == 7 // MaterialId
    float id = g.materialId;
    gl_FragColor.x = frac(id * (1. / 2.));
    gl_FragColor.y = frac(id * (1. / 4.)) > 0.25 ? .5 : 0.;
    gl_FragColor.z = frac(id * (1. / 8.)) > 0.25 ? .5 : 0.;
    if (id > 7.5) {
        gl_FragColor.xyz += .5;
    }
#endif

    gl_FragColor.w = 1.;
}
