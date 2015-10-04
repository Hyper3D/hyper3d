#pragma require GBuffer
#pragma require FS_BaseLight

void main()
{	
	vec4 g0 = vec4(0.);
	vec4 g1 = vec4(0.);
	vec4 g2 = vec4(0.);
	vec4 g3 = texture2D(u_g3, v_texCoord);

	GBufferContents g;
	decodeGBuffer(g, g0, g1, g2, g3);

	emitLightPassOutput(g.preshaded);
}
