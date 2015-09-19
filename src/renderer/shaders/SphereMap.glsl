vec2 encodeSpheremap(vec3 normal) {
	vec2 e = normalize(normal.xy) * sqrt(normal.z * -0.5 + 0.5);
	return e * 0.5 + 0.5;
}

vec3 decodeSpheremap(vec2 encoded) {
	vec4 nn = vec4(encoded * 2. - 1., 1., -1.);
	float l = dot(nn.xyz, -nn.xyw);
	nn.z = l; nn.xy *= sqrt(l);
	return nn.xyz * 2. + vec3(0., 0., -1.);
}
