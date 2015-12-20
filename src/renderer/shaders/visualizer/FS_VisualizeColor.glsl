#pragma parameter globalSupportsSRGB
uniform sampler2D u_texture;
varying highp vec2 v_texCoord;
void main()
{
    gl_FragColor = texture2D(u_texture, v_texCoord);
#if c_globalSupportsSRGB
    gl_FragColor.xyz = sqrt(gl_FragColor.xyz);
#endif
    gl_FragColor.w = 1.;
}
