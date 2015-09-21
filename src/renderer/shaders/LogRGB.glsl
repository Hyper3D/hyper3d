
// actually not using "log"

vec4 encodeLogRGB(vec3 rgb)
{
	float lum = max(max(rgb.r, rgb.g), rgb.b);
	float logval = min(max(lum, 1. / 4.), 16.);
	float invLogval = 1. / logval;
	return vec4(rgb * invLogval, (logval - 1./4.) * (4. / 63.));
}

vec3 decodeLogRGB(vec4 p)
{
	float t = p.a * 63. / 4. + 1. / 4.;
	return p.rgb * t;
}
