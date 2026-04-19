export function actualAgeAt(
	birthYear: number,
	birthMonth: number,
	birthDay: number,
	atYear: number,
	atMonth: number,
	atDay: number,
): number {
	const before = atMonth < birthMonth || (atMonth === birthMonth && atDay < birthDay);
	return atYear - birthYear - (before ? 1 : 0);
}
