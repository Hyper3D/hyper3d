float determinantOfMatrix2(mat2 m)
{
	return m[0][0] * m[1][1] - m[0][1] * m[1][0];
}
highp float determinantOfMatrix2Highp(highp mat2 m)
{
	return m[0][0] * m[1][1] - m[0][1] * m[1][0];
}

float determinantOfMatrix3(mat3 m)
{
	return 
		m[0][0] * m[1][1] * m[2][2] + 
		m[1][0] * m[2][1] * m[0][2] +
		m[2][0] * m[0][1] * m[1][2] -
		m[2][0] * m[1][1] * m[0][2] -
		m[1][0] * m[0][1] * m[2][2] -
		m[0][0] * m[2][1] * m[1][2];
}
highp float determinantOfMatrix3Highp(highp mat3 m)
{
	return 
		m[0][0] * m[1][1] * m[2][2] + 
		m[1][0] * m[2][1] * m[0][2] +
		m[2][0] * m[0][1] * m[1][2] -
		m[2][0] * m[1][1] * m[0][2] -
		m[1][0] * m[0][1] * m[2][2] -
		m[0][0] * m[2][1] * m[1][2];
}
