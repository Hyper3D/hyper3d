vec2 pack16(highp float value) {
	value *= 255.;
	highp float flr = floor(value);
	return vec2(flr * (1. / 255.), value - flr);
}

highp float unpack16(vec2 packedValue) {
	return packedValue.x + packedValue.y * (1. / 255.);
}

vec3 pack24(highp float value) {
	value *= 255.;
	highp float i1 = floor(value);
	highp float f1 = value - i1;
	f1 *= 255.;
	highp float i2 = floor(f1);
	highp float f2 = f1 - i2;
	return vec3(i1 * (1. / 255.), i2 * (1. / 255.), f2);
}

highp float unpack24(vec3 packedValue) {
	return dot(packedValue, vec3(1., 1. / 255., 1. / 255. / 255.));
}