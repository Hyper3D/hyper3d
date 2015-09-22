
vec3 encodePalYuv(vec3 rgb)
{
	return vec3(
		dot(rgb, vec3(0.299, 0.587, 0.114)),
		dot(rgb, vec3(-0.14713, -0.28886, 0.436)),
		dot(rgb, vec3(0.615, -0.51499, -0.10001))
	);
}

vec3 decodePalYuv(vec3 yuv)
{
	return vec3(
		dot(yuv, vec3(1., 0., 1.13983)),
		dot(yuv, vec3(1., -0.39465, -0.58060)),
		dot(yuv, vec3(1., 2.03211, 0.))
	);
}
