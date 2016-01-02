
vec3 encodeReinhard(vec3 hdr)
{
	hdr = sqrt(hdr);
	return hdr / (1. + hdr);
}

vec3 decodeReinhard(vec3 ldr)
{
	ldr = ldr / (1.000001 - ldr);
	return ldr * ldr; 
}