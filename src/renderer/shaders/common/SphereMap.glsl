highp vec2 encodeSpheremap(highp vec3 normal) {
	highp vec2 e = normal.xy * inversesqrt(8. + normal.z * 8.);
	return e + 0.5;
}

highp vec3 decodeSpheremap(highp vec2 encoded) {
	highp vec4 nn = vec4(encoded * 2. - 1., 1., -1.);
	highp float l = dot(nn.xyz, -nn.xyw);
	nn.z = l; nn.xy *= sqrt(l);
	return nn.xyz * 2. + vec3(0., 0., -1.);
}
