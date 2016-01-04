#pragma require FS_Geometry
#pragma require GBufferMosaic

void main()
{
    GBufferContents g = evaluateGeometry();
    vec4 g0, g1, g2, g3;

    encodeGBuffer(g0, g1, g2, g3, g);

    // mosaiced G-Buffer is not sRGB buffer, so
    // we have to convert color to gamma space to
    // prevent the loss of precision
    g0.xyz = sqrt(g0.xyz);

    gl_FragColor = encodeGBufferMosaic(g0, g1, g2, g3);
}