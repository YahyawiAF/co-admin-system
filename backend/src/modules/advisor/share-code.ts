/** Short code for a share link: easy to type, no look-alike letters. */
export function randomCode() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let k = 0; k < 6; k++)
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
