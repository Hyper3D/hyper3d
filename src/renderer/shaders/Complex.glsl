
vec2 complexMultiply(vec2 a, vec2 b)
{
	vec3 t = vec3(b, -b.y);
	return vec2(dot(a.xy, t.xz), dot(a.xy, t.yx));
}

