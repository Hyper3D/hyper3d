
vec2 decodeVelocityMap(vec2 v)
{
	v = v * 2. - 1.;
	return v * v * sign(v);
}

vec2 encodeVelocityMap(vec2 v)
{
	return sqrt(abs(v)) * sign(v) * .5 + .5;
}
