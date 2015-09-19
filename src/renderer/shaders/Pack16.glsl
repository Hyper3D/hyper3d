vec2 pack16(float value) {
	value *= 255.;
	float flr = floor(value);
	return vec2(flr * (1. / 255.), value - flr);
}

float unpack16(vec2 packedValue) {
	return packedValue.x + packedValue.y * (1. / 255.);
}
